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

func useChannelBatchStatusDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.Log{}, &model.Option{}))
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.RedisEnabled = previousRedisEnabled
	})
	return db
}

func performChannelStatusBatch(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/api/channel/status/batch", bytes.NewBufferString(body))
	context.Set("id", 1)
	BatchUpdateChannelStatus(context)
	return recorder
}

func TestBatchUpdateChannelStatusEmptyIds(t *testing.T) {
	useChannelBatchStatusDB(t)
	recorder := performChannelStatusBatch(t, `{"ids":[],"status":1}`)
	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response["success"].(bool))
}

func TestBatchUpdateChannelStatusInvalidStatus(t *testing.T) {
	useChannelBatchStatusDB(t)
	recorder := performChannelStatusBatch(t, `{"ids":[1],"status":0}`)
	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response["success"].(bool))
}

func TestBatchUpdateChannelStatusInvalidStatusThree(t *testing.T) {
	useChannelBatchStatusDB(t)
	// Status 3 (AutoDisabled) is not manageable
	recorder := performChannelStatusBatch(t, `{"ids":[1],"status":3}`)
	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response["success"].(bool))
}

func TestBatchUpdateChannelStatusSingleEnable(t *testing.T) {
	db := useChannelBatchStatusDB(t)
	// Create a disabled channel
	ch := model.Channel{Id: 1, Name: "test", Status: common.ChannelStatusManuallyDisabled, Type: 1, Key: "k1"}
	require.NoError(t, db.Create(&ch).Error)
	require.NoError(t, db.Create(&model.Ability{ChannelId: 1, Enabled: false}).Error)

	recorder := performChannelStatusBatch(t, `{"ids":[1],"status":1}`)
	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response["success"].(bool))
	require.Equal(t, float64(1), response["data"].(float64))

	// Verify in DB
	var updated model.Channel
	require.NoError(t, db.First(&updated, 1).Error)
	require.Equal(t, common.ChannelStatusEnabled, updated.Status)

	var ability model.Ability
	require.NoError(t, db.First(&ability, "channel_id = ?", 1).Error)
	require.True(t, ability.Enabled)
}

func TestBatchUpdateChannelStatusSingleDisable(t *testing.T) {
	db := useChannelBatchStatusDB(t)
	ch := model.Channel{Id: 1, Name: "test", Status: common.ChannelStatusEnabled, Type: 1, Key: "k1"}
	require.NoError(t, db.Create(&ch).Error)
	require.NoError(t, db.Create(&model.Ability{ChannelId: 1, Enabled: true}).Error)

	recorder := performChannelStatusBatch(t, `{"ids":[1],"status":2}`)
	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response["success"].(bool))
	require.Equal(t, float64(1), response["data"].(float64))

	var updated model.Channel
	require.NoError(t, db.First(&updated, 1).Error)
	require.Equal(t, common.ChannelStatusManuallyDisabled, updated.Status)
}

func TestBatchUpdateChannelStatusMultipleEnable(t *testing.T) {
	db := useChannelBatchStatusDB(t)
	for i := 1; i <= 3; i++ {
		ch := model.Channel{Id: i, Name: "test", Status: common.ChannelStatusManuallyDisabled, Type: 1, Key: "k"}
		require.NoError(t, db.Create(&ch).Error)
		require.NoError(t, db.Create(&model.Ability{ChannelId: i, Enabled: false}).Error)
	}

	recorder := performChannelStatusBatch(t, `{"ids":[1,2,3],"status":1}`)
	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response["success"].(bool))
	require.Equal(t, float64(3), response["data"].(float64))
}

func TestBatchUpdateChannelStatusMultipleDisable(t *testing.T) {
	db := useChannelBatchStatusDB(t)
	for i := 1; i <= 3; i++ {
		ch := model.Channel{Id: i, Name: "test", Status: common.ChannelStatusEnabled, Type: 1, Key: "k"}
		require.NoError(t, db.Create(&ch).Error)
		require.NoError(t, db.Create(&model.Ability{ChannelId: i, Enabled: true}).Error)
	}

	recorder := performChannelStatusBatch(t, `{"ids":[1,2,3],"status":2}`)
	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response["success"].(bool))
	require.Equal(t, float64(3), response["data"].(float64))
}

func TestBatchUpdateChannelStatusNonExistentChannel(t *testing.T) {
	db := useChannelBatchStatusDB(t)
	// Create one real channel
	ch := model.Channel{Id: 1, Name: "real", Status: common.ChannelStatusEnabled, Type: 1, Key: "k"}
	require.NoError(t, db.Create(&ch).Error)
	require.NoError(t, db.Create(&model.Ability{ChannelId: 1, Enabled: true}).Error)

	// Mix real and non-existent IDs; non-existent should be skipped
	recorder := performChannelStatusBatch(t, `{"ids":[1,999,1000],"status":2}`)
	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response["success"].(bool))
	require.Equal(t, float64(1), response["data"].(float64))
}

func TestBatchUpdateChannelStatusSameStatusSkipped(t *testing.T) {
	db := useChannelBatchStatusDB(t)
	// Channel already enabled, trying to enable again → changedCount=0
	ch := model.Channel{Id: 1, Name: "test", Status: common.ChannelStatusEnabled, Type: 1, Key: "k"}
	require.NoError(t, db.Create(&ch).Error)
	require.NoError(t, db.Create(&model.Ability{ChannelId: 1, Enabled: true}).Error)

	recorder := performChannelStatusBatch(t, `{"ids":[1],"status":1}`)
	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response["success"].(bool))
	require.Equal(t, float64(0), response["data"].(float64))
}

func TestBatchUpdateChannelStatusBadJSON(t *testing.T) {
	useChannelBatchStatusDB(t)
	recorder := performChannelStatusBatch(t, `not json`)
	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response["success"].(bool))
}
