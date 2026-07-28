package model

import (
	"time"

	"gorm.io/gorm"
)

// ModelHealthSummary represents overall health statistics
type ModelHealthSummary struct {
	MonitoredModels int     `json:"monitored_models"`
	HealthyModels   int     `json:"healthy_models"`
	OverallSuccess  float64 `json:"overall_success_rate"`
	TotalTokens     int64   `json:"total_tokens"`
	ExcellentModels int     `json:"excellent_models"`
}

// ModelHealthTimeline represents hourly health data for a model
type ModelHealthTimeline struct {
	Hour        int64   `json:"hour"`
	Requests    int64   `json:"requests"`
	Success     int64   `json:"success"`
	Failed      int64   `json:"failed"`
	SuccessRate float64 `json:"success_rate"`
}

// ModelHealthDetail represents detailed health data for a single model
type ModelHealthDetail struct {
	ModelName        string                 `json:"model_name"`
	SuccessRate      float64                `json:"success_rate"`
	TotalTokens      int64                  `json:"total_tokens"`
	TotalRequests    int64                  `json:"total_requests"`
	SuccessCount     int64                  `json:"success_count"`
	FailedCount      int64                  `json:"failed_count"`
	AvgLatency       int                    `json:"avg_latency_ms"`
	AvgTTFT          int                    `json:"avg_ttft_ms"`
	Timeline         []ModelHealthTimeline  `json:"timeline"`
	TopErrors        []ModelHealthError     `json:"top_errors,omitempty"`
}

// ModelHealthError represents error statistics
type ModelHealthError struct {
	ErrorType string `json:"error_type"`
	Count     int64  `json:"count"`
}

// ModelHealthResponse represents the API response
type ModelHealthResponse struct {
	Summary ModelHealthSummary   `json:"summary"`
	Models  []ModelHealthDetail  `json:"models"`
}

// GetModelHealth retrieves model health statistics for the specified time range
func GetModelHealth(hours int) (*ModelHealthResponse, error) {
	now := time.Now().Unix()
	startTime := now - int64(hours*3600)

	// Get summary statistics
	summary, err := getModelHealthSummary(startTime, now)
	if err != nil {
		return nil, err
	}

	// Get per-model statistics with timeline
	models, err := getModelHealthDetails(startTime, now, hours)
	if err != nil {
		return nil, err
	}

	return &ModelHealthResponse{
		Summary: summary,
		Models:  models,
	}, nil
}

func getModelHealthSummary(startTime, endTime int64) (ModelHealthSummary, error) {
	var summary ModelHealthSummary

	// Count monitored models (models with at least one request)
	type ModelCount struct {
		Count int
	}
	var monitoredCount ModelCount
	err := LOG_DB.Raw(`
		SELECT COUNT(DISTINCT model_name) as count
		FROM logs
		WHERE created_at >= ? AND created_at <= ?
		AND type IN (?, ?)
	`, startTime, endTime, LogTypeConsume, LogTypeError).Scan(&monitoredCount).Error
	if err != nil {
		return summary, err
	}
	summary.MonitoredModels = monitoredCount.Count

	// Calculate overall success rate and count healthy/excellent models
	type ModelStats struct {
		ModelName   string
		Success     int64
		Failed      int64
		TotalTokens int64
	}
	var modelStats []ModelStats
	err = LOG_DB.Raw(`
		SELECT 
			model_name,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) as success,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) as failed,
			SUM(CASE WHEN type = ? THEN prompt_tokens + completion_tokens ELSE 0 END) as total_tokens
		FROM logs
		WHERE created_at >= ? AND created_at <= ?
		AND type IN (?, ?)
		GROUP BY model_name
	`, LogTypeConsume, LogTypeError, LogTypeConsume, startTime, endTime, LogTypeConsume, LogTypeError).Scan(&modelStats).Error
	if err != nil {
		return summary, err
	}

	var totalSuccess int64
	var totalFailed int64
	var totalTokens int64
	healthyCount := 0
	excellentCount := 0

	for _, stat := range modelStats {
		totalSuccess += stat.Success
		totalFailed += stat.Failed
		totalTokens += stat.TotalTokens

		total := stat.Success + stat.Failed
		if total > 0 {
			successRate := float64(stat.Success) / float64(total) * 100
			if successRate >= 80 {
				healthyCount++
			}
			if successRate >= 95 {
				excellentCount++
			}
		}
	}

	summary.HealthyModels = healthyCount
	summary.ExcellentModels = excellentCount
	summary.TotalTokens = totalTokens

	totalRequests := totalSuccess + totalFailed
	if totalRequests > 0 {
		summary.OverallSuccess = float64(totalSuccess) / float64(totalRequests) * 100
	}

	return summary, nil
}

func getModelHealthDetails(startTime, endTime int64, hours int) ([]ModelHealthDetail, error) {
	// Get all enabled models first
	enabledModels := GetEnabledModels()
	
	// Get per-model aggregated stats from logs
	type ModelAggregate struct {
		ModelName    string
		Success      int64
		Failed       int64
		TotalTokens  int64
		TotalLatency int64
		TotalTTFT    int64
		TTFTCount    int64
	}

	var aggregates []ModelAggregate
	err := LOG_DB.Raw(`
		SELECT 
			model_name,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) as success,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) as failed,
			SUM(CASE WHEN type = ? THEN prompt_tokens + completion_tokens ELSE 0 END) as total_tokens,
			SUM(CASE WHEN type = ? THEN use_time ELSE 0 END) as total_latency,
			0 as total_ttft,
			0 as ttft_count
		FROM logs
		WHERE created_at >= ? AND created_at <= ?
		AND type IN (?, ?)
		GROUP BY model_name
		ORDER BY (SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) + SUM(CASE WHEN type = ? THEN 1 ELSE 0 END)) DESC
	`, LogTypeConsume, LogTypeError, LogTypeConsume, LogTypeConsume, startTime, endTime, LogTypeConsume, LogTypeError, LogTypeConsume, LogTypeError).Scan(&aggregates).Error
	if err != nil {
		return nil, err
	}

	// Create a map of models with data
	modelDataMap := make(map[string]ModelAggregate)
	for _, agg := range aggregates {
		modelDataMap[agg.ModelName] = agg
	}

	// Build result including all enabled models
	models := make([]ModelHealthDetail, 0, len(enabledModels))
	
	// First add models with data (sorted by request count)
	for _, agg := range aggregates {
		total := agg.Success + agg.Failed
		
		detail := ModelHealthDetail{
			ModelName:     agg.ModelName,
			TotalRequests: total,
			SuccessCount:  agg.Success,
			FailedCount:   agg.Failed,
			TotalTokens:   agg.TotalTokens,
		}

		if total > 0 {
			detail.SuccessRate = float64(agg.Success) / float64(total) * 100
		}

		if agg.Success > 0 {
			detail.AvgLatency = int(agg.TotalLatency / agg.Success)
		}
		if agg.TTFTCount > 0 {
			detail.AvgTTFT = int(agg.TotalTTFT / agg.TTFTCount)
		}

		// Get hourly timeline
		timeline, err := getModelTimeline(agg.ModelName, startTime, endTime, hours)
		if err != nil {
			return nil, err
		}
		detail.Timeline = timeline

		models = append(models, detail)
	}
	
	// Then add enabled models without data
	for _, modelName := range enabledModels {
		if _, exists := modelDataMap[modelName]; !exists {
			// Create empty timeline for models without data
			emptyTimeline := make([]ModelHealthTimeline, hours)
			for i := 0; i < hours; i++ {
				hourStart := endTime - int64((hours-i)*3600)
				emptyTimeline[i] = ModelHealthTimeline{
					Hour:        hourStart,
					Requests:    0,
					Success:     0,
					Failed:      0,
					SuccessRate: 0,
				}
			}
			
			models = append(models, ModelHealthDetail{
				ModelName:     modelName,
				SuccessRate:   0,
				TotalTokens:   0,
				TotalRequests: 0,
				SuccessCount:  0,
				FailedCount:   0,
				AvgLatency:    0,
				AvgTTFT:       0,
				Timeline:      emptyTimeline,
			})
		}
	}

	return models, nil
}

func getModelTimeline(modelName string, startTime, endTime int64, hours int) ([]ModelHealthTimeline, error) {
	// Calculate hour boundaries
	hourSeconds := int64(3600)
	
	// Generate all hours in the range
	timeline := make([]ModelHealthTimeline, hours)
	for i := 0; i < hours; i++ {
		hourStart := endTime - int64((hours-i)*3600)
		timeline[i] = ModelHealthTimeline{
			Hour:     hourStart,
			Requests: 0,
			Success:  0,
			Failed:   0,
		}
	}

	// Query hourly aggregates
	type HourlyStats struct {
		HourBucket int64
		Success    int64
		Failed     int64
	}

	var hourlyStats []HourlyStats
	
	// Use FLOOR division to bucket by hour
	err := LOG_DB.Raw(`
		SELECT 
			FLOOR((created_at / ?) * ?) as hour_bucket,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) as success,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) as failed
		FROM logs
		WHERE model_name = ?
		AND created_at >= ? AND created_at <= ?
		AND type IN (?, ?)
		GROUP BY hour_bucket
		ORDER BY hour_bucket
	`, hourSeconds, hourSeconds, LogTypeConsume, LogTypeError, modelName, startTime, endTime, LogTypeConsume, LogTypeError).Scan(&hourlyStats).Error
	if err != nil {
		return nil, err
	}

	// Map hourly stats to timeline
	statsMap := make(map[int64]HourlyStats)
	for _, stat := range hourlyStats {
		statsMap[stat.HourBucket] = stat
	}

	for i := range timeline {
		if stat, exists := statsMap[timeline[i].Hour]; exists {
			timeline[i].Success = stat.Success
			timeline[i].Failed = stat.Failed
			timeline[i].Requests = stat.Success + stat.Failed
			
			if timeline[i].Requests > 0 {
				timeline[i].SuccessRate = float64(timeline[i].Success) / float64(timeline[i].Requests) * 100
			}
		}
	}

	return timeline, nil
}

// GetModelHealthDetailWithErrors retrieves detailed health info including top errors
func GetModelHealthDetailWithErrors(modelName string, hours int) (*ModelHealthDetail, error) {
	now := time.Now().Unix()
	startTime := now - int64(hours*3600)

	models, err := getModelHealthDetails(startTime, now, hours)
	if err != nil {
		return nil, err
	}

	// Find the model
	var detail *ModelHealthDetail
	for i := range models {
		if models[i].ModelName == modelName {
			detail = &models[i]
			break
		}
	}

	if detail == nil {
		return nil, gorm.ErrRecordNotFound
	}

	// Get top error types
	topErrors, err := getTopErrors(modelName, startTime, now)
	if err != nil {
		return nil, err
	}
	detail.TopErrors = topErrors

	return detail, nil
}

func getTopErrors(modelName string, startTime, endTime int64) ([]ModelHealthError, error) {
	var errors []ModelHealthError

	// Parse error content from logs
	type ErrorCount struct {
		Content string
		Count   int64
	}

	var errorCounts []ErrorCount
	err := LOG_DB.Raw(`
		SELECT content, COUNT(*) as count
		FROM logs
		WHERE model_name = ?
		AND created_at >= ? AND created_at <= ?
		AND type = ?
		AND content != ''
		GROUP BY content
		ORDER BY count DESC
		LIMIT 10
	`, modelName, startTime, endTime, LogTypeError).Scan(&errorCounts).Error
	if err != nil {
		return nil, err
	}

	for _, ec := range errorCounts {
		// Extract error type from content
		errorType := extractErrorType(ec.Content)
		errors = append(errors, ModelHealthError{
			ErrorType: errorType,
			Count:     ec.Count,
		})
	}

	return errors, nil
}

func extractErrorType(content string) string {
	// Simple error type extraction - can be enhanced
	if len(content) > 50 {
		return content[:50] + "..."
	}
	return content
}
