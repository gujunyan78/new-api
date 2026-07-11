package doubao2

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

// newInfo returns a RelayInfo with its embedded *TaskRelayInfo and *ChannelMeta
// initialized, mirroring what GenRelayInfo/InitChannelMeta do for the task relay
// format. Without this, accessing info.Action / info.IsModelMapped dereferences
// nil embedded pointers.
func newInfo() *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{}
	info.TaskRelayInfo = &relaycommon.TaskRelayInfo{}
	info.ChannelMeta = &relaycommon.ChannelMeta{}
	return info
}

// newJSONContext builds a gin.Context whose request body is the given JSON,
// mimicking how a real POST /v1/videos/generations arrives.
func newJSONContext(t *testing.T, body string) *gin.Context {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/v1/videos/generations", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	return c
}

// TestPrefillNativePrompt_ExtractsText verifies that a doubao native request
// (prompt inside content[].text, no top-level prompt) is accepted and that the
// prompt flows all the way into the upstream payload.
func TestPrefillNativePrompt_ExtractsText(t *testing.T) {
	t.Parallel()

	const body = `{
		"model": "doubao-seedance-2-0-fast",
		"content": [
			{"type": "text", "text": "第一人称视角宣传广告，背景声音统一为男生音色。"}
		],
		"generate_audio": true,
		"ratio": "16:9",
		"duration": 11,
		"watermark": false
	}`

	c := newJSONContext(t, body)
	a := &TaskAdaptor{}

	if te := a.ValidateRequestAndSetAction(c, newInfo()); te != nil {
		t.Fatalf("ValidateRequestAndSetAction failed: %v", te.Error)
	}

	// Build the upstream payload and assert the prompt + native fields survived.
	reader, err := a.BuildRequestBody(c, newInfo())
	if err != nil {
		t.Fatalf("BuildRequestBody failed: %v", err)
	}
	upstream, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read upstream body: %v", err)
	}

	var got RequestPayload
	if err := common.Unmarshal(upstream, &got); err != nil {
		t.Fatalf("unmarshal upstream payload: %v\nbody: %s", err, upstream)
	}

	// Prompt text must be present as a text content item.
	var hasText bool
	for _, item := range got.Content {
		if item.Type == "text" && item.Text != "" {
			hasText = true
		}
	}
	if !hasText {
		t.Fatalf("expected a non-empty text content item, got payload: %s", upstream)
	}

	// Native top-level fields must reach the upstream payload.
	if got.Ratio != "16:9" {
		t.Errorf("Ratio = %q, want 16:9", got.Ratio)
	}
	if got.Duration == nil || int(*got.Duration) != 11 {
		t.Errorf("Duration = %v, want 11", got.Duration)
	}
	if got.GenerateAudio == nil || !bool(*got.GenerateAudio) {
		t.Errorf("GenerateAudio = %v, want true", got.GenerateAudio)
	}
	if got.Watermark == nil || bool(*got.Watermark) {
		t.Errorf("Watermark = %v, want false", got.Watermark)
	}
}

// TestPrefillNativePrompt_NoContent verifies that a request with neither a
// top-level prompt nor a content array still yields the original
// "prompt is required" error (preserving existing behavior for malformed input).
func TestPrefillNativePrompt_NoContent(t *testing.T) {
	t.Parallel()

	const body = `{"model": "doubao-seedance-2-0-fast"}`
	c := newJSONContext(t, body)
	a := &TaskAdaptor{}

	te := a.ValidateRequestAndSetAction(c, newInfo())
	if te == nil {
		t.Fatal("expected prompt-required error, got nil")
	}
	if want := "prompt is required"; te.Message != want {
		t.Errorf("error message = %q, want %q", te.Message, want)
	}
}

// TestPrefillNativePrompt_StandardWrapperUnchanged verifies that a request
// already using the standard wrapper (top-level prompt) is left untouched,
// so the new code path does not regress existing clients.
func TestPrefillNativePrompt_StandardWrapperUnchanged(t *testing.T) {
	t.Parallel()

	const body = `{"model":"doubao-seedance-2-0-fast","prompt":"a cat playing piano"}`
	c := newJSONContext(t, body)
	a := &TaskAdaptor{}

	if te := a.ValidateRequestAndSetAction(c, newInfo()); te != nil {
		t.Fatalf("standard wrapper should pass validation, got: %v", te.Error)
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		t.Fatalf("GetTaskRequest: %v", err)
	}
	if req.Prompt != "a cat playing piano" {
		t.Errorf("Prompt = %q, want unchanged", req.Prompt)
	}
}
