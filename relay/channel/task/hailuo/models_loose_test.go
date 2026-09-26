package hailuo

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

// The MiniMax file-retrieve endpoint returns `file_id` as an opaque string.
// Before LooseString this failed to unmarshal into FileID (declared int64),
// which made buildVideoURL bail out and left the task's ResultURL pointing at
// new-api's own /v1/videos/{id}/content route — i.e. a self-referential proxy
// loop that answered 410 artifact_gone.
const hubRetrieveStringID = `{
  "file": {
    "download_url": "https://cdn.hailuoai.video/moss/prod/2026-09-19-02/video/1789757930459131997-557430115759022080.mp4",
    "file_id": "L8ONzGzOpqzD"
  }
}`

// Older deployments returned a numeric id; that shape must keep working.
const hubRetrieveNumericID = `{
  "file": {
    "file_id": 1789757930459131997,
    "download_url": "https://example.invalid/v.mp4"
  },
  "base_resp": {"status_code": 0, "status_msg": "success"}
}`

func TestRetrieveFileResponseAcceptsStringFileID(t *testing.T) {
	var resp RetrieveFileResponse
	if err := common.Unmarshal([]byte(hubRetrieveStringID), &resp); err != nil {
		t.Fatalf("string file_id must unmarshal, got: %v", err)
	}
	if got := resp.File.FileID.String(); got != "L8ONzGzOpqzD" {
		t.Fatalf("FileID = %q, want %q", got, "L8ONzGzOpqzD")
	}
	if resp.File.DownloadURL == "" {
		t.Fatal("DownloadURL must survive the unmarshal; an empty URL is what caused artifact_gone")
	}
	// base_resp is absent from the hub payload; a zero value means success.
	if resp.BaseResp.StatusCode != StatusSuccess {
		t.Fatalf("StatusCode = %d, want %d", resp.BaseResp.StatusCode, StatusSuccess)
	}
}

func TestRetrieveFileResponseAcceptsNumericFileID(t *testing.T) {
	var resp RetrieveFileResponse
	if err := common.Unmarshal([]byte(hubRetrieveNumericID), &resp); err != nil {
		t.Fatalf("numeric file_id must unmarshal, got: %v", err)
	}
	if got := resp.File.FileID.String(); got != "1789757930459131997" {
		t.Fatalf("FileID = %q, want %q", got, "1789757930459131997")
	}
	if resp.File.DownloadURL != "https://example.invalid/v.mp4" {
		t.Fatalf("DownloadURL = %q", resp.File.DownloadURL)
	}
}
