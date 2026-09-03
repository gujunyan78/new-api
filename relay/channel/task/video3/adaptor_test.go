package video3

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newInfo() *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{}
	info.TaskRelayInfo = &relaycommon.TaskRelayInfo{}
	info.ChannelMeta = &relaycommon.ChannelMeta{}
	return info
}

func newJSONContext(t *testing.T, body string) *gin.Context {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/v1/generate/video", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	return c
}

func TestParseTaskResult(t *testing.T) {
	a := &TaskAdaptor{}
	tests := []struct {
		name       string
		body       string
		wantStatus string
		wantURL    string
		wantReason string
		wantErr    bool
	}{
		{
			name:       "pending maps to queued",
			body:       `{"id":"t1","task_id":"t1","status":"pending","object":"video"}`,
			wantStatus: string(model.TaskStatusQueued),
		},
		{
			name:       "processing maps to in progress",
			body:       `{"id":"t1","status":"processing","object":"video"}`,
			wantStatus: string(model.TaskStatusInProgress),
		},
		{
			name:       "completed uses video_url",
			body:       `{"id":"t1","status":"completed","video_url":"https://cdn.example.com/a.mp4"}`,
			wantStatus: string(model.TaskStatusSuccess),
			wantURL:    "https://cdn.example.com/a.mp4",
		},
		{
			name:       "completed falls back to result_url",
			body:       `{"id":"t1","status":"completed","result_url":"https://cdn.example.com/b.mp4"}`,
			wantStatus: string(model.TaskStatusSuccess),
			wantURL:    "https://cdn.example.com/b.mp4",
		},
		{
			name:       "completed falls back to result_urls",
			body:       `{"id":"t1","status":"completed","result_urls":["https://cdn.example.com/c.mp4"]}`,
			wantStatus: string(model.TaskStatusSuccess),
			wantURL:    "https://cdn.example.com/c.mp4",
		},
		{
			name:       "failed surfaces error_message",
			body:       `{"id":"t1","status":"failed","error_code":"E1","error_message":"boom"}`,
			wantStatus: string(model.TaskStatusFailure),
			wantReason: "boom",
		},
		{
			name:       "unknown status is an error",
			body:       `{"id":"t1","status":"wobble"}`,
			wantStatus: "",
			wantErr:    true,
		},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			res, err := a.ParseTaskResult([]byte(tc.body))
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.wantStatus, res.Status)
			assert.Equal(t, tc.wantURL, res.Url)
			assert.Equal(t, tc.wantReason, res.Reason)
		})
	}
}

func TestValidateRequestAndSetAction(t *testing.T) {
	a := &TaskAdaptor{}
	tests := []struct {
		name    string
		body    string
		wantErr string // substring of the error message; empty means no error
	}{
		{
			name: "text generation default resolution and duration",
			body: `{"model":"w3.0-video-special","prompt":"a cat","ratio":"16:9"}`,
		},
		{
			name:    "unsupported model rejected",
			body:    `{"model":"wan-2.1","prompt":"x"}`,
			wantErr: "unsupported model",
		},
		{
			name:    "pro model rejects a non-pro resolution",
			body:    `{"model":"w3.0-video-pro-special","prompt":"x","resolution":"720P"}`,
			wantErr: "not supported",
		},
		{
			name:    "standard model rejects 2K resolution",
			body:    `{"model":"w3.0-video-special","prompt":"x","resolution":"2K"}`,
			wantErr: "not supported",
		},
		{
			name:    "duration over max rejected",
			body:    `{"model":"w3.0-video-special","prompt":"x","duration":31}`,
			wantErr: "duration must be between",
		},
		{
			name:    "duration below min rejected",
			body:    `{"model":"w3.0-video-special","prompt":"x","duration":1}`,
			wantErr: "duration must be between",
		},
		{
			name:    "reference_images over max rejected",
			body:    `{"model":"w3.0-video-special","prompt":"x","reference_images":["a","b","c","d","e","f","g","h","i","j","k"]}`,
			wantErr: "exceeds the maximum",
		},
		{
			name:    "standalone last_frame rejected",
			body:    `{"model":"w3.0-video-special","last_frame":"https://img/a.jpg"}`,
			wantErr: "last_frame requires first_frame",
		},
		{
			name: "first+last frames accepted",
			body: `{"model":"w3.0-video-special","first_frame":"https://img/a.jpg","last_frame":"https://img/b.jpg","prompt":"pan"}`,
		},
		{
			name:    "unsupported ratio rejected",
			body:    `{"model":"w3.0-video-special","prompt":"x","ratio":"21:9"}`,
			wantErr: "unsupported ratio",
		},
		{
			name:    "seed out of range rejected",
			body:    `{"model":"w3.0-video-special","prompt":"x","seed":-1}`,
			wantErr: "seed must be between",
		},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			c := newJSONContext(t, tc.body)
			taskErr := a.ValidateRequestAndSetAction(c, newInfo())
			if tc.wantErr == "" {
				require.Nil(t, taskErr)
				return
			}
			require.NotNil(t, taskErr)
			assert.Contains(t, taskErr.Message, tc.wantErr)
		})
	}
}

func TestEstimateBilling(t *testing.T) {
	a := &TaskAdaptor{}
	tests := []struct {
		name         string
		body         string
		wantResRatio float64
		wantDuration float64
	}{
		{
			name:         "standard model default 1080P multiplies resolution 2.0",
			body:         `{"model":"w3.0-video-special","prompt":"cat","duration":10}`,
			wantResRatio: 2.0,
			wantDuration: 10,
		},
		{
			name:         "standard model 720P uses 1.5",
			body:         `{"model":"w3.0-video-special","prompt":"cat","resolution":"720P","duration":5}`,
			wantResRatio: 1.5,
			wantDuration: 5,
		},
		{
			name:         "pro model 4K uses 2.4",
			body:         `{"model":"w3.0-video-pro-special","prompt":"cat","resolution":"4K","duration":8}`,
			wantResRatio: 2.4,
			wantDuration: 8,
		},
		{
			name:         "pro model default 1080P uses 1.0",
			body:         `{"model":"w3.0-video-pro-special","prompt":"cat","duration":12}`,
			wantResRatio: 1.0,
			wantDuration: 12,
		},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			c := newJSONContext(t, tc.body)
			taskErr := a.ValidateRequestAndSetAction(c, newInfo())
			require.Nil(t, taskErr)

			ratios := a.EstimateBilling(c, newInfo())
			require.NotNil(t, ratios)
			assert.InDelta(t, tc.wantResRatio, ratios["resolution"], 1e-9)
			assert.InDelta(t, tc.wantDuration, ratios["duration"], 1e-9)
		})
	}
}
