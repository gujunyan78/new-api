package video3

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/tidwall/sjson"
)

// ============================
// Request / Response structures
// ============================

// taskRequestKey is the gin.Context key used to stash the parsed typed request
// so EstimateBilling can reuse the validated resolution/duration/model.
const taskRequestKey = "video3_task_request"

// TaskSubmitRequest mirrors the upstream video3.0 submit payload.
type TaskSubmitRequest struct {
	Model           string   `json:"model"`
	Prompt          string   `json:"prompt,omitempty"`
	FirstFrame      string   `json:"first_frame,omitempty"`
	LastFrame       string   `json:"last_frame,omitempty"`
	ReferenceImages []string `json:"reference_images,omitempty"`
	Resolution      string   `json:"resolution,omitempty"`
	Duration        int      `json:"duration,omitempty"`
	Ratio           string   `json:"ratio,omitempty"`
	Audio           *bool    `json:"audio,omitempty"`
	Seed            *int     `json:"seed,omitempty"`
}

// submitResponse is what the upstream returns immediately after a submit.
type submitResponse struct {
	ID     string `json:"id"`
	TaskID string `json:"task_id"`
	Status string `json:"status"`
	Object string `json:"object"`
}

// fetchResponse is what the upstream returns when polling a task.
type fetchResponse struct {
	ID           string   `json:"id"`
	TaskID       string   `json:"task_id"`
	Status       string   `json:"status"` // pending / processing / completed / failed
	Object       string   `json:"object"`
	VideoURL     string   `json:"video_url,omitempty"`
	ResultURL    string   `json:"result_url,omitempty"`
	ResultURLs   []string `json:"result_urls,omitempty"`
	ErrorCode    string   `json:"error_code,omitempty"`
	ErrorMessage string   `json:"error_message,omitempty"`
	Retryable    bool     `json:"retryable,omitempty"`
}

// Validation bounds shared across both models.
const (
	defaultDuration = 5
	minDuration     = 2
	maxDuration     = 30
	maxRefImages    = 10
	maxSeed         = 2147483647
)

// modelResolutions holds the resolutions valid for a given model.
var modelResolutions = map[string][]string{
	"w3.0-video-special":     {"480P", "720P", "1080P"},
	"w3.0-video-pro-special": {"1080P", "2K", "4K"},
}

var validRatios = map[string]bool{
	"16:9": true, "4:3": true, "1:1": true, "3:4": true, "9:16": true, "adaptive": true,
}

// resolutionMultiplier is the fixed billing multiplier for each model's
// resolution tier, keyed by model then resolution. The lowest tier is the
// reference (multiplier 1.0); higher tiers scale the base price up.
//
// NOTE: These are placeholder values chosen so higher tiers cost proportionally
// more. Adjust the numbers to match the actual pricing table before shipping.
//
// Billing formula (per request): quota = modelPerSecondRatio × resolution × duration
//   - modelPerSecondRatio: the model's configured model_ratio (per-second quota)
//   - resolution: multiplier from this table
//   - duration: the request's duration in seconds
var resolutionMultiplier = map[string]map[string]float64{
	"w3.0-video-special": {
		"480P":  1.0,
		"720P":  1.5,
		"1080P": 2.0,
	},
	"w3.0-video-pro-special": {
		"1080P": 1.0,
		"2K":    1.6,
		"4K":    2.4,
	},
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

// ValidateRequestAndSetAction parses & validates the native video3.0 JSON
// request body and records the resulting action on the RelayInfo.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if err := a.parseAndValidate(c, info); err != nil {
		return taskErrLocal(err, "invalid_request")
	}
	return nil
}

// parseAndValidate reads the body once and validates business rules. The parsed
// request is cached for downstream reuse; the original body remains readable for
// BuildRequestBody via the shared body storage.
func (a *TaskAdaptor) parseAndValidate(c *gin.Context, info *relaycommon.RelayInfo) error {
	var req TaskSubmitRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return errors.Wrap(err, "invalid JSON request body")
	}

	req.Model = stringsTrimSpace(req.Model)
	if !strSliceContains(ModelList, req.Model) {
		return fmt.Errorf("unsupported model: %s", req.Model)
	}

	if len(req.ReferenceImages) > 0 {
		if len(req.ReferenceImages) > maxRefImages {
			return fmt.Errorf("reference_images exceeds the maximum of %d", maxRefImages)
		}
		if req.LastFrame != "" || req.FirstFrame != "" {
			return fmt.Errorf("reference_images cannot be combined with first_frame/last_frame")
		}
	}
	if req.LastFrame != "" && req.FirstFrame == "" {
		return fmt.Errorf("last_frame requires first_frame; standalone last_frame is rejected by upstream")
	}

	if req.Resolution != "" {
		if !strSliceContains(modelResolutions[req.Model], req.Resolution) {
			return fmt.Errorf("resolution %s is not supported for model %s", req.Resolution, req.Model)
		}
	} else {
		req.Resolution = "1080P"
	}

	if req.Ratio != "" && !validRatios[req.Ratio] {
		return fmt.Errorf("unsupported ratio: %s", req.Ratio)
	}

	// Duration is bounded to the vendor contract 2..30s before any use.
	if req.Duration == 0 {
		req.Duration = defaultDuration
	}
	if req.Duration < minDuration || req.Duration > maxDuration {
		return fmt.Errorf("duration must be between %d and %d seconds", minDuration, maxDuration)
	}

	if req.Seed != nil && (*req.Seed < 0 || *req.Seed > maxSeed) {
		return fmt.Errorf("seed must be between 0 and %d", maxSeed)
	}

	info.Action = taskActionFor(req)
	c.Set(taskRequestKey, req)
	return nil
}

// taskActionFor chooses an action based on the visual inputs present.
func taskActionFor(req TaskSubmitRequest) string {
	if len(req.ReferenceImages) > 0 {
		return constant.TaskActionReferenceGenerate
	}
	if req.FirstFrame != "" && req.LastFrame != "" {
		return constant.TaskActionFirstTailGenerate
	}
	if req.FirstFrame != "" {
		return constant.TaskActionGenerate
	}
	return constant.TaskActionTextGenerate
}

// stringsTrimSpace trims surrounding whitespace from a model id.
func stringsTrimSpace(s string) string {
	start := 0
	for start < len(s) && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	end := len(s)
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}

// strSliceContains reports whether list contains v.
func strSliceContains(list []string, v string) bool {
	for _, item := range list {
		if item == v {
			return true
		}
	}
	return false
}

// EstimateBilling computes the OtherRatios that scale the per-second model
// price: quota = modelPerSecond × resolutionMultiplier × duration.
//
// The model's configured model_ratio is interpreted as a per-second quota
// (NOT a per-generation price). The returned multipliers are applied on top of
// that base by RelayTaskSubmit via ApplyOtherRatiosToFloat.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, _ *relaycommon.RelayInfo) map[string]float64 {
	v, exists := c.Get(taskRequestKey)
	if !exists {
		return nil
	}
	req, ok := v.(TaskSubmitRequest)
	if !ok {
		return nil
	}
	mul := 1.0
	if perModel, ok := resolutionMultiplier[req.Model]; ok {
		if m, ok := perModel[req.Resolution]; ok {
			mul = m
		}
	}
	return map[string]float64{
		"resolution": mul,
		"duration":   float64(req.Duration),
	}
}

// BuildRequestURL targets the upstream submit endpoint.
func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/generate/video", a.baseURL), nil
}

// BuildRequestHeader sets the JSON + Bearer auth headers.
func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

// BuildRequestBody forwards the original client body verbatim, only replacing
// the model with the (possibly mapped) upstream model name.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_request_body_failed")
	}
	raw, err := storage.Bytes()
	if err != nil {
		return nil, errors.Wrap(err, "read_request_body_failed")
	}

	upstreamModel := info.UpstreamModelName
	if upstreamModel == "" {
		upstreamModel = info.OriginModelName
	}
	rewritten, err := sjson.SetBytes(raw, "model", upstreamModel)
	if err != nil {
		return nil, errors.Wrap(err, "rewrite model failed")
	}
	return bytes.NewReader(rewritten), nil
}

// DoRequest delegates to the shared task API request helper.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse parses the immediate submit response and returns the upstream id.
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var sResp submitResponse
	if err := common.Unmarshal(responseBody, &sResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	upstreamID := sResp.ID
	if upstreamID == "" {
		upstreamID = sResp.TaskID
	}
	if upstreamID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	// Reply to the new-api caller with an OpenAI-video-shaped object using our
	// public task id; the real upstream id is kept internally for polling.
	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)

	return upstreamID, responseBody, nil
}

// FetchTask polls the upstream task status endpoint.
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/v1/videos/tasks/%s", baseUrl, taskID)
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

// ParseTaskResult maps an upstream fetch response into an internal TaskInfo.
func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var fResp fetchResponse
	if err := common.Unmarshal(respBody, &fResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskInfo := &relaycommon.TaskInfo{}
	switch fResp.Status {
	case "pending":
		taskInfo.Status = model.TaskStatusQueued
		taskInfo.Progress = taskcommon.ProgressQueued
	case "processing":
		taskInfo.Status = model.TaskStatusInProgress
		taskInfo.Progress = taskcommon.ProgressInProgress
	case "completed":
		taskInfo.Status = model.TaskStatusSuccess
		taskInfo.Progress = taskcommon.ProgressComplete
		taskInfo.Url = firstResultURL(fResp)
	case "failed":
		taskInfo.Status = model.TaskStatusFailure
		taskInfo.Progress = taskcommon.ProgressComplete
		if fResp.ErrorMessage != "" {
			taskInfo.Reason = fResp.ErrorMessage
		} else if fResp.ErrorCode != "" {
			taskInfo.Reason = fResp.ErrorCode
		}
	default:
		return nil, fmt.Errorf("unknown task status: %s", fResp.Status)
	}
	return taskInfo, nil
}

// firstResultURL picks a single result URL from the fetch response, honoring
// the multiple-results field when the primary ones are absent.
func firstResultURL(f fetchResponse) string {
	if f.VideoURL != "" {
		return f.VideoURL
	}
	if f.ResultURL != "" {
		return f.ResultURL
	}
	if len(f.ResultURLs) > 0 && f.ResultURLs[0] != "" {
		return f.ResultURLs[0]
	}
	return ""
}

// GetModelList returns the models this channel type can carry.
func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

// GetChannelName returns the channel type name.
func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

// ConvertToOpenAIVideo rebuilds an OpenAI-video object from a stored task's
// latest fetch snapshot (originTask.Data holds the last polled upstream body).
func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var fResp fetchResponse
	if len(originTask.Data) > 0 {
		if err := common.Unmarshal(originTask.Data, &fResp); err != nil {
			return nil, errors.Wrap(err, "unmarshal video3 task data failed")
		}
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = originTask.TaskID
	ov.TaskID = originTask.TaskID
	ov.Status = originTask.Status.ToVideoStatus()
	ov.SetProgressStr(originTask.Progress)
	ov.CreatedAt = originTask.CreatedAt
	ov.CompletedAt = originTask.UpdatedAt
	if originTask.Properties.OriginModelName != "" {
		ov.Model = originTask.Properties.OriginModelName
	}

	if u := firstResultURL(fResp); u != "" {
		ov.SetMetadata("url", u)
	}
	if originTask.Status == model.TaskStatusFailure {
		msg := fResp.ErrorMessage
		if msg == "" {
			msg = originTask.FailReason
		}
		ov.Error = &dto.OpenAIVideoError{Message: msg, Code: fResp.ErrorCode}
	}
	return common.Marshal(ov)
}

// taskErrLocal builds a local (no upstream round-trip needed) TaskError.
func taskErrLocal(err error, code string) *dto.TaskError {
	return &dto.TaskError{
		Code:       code,
		Message:    err.Error(),
		StatusCode: http.StatusBadRequest,
		LocalError: true,
		Error:      err,
	}
}
