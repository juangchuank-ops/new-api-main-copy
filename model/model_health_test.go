package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetModelHealthHandlesLegacyNullableLogsAndHalfHourTimeline(t *testing.T) {
	truncateTables(t)

	now := time.Now().Unix()
	requestTime := now - 30*60
	require.NoError(t, LOG_DB.Create(&Log{
		CreatedAt:        requestTime,
		Type:             LogTypeConsume,
		ModelName:        "healthy-model",
		PromptTokens:     20,
		CompletionTokens: 30,
		UseTime:          200,
	}).Error)
	require.NoError(t, LOG_DB.Create(&Log{
		CreatedAt: requestTime,
		Type:      LogTypeError,
		ModelName: "healthy-model",
	}).Error)

	// Historical log tables can contain NULL metric fields. Health aggregation
	// must treat those values as zero instead of failing to scan a NULL SUM.
	require.NoError(t, LOG_DB.Exec(
		"INSERT INTO logs (created_at, type, model_name, prompt_tokens, completion_tokens, use_time) VALUES (?, ?, ?, NULL, NULL, NULL)",
		requestTime,
		LogTypeConsume,
		"legacy-model",
	).Error)

	response, err := GetModelHealth(24)
	require.NoError(t, err)
	require.Equal(t, 2, response.Summary.MonitoredModels)
	require.Equal(t, int64(50), response.Summary.TotalTokens)

	details := make(map[string]ModelHealthDetail, len(response.Models))
	for _, detail := range response.Models {
		details[detail.ModelName] = detail
	}

	healthy, ok := details["healthy-model"]
	require.True(t, ok)
	assert.Equal(t, int64(2), healthy.TotalRequests)
	assert.Equal(t, int64(1), healthy.SuccessCount)
	assert.Equal(t, int64(1), healthy.FailedCount)
	assert.Equal(t, int64(50), healthy.TotalTokens)
	assert.Equal(t, 200, healthy.AvgLatency)

	legacy, ok := details["legacy-model"]
	require.True(t, ok)
	assert.Equal(t, int64(1), legacy.TotalRequests)
	assert.Equal(t, int64(0), legacy.TotalTokens)
	assert.Equal(t, 0, legacy.AvgLatency)

	require.Len(t, healthy.Timeline, 48)
	bucketSeconds := modelHealthBucketSeconds(24)
	require.Equal(t, int64(30*60), bucketSeconds)
	for i := 1; i < len(healthy.Timeline); i++ {
		assert.Equal(t, bucketSeconds, healthy.Timeline[i].Hour-healthy.Timeline[i-1].Hour)
	}

	requestBucket := requestTime / bucketSeconds * bucketSeconds
	for _, point := range healthy.Timeline {
		if point.Hour == requestBucket {
			assert.Equal(t, int64(2), point.Requests)
			assert.Equal(t, int64(1), point.Success)
			assert.Equal(t, int64(1), point.Failed)
			return
		}
	}
	t.Fatalf("timeline did not include half-hour bucket %d", requestBucket)
}

func TestGetModelHealthForGroupsKeepsSameModelStatsIsolated(t *testing.T) {
	truncateTables(t)

	requestTime := time.Now().Unix() - 10*60
	logs := []Log{
		{
			CreatedAt:        requestTime,
			Type:             LogTypeConsume,
			ModelName:        "shared-model",
			Group:            "default",
			PromptTokens:     10,
			CompletionTokens: 5,
			UseTime:          120,
		},
		{
			CreatedAt: requestTime,
			Type:      LogTypeError,
			ModelName: "shared-model",
			Group:     "default",
		},
		{
			CreatedAt:        requestTime,
			Type:             LogTypeConsume,
			ModelName:        "shared-model",
			Group:            "vip",
			PromptTokens:     40,
			CompletionTokens: 60,
			UseTime:          450,
		},
		{
			CreatedAt: requestTime,
			Type:      LogTypeError,
			ModelName: "hidden-model",
			Group:     "internal",
		},
	}
	for i := range logs {
		require.NoError(t, LOG_DB.Create(&logs[i]).Error)
	}

	defaultResponse, err := GetModelHealthForGroups(24, []string{"default"})
	require.NoError(t, err)
	require.Equal(t, []string{"default"}, defaultResponse.Groups)
	require.Len(t, defaultResponse.Models, 1)
	assert.Equal(t, 1, defaultResponse.Summary.MonitoredModels)
	assert.Equal(t, int64(2), defaultResponse.Summary.TotalRequests)
	assert.Equal(t, int64(15), defaultResponse.Summary.TotalTokens)
	assert.InDelta(t, 50, defaultResponse.Summary.OverallSuccess, 0.001)

	defaultDetail := defaultResponse.Models[0]
	assert.Equal(t, "default", defaultDetail.Group)
	assert.Equal(t, "shared-model", defaultDetail.ModelName)
	assert.Equal(t, int64(2), defaultDetail.TotalRequests)
	assert.Equal(t, int64(1), defaultDetail.SuccessCount)
	assert.Equal(t, int64(1), defaultDetail.FailedCount)
	assert.Equal(t, int64(15), defaultDetail.TotalTokens)
	assert.Equal(t, 120, defaultDetail.AvgLatency)

	vipResponse, err := GetModelHealthForGroups(24, []string{"vip"})
	require.NoError(t, err)
	require.Len(t, vipResponse.Models, 1)
	vipDetail := vipResponse.Models[0]
	assert.Equal(t, "vip", vipDetail.Group)
	assert.Equal(t, "shared-model", vipDetail.ModelName)
	assert.Equal(t, int64(1), vipDetail.TotalRequests)
	assert.Equal(t, int64(1), vipDetail.SuccessCount)
	assert.Equal(t, int64(0), vipDetail.FailedCount)
	assert.Equal(t, int64(100), vipDetail.TotalTokens)
	assert.Equal(t, 450, vipDetail.AvgLatency)

	combinedResponse, err := GetModelHealthForGroups(24, []string{"default", "vip"})
	require.NoError(t, err)
	require.Len(t, combinedResponse.Models, 2)
	assert.Equal(t, 2, combinedResponse.Summary.MonitoredModels)
	assert.Equal(t, int64(3), combinedResponse.Summary.TotalRequests)
	for _, detail := range combinedResponse.Models {
		assert.NotEqual(t, "internal", detail.Group)
		assert.NotEqual(t, "hidden-model", detail.ModelName)
	}

	emptyResponse, err := GetModelHealthForGroups(24, []string{})
	require.NoError(t, err)
	assert.Empty(t, emptyResponse.Models)
	assert.Zero(t, emptyResponse.Summary.TotalRequests)
}

func TestGetModelHealthForGroupsIncludesEnabledModelsWithoutRequests(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "idle-model",
		ChannelId: 1,
		Enabled:   true,
	}).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "internal",
		Model:     "hidden-model",
		ChannelId: 2,
		Enabled:   true,
	}).Error)

	response, err := GetModelHealthForGroups(24, []string{"default"})
	require.NoError(t, err)
	require.Len(t, response.Models, 1)
	assert.Equal(t, "default", response.Models[0].Group)
	assert.Equal(t, "idle-model", response.Models[0].ModelName)
	assert.Zero(t, response.Models[0].TotalRequests)
	assert.Len(t, response.Models[0].Timeline, 48)
	assert.Equal(t, 1, response.Summary.MonitoredModels)
	assert.Zero(t, response.Summary.HealthyModels)
	assert.Zero(t, response.Summary.ExcellentModels)
	assert.Zero(t, response.Summary.TotalRequests)
}

func TestGetModelHealthForDefaultGroupIncludesLegacyEmptyAndNullGroups(t *testing.T) {
	truncateTables(t)

	requestTime := time.Now().Unix() - 5*60
	require.NoError(t, LOG_DB.Create(&Log{
		CreatedAt: requestTime,
		Type:      LogTypeConsume,
		ModelName: "legacy-default-model",
		Group:     "",
	}).Error)
	require.NoError(t, LOG_DB.Table("logs").Create(map[string]interface{}{
		"created_at": requestTime,
		"type":       LogTypeError,
		"model_name": "legacy-default-model",
		"group":      nil,
	}).Error)
	require.NoError(t, LOG_DB.Create(&Log{
		CreatedAt: requestTime,
		Type:      LogTypeConsume,
		ModelName: "vip-model",
		Group:     "vip",
	}).Error)

	response, err := GetModelHealthForGroups(24, []string{"default"})
	require.NoError(t, err)
	require.Len(t, response.Models, 1)
	detail := response.Models[0]
	assert.Equal(t, "default", detail.Group)
	assert.Equal(t, "legacy-default-model", detail.ModelName)
	assert.Equal(t, int64(2), detail.TotalRequests)
	assert.Equal(t, int64(1), detail.SuccessCount)
	assert.Equal(t, int64(1), detail.FailedCount)
}

func TestGetModelHealthDetailMergesSameModelAcrossGroups(t *testing.T) {
	truncateTables(t)

	requestTime := time.Now().Unix() - 5*60
	logs := []Log{
		{
			CreatedAt:        requestTime,
			Type:             LogTypeConsume,
			ModelName:        "shared-model",
			Group:            "default",
			PromptTokens:     5,
			CompletionTokens: 5,
			UseTime:          100,
		},
		{
			CreatedAt:        requestTime,
			Type:             LogTypeConsume,
			ModelName:        "shared-model",
			Group:            "vip",
			PromptTokens:     10,
			CompletionTokens: 20,
			UseTime:          300,
		},
		{
			CreatedAt: requestTime,
			Type:      LogTypeError,
			ModelName: "shared-model",
			Group:     "vip",
			Content:   "upstream unavailable",
		},
	}
	for i := range logs {
		require.NoError(t, LOG_DB.Create(&logs[i]).Error)
	}

	detail, err := GetModelHealthDetailWithErrors("shared-model", 24)
	require.NoError(t, err)
	assert.Empty(t, detail.Group)
	assert.Equal(t, int64(3), detail.TotalRequests)
	assert.Equal(t, int64(2), detail.SuccessCount)
	assert.Equal(t, int64(1), detail.FailedCount)
	assert.Equal(t, int64(40), detail.TotalTokens)
	assert.Equal(t, 200, detail.AvgLatency)
	assert.InDelta(t, 100.0*2.0/3.0, detail.SuccessRate, 0.001)
	require.Len(t, detail.TopErrors, 1)
	assert.Equal(t, "upstream unavailable", detail.TopErrors[0].ErrorType)

	bucketSeconds := modelHealthBucketSeconds(24)
	requestBucket := requestTime / bucketSeconds * bucketSeconds
	for _, point := range detail.Timeline {
		if point.Hour == requestBucket {
			assert.Equal(t, int64(3), point.Requests)
			assert.Equal(t, int64(2), point.Success)
			assert.Equal(t, int64(1), point.Failed)
			assert.InDelta(t, 100.0*2.0/3.0, point.SuccessRate, 0.001)
			return
		}
	}
	t.Fatalf("timeline did not include half-hour bucket %d", requestBucket)
}
