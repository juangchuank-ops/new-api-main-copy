package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetModelHealthHandlesLegacyNullableLogsAndHourlyTimeline(t *testing.T) {
	truncateTables(t)

	now := time.Now().Unix()
	requestTime := now - 30*60
	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "healthy-model",
		ChannelId: 1,
		Enabled:   true,
	}).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "legacy-model",
		ChannelId: 2,
		Enabled:   true,
	}).Error)
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

	hourBucket := requestTime / 3600 * 3600
	for _, point := range healthy.Timeline {
		if point.Hour == hourBucket {
			assert.Equal(t, int64(2), point.Requests)
			assert.Equal(t, int64(1), point.Success)
			assert.Equal(t, int64(1), point.Failed)
			return
		}
	}
	t.Fatalf("timeline did not include hour bucket %d", hourBucket)
}
