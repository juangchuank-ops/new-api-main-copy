package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func usePricingControllerDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}, &model.Log{}))
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousOptions := common.OptionMap
	previousRedisEnabled := common.RedisEnabled
	model.DB = db
	model.LOG_DB = db
	common.OptionMap = map[string]string{}
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.OptionMap = previousOptions
		common.RedisEnabled = previousRedisEnabled
	})
	require.NoError(t, model.SeedCanonicalPricingOptions())
	return db
}

func performPricingPatch(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPatch, "/api/option/pricing/patch", bytes.NewBufferString(body))
	context.Set("id", 1)
	PatchPricingOptions(context)
	return recorder
}

func TestPricingPatchHandlerSuccess(t *testing.T) {
	usePricingControllerDB(t)
	recorder := performPricingPatch(t, `{"operations":[{"key":"ModelPrice","model":"test-model","action":"set","value":0.5,"expected":{"present":false}}]}`)
	require.Equal(t, http.StatusOK, recorder.Code)

	var response struct {
		Success bool              `json:"success"`
		Data    map[string]string `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Len(t, response.Data, len(model.PricingOptionKeys))
}

func TestPricingPatchHandlerConflictReturns409(t *testing.T) {
	usePricingControllerDB(t)
	// First patch succeeds
	success := performPricingPatch(t, `{"operations":[{"key":"ModelPrice","model":"conflict-model","action":"set","value":1,"expected":{"present":false}}]}`)
	require.Equal(t, http.StatusOK, success.Code)

	// Second patch with stale expected (present:false when it's actually present:true) → 409
	conflict := performPricingPatch(t, `{"operations":[{"key":"ModelPrice","model":"conflict-model","action":"set","value":2,"expected":{"present":false}}]}`)
	require.Equal(t, http.StatusConflict, conflict.Code)

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, json.Unmarshal(conflict.Body.Bytes(), &response))
	require.False(t, response.Success)
	require.Contains(t, response.Message, "conflict")
}

func TestPricingPatchHandlerBadInputReturns400(t *testing.T) {
	usePricingControllerDB(t)
	// Empty operations
	recorder := performPricingPatch(t, `{"operations":[]}`)
	require.Equal(t, http.StatusBadRequest, recorder.Code)

	// Invalid JSON
	recorder = performPricingPatch(t, `not json`)
	require.Equal(t, http.StatusBadRequest, recorder.Code)

	// Invalid key
	recorder = performPricingPatch(t, `{"operations":[{"key":"BadKey","model":"m","action":"set","value":1,"expected":{"present":false}}]}`)
	require.Equal(t, http.StatusBadRequest, recorder.Code)
}

func TestPricingPatchHandlerTooManyOperationsReturns400(t *testing.T) {
	usePricingControllerDB(t)
	// Build a request with > maxPricingPatchOperations operations
	var buf bytes.Buffer
	buf.WriteString(`{"operations":[`)
	for i := 0; i <= maxPricingPatchOperations; i++ {
		if i > 0 {
			buf.WriteByte(',')
		}
		buf.WriteString(`{"key":"ModelRatio","model":"m`)
		buf.WriteByte(byte('a' + i%26))
		buf.WriteString(`","action":"set_if_missing","value":1}`)
	}
	buf.WriteString(`]}`)
	recorder := performPricingPatch(t, buf.String())
	require.Equal(t, http.StatusBadRequest, recorder.Code)
}
