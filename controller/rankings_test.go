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

func useRankingsTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Log{}, &model.PerfMetric{}, &model.UserAutoBanRecord{}))
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	// Initialize column names (commonGroupCol etc.) so SQL queries work
	model.InitLogDB()
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.RedisEnabled = previousRedisEnabled
	})
	return db
}

func performRankingRequest(t *testing.T, path string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, path, nil)
	context.Set("id", 1)
	context.Set("role", common.RoleAdminUser)
	return recorder
}

func TestGetRankingAvailabilityReturnsJSON(t *testing.T) {
	useRankingsTestDB(t)
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/rankings/availability?period=week", nil)
	GetRankingAvailability(context)

	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response["success"].(bool))
	data := response["data"].(map[string]interface{})
	require.NotNil(t, data["generated_at"])
	require.NotNil(t, data["models"])
}

func TestGetRankingAvailabilityEmptyData(t *testing.T) {
	useRankingsTestDB(t)
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/rankings/availability?period=today", nil)
	GetRankingAvailability(context)

	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response["success"].(bool))
	data := response["data"].(map[string]interface{})
	models := data["models"].([]interface{})
	require.Equal(t, 0, len(models))
}

func TestGetRankingAvailabilityInvalidPeriod(t *testing.T) {
	useRankingsTestDB(t)
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/rankings/availability?period=invalid", nil)
	GetRankingAvailability(context)

	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response["success"].(bool))
}

func TestGetRankingSecurityReturnsJSON(t *testing.T) {
	useRankingsTestDB(t)
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/rankings/security?period=week", nil)
	context.Set("role", common.RoleAdminUser)
	GetRankingSecurity(context)

	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response["success"].(bool))
	data := response["data"].(map[string]interface{})
	// AutoBan not available → bans should be empty array
	bans := data["bans"].([]interface{})
	require.Equal(t, 0, len(bans))
}

func TestGetRankingSecurityEmptyData(t *testing.T) {
	useRankingsTestDB(t)
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/rankings/security?period=today", nil)
	context.Set("role", common.RoleAdminUser)
	GetRankingSecurity(context)

	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response["success"].(bool))
}

func TestGetRankingSecurityInvalidPeriod(t *testing.T) {
	useRankingsTestDB(t)
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/rankings/security?period=invalid", nil)
	context.Set("role", common.RoleAdminUser)
	GetRankingSecurity(context)

	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response["success"].(bool))
}

func TestGetRankingSecurityInvalidBanSort(t *testing.T) {
	useRankingsTestDB(t)
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/rankings/security?period=week&ban_sort=invalid", nil)
	context.Set("role", common.RoleAdminUser)
	GetRankingSecurity(context)

	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response["success"].(bool))
}

func TestGetRankingSecurityNonAdminNoIPRanking(t *testing.T) {
	useRankingsTestDB(t)
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/rankings/security?period=week", nil)
	context.Set("role", common.RoleCommonUser)
	GetRankingSecurity(context)

	var response map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response["success"].(bool))
	data := response["data"].(map[string]interface{})
	// Non-admin should not get ip_users
	_, hasIPUsers := data["ip_users"]
	require.False(t, hasIPUsers)
}

// Unused but kept for potential future use
var _ = bytes.NewBufferString
