package channel

import (
	"context"
	"io"
	"strings"
	"testing"

	common2 "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/glebarez/sqlite"
)

// TestRequestDebugCaptureWriteChain tests the real write → read chain:
// requestDebugCaptureReadCloser.Read() → storeBody() → model.GetRequestDebugBody()
// This verifies that a real request body flows through the capture, gets stored
// in the database, and can be retrieved intact.
func TestRequestDebugCaptureWriteChain(t *testing.T) {
	// Set up in-memory DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	previousDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })
	require.NoError(t, db.AutoMigrate(&model.RequestDebugBodyRecord{}, &model.RequestDebugBodyChunk{}))

	// Simulate a JSON request body
	payload := `{"model":"gpt-4","messages":[{"role":"user","content":"Hello, world!"}],"stream":true}`
	contentType := "application/json"
	requestID := "test-capture-write-chain-001"

	// Create the capture wrapper around the body reader (same as doRequest does)
	capture := &requestDebugCaptureReadCloser{
		ReadCloser: io.NopCloser(strings.NewReader(payload)),
	}

	// Read all bytes — this is what client.Do(req) does internally
	consumed, err := io.ReadAll(capture)
	require.NoError(t, err)
	require.Equal(t, payload, string(consumed), "capture must not alter the upstream request stream")

	// Store the captured body (same as doRequest calls after client.Do)
	err = capture.storeBody(context.Background(), requestID, contentType, int64(len(payload)), nil)
	require.NoError(t, err)

	// Retrieve it back via the model (same as controller.GetRequestDebugBody calls)
	stored, err := model.GetRequestDebugBody(context.Background(), requestID)
	require.NoError(t, err)
	require.Equal(t, payload, string(stored.Data))
	require.Equal(t, int64(len(payload)), stored.BodyBytes)
	require.Equal(t, contentType, stored.ContentType)
	require.Equal(t, "gzip", stored.Compression)
	require.False(t, stored.BodyTruncated)

	// Verify chunks were created
	var chunkCount int64
	require.NoError(t, db.Model(&model.RequestDebugBodyChunk{}).Where("request_id = ?", requestID).Count(&chunkCount).Error)
	require.GreaterOrEqual(t, chunkCount, int64(1))
}

// TestRequestDebugCaptureBoundsStoredBody verifies that the capture respects
// the RequestDebugBodyMaxBytes limit and marks the body as truncated.
func TestRequestDebugCaptureBoundsStoredBody(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	previousDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })
	require.NoError(t, db.AutoMigrate(&model.RequestDebugBodyRecord{}, &model.RequestDebugBodyChunk{}))

	// Create a payload larger than RequestDebugBodyMaxBytes
	oversized := strings.Repeat("A", int(model.RequestDebugBodyMaxBytes+1000))
	requestID := "test-capture-bounded-002"

	capture := &requestDebugCaptureReadCloser{
		ReadCloser: io.NopCloser(strings.NewReader(oversized)),
	}
	consumed, err := io.ReadAll(capture)
	require.NoError(t, err)
	require.Equal(t, oversized, string(consumed), "upstream stream must be fully consumed regardless of capture limit")

	err = capture.storeBody(context.Background(), requestID, "text/plain", int64(len(oversized)), nil)
	require.NoError(t, err)

	stored, err := model.GetRequestDebugBody(context.Background(), requestID)
	require.NoError(t, err)
	require.True(t, stored.BodyTruncated, "body should be marked as truncated")
	require.Equal(t, model.RequestDebugBodyMaxBytes, int64(len(stored.Data)), "stored data should be capped at max")
}

// TestRequestDebugCaptureEmptyBody verifies that an empty request body
// is handled gracefully.
func TestRequestDebugCaptureEmptyBody(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	previousDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })
	require.NoError(t, db.AutoMigrate(&model.RequestDebugBodyRecord{}, &model.RequestDebugBodyChunk{}))

	requestID := "test-capture-empty-003"
	capture := &requestDebugCaptureReadCloser{
		ReadCloser: io.NopCloser(strings.NewReader("")),
	}
	consumed, err := io.ReadAll(capture)
	require.NoError(t, err)
	require.Empty(t, consumed)

	err = capture.storeBody(context.Background(), requestID, "application/json", 0, nil)
	require.NoError(t, err)

	stored, err := model.GetRequestDebugBody(context.Background(), requestID)
	require.NoError(t, err)
	require.Empty(t, stored.Data)
	require.Equal(t, int64(0), stored.BodyBytes)
	require.False(t, stored.BodyTruncated)
}

// TestRequestDebugRepresentation verifies the common.RequestDebugBodyRepresentation
// function used by the controller to format the API response.
func TestRequestDebugRepresentation(t *testing.T) {
	// JSON body should be returned as readable text
	jsonBody := []byte(`{"key":"value"}`)
	result := common2.RequestDebugBodyRepresentation(jsonBody, "application/json", false)
	require.Equal(t, string(jsonBody), result["body"])
	require.False(t, result["body_truncated"].(bool))
	_, hasEncoding := result["body_encoding"]
	require.False(t, hasEncoding, "textual body should not have base64 encoding")

	// Truncated textual body should be marked
	truncated := common2.RequestDebugBodyRepresentation(jsonBody, "application/json", true)
	require.True(t, truncated["body_truncated"].(bool))
}
