package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// ModelHealthSummary represents overall health statistics
type ModelHealthSummary struct {
	MonitoredModels int     `json:"monitored_models"`
	HealthyModels   int     `json:"healthy_models"`
	OverallSuccess  float64 `json:"overall_success_rate"`
	TotalRequests   int64   `json:"total_requests"`
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
	Group         string                `json:"group"`
	ModelName     string                `json:"model_name"`
	SuccessRate   float64               `json:"success_rate"`
	TotalTokens   int64                 `json:"total_tokens"`
	TotalRequests int64                 `json:"total_requests"`
	SuccessCount  int64                 `json:"success_count"`
	FailedCount   int64                 `json:"failed_count"`
	AvgLatency    int                   `json:"avg_latency_ms"`
	AvgTTFT       *int64                `json:"avg_ttft_ms"`
	AvgTPS        *float64              `json:"avg_tps"`
	Timeline      []ModelHealthTimeline `json:"timeline"`
	TopErrors     []ModelHealthError    `json:"top_errors,omitempty"`
}

// ModelHealthError represents error statistics
type ModelHealthError struct {
	ErrorType string `json:"error_type"`
	Count     int64  `json:"count"`
}

// ModelHealthResponse represents the API response
type ModelHealthResponse struct {
	Summary ModelHealthSummary  `json:"summary"`
	Models  []ModelHealthDetail `json:"models"`
	Groups  []string            `json:"groups"`
}

// GetModelHealth retrieves model health statistics for the specified time range
func GetModelHealth(hours int) (*ModelHealthResponse, error) {
	return GetModelHealthForGroups(hours, nil)
}

// GetModelHealthForGroups limits health data to the supplied usable groups.
// A nil group slice keeps the legacy all-groups behavior; an empty slice
// intentionally returns no model data.
func GetModelHealthForGroups(hours int, groups []string) (*ModelHealthResponse, error) {
	now := time.Now().Unix()
	startTime := now - int64(hours*3600)

	aggregates, err := getModelHealthAggregates(startTime, now, groups)
	if err != nil {
		return nil, err
	}
	models := make([]ModelHealthDetail, len(aggregates))
	for i, detail := range aggregates {
		timeline, err := getModelTimeline(detail.Group, detail.ModelName, startTime, now, hours)
		if err != nil {
			return nil, err
		}
		detail.Timeline = timeline
		models[i] = detail
	}
	models = addEnabledModelsWithoutRequests(models, now, hours, groups)

	return &ModelHealthResponse{
		Summary: summarizeModelHealth(models),
		Models:  models,
		Groups:  append([]string(nil), groups...),
	}, nil
}

func summarizeModelHealth(models []ModelHealthDetail) ModelHealthSummary {
	var summary ModelHealthSummary
	var totalSuccess int64
	var totalFailed int64

	for _, detail := range models {
		totalSuccess += detail.SuccessCount
		totalFailed += detail.FailedCount
		summary.TotalTokens += detail.TotalTokens
		if detail.TotalRequests > 0 && detail.SuccessRate >= 80 {
			summary.HealthyModels++
		}
		if detail.TotalRequests > 0 && detail.SuccessRate >= 95 {
			summary.ExcellentModels++
		}
	}

	summary.MonitoredModels = len(models)
	summary.TotalRequests = totalSuccess + totalFailed
	if summary.TotalRequests > 0 {
		summary.OverallSuccess = float64(totalSuccess) / float64(summary.TotalRequests) * 100
	}
	return summary
}

func getModelHealthAggregates(startTime, endTime int64, groups []string) ([]ModelHealthDetail, error) {
	type ModelAggregate struct {
		HealthGroup  string
		ModelName    string
		Success      int64
		Failed       int64
		TotalTokens  int64
		TotalLatency int64
	}

	var aggregates []ModelAggregate
	groupExpression := modelHealthGroupExpression()
	selectExpression := fmt.Sprintf(`
		%s AS health_group,
		model_name,
		SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success,
		SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS failed,
		COALESCE(SUM(CASE WHEN type = ? THEN COALESCE(prompt_tokens, 0) + COALESCE(completion_tokens, 0) ELSE 0 END), 0) AS total_tokens,
		COALESCE(SUM(CASE WHEN type = ? THEN COALESCE(use_time, 0) ELSE 0 END), 0) AS total_latency
	`, groupExpression)

	query := LOG_DB.Table("logs").
		Select(selectExpression, LogTypeConsume, LogTypeError, LogTypeConsume, LogTypeConsume).
		Where("created_at >= ? AND created_at <= ?", startTime, endTime).
		Where("type IN ?", []int{LogTypeConsume, LogTypeError})
	query = applyModelHealthGroupFilter(query, groups)
	err := query.
		Group(groupExpression + ", model_name").
		Order("COUNT(*) DESC").
		Scan(&aggregates).Error
	if err != nil {
		return nil, err
	}

	models := make([]ModelHealthDetail, 0, len(aggregates))
	for _, agg := range aggregates {
		total := agg.Success + agg.Failed
		detail := ModelHealthDetail{
			Group:         agg.HealthGroup,
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

		models = append(models, detail)
	}
	return models, nil
}

func addEnabledModelsWithoutRequests(models []ModelHealthDetail, endTime int64, hours int, groups []string) []ModelHealthDetail {
	modelIndexes := make(map[string]struct{}, len(models))
	for _, detail := range models {
		modelIndexes[modelHealthKey(detail.Group, detail.ModelName)] = struct{}{}
	}
	for _, ability := range GetAllEnableAbilities() {
		group := ability.Group
		if group == "" {
			group = "default"
		}
		if !modelHealthGroupAllowed(group, groups) {
			continue
		}
		key := modelHealthKey(group, ability.Model)
		if _, ok := modelIndexes[key]; ok {
			continue
		}
		models = append(models, ModelHealthDetail{
			Group:     group,
			ModelName: ability.Model,
			Timeline:  newModelHealthTimeline(endTime, hours),
		})
		modelIndexes[key] = struct{}{}
	}
	return models
}

func modelHealthKey(group, modelName string) string {
	return group + "\x00" + modelName
}

func modelHealthGroupAllowed(group string, groups []string) bool {
	if groups == nil {
		return true
	}
	for _, allowedGroup := range groups {
		if group == allowedGroup {
			return true
		}
	}
	return false
}

func getModelTimeline(group, modelName string, startTime, endTime int64, hours int) ([]ModelHealthTimeline, error) {
	timeline := newModelHealthTimeline(endTime, hours)

	// Query hourly aggregates
	type HourlyStats struct {
		HourBucket int64
		Success    int64
		Failed     int64
	}

	var hourlyStats []HourlyStats

	bucketExpression := modelHealthBucketExpression(modelHealthBucketSeconds(hours))
	selectExpression := fmt.Sprintf(`
		%s AS hour_bucket,
		SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success,
		SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS failed
	`, bucketExpression)
	query := LOG_DB.Table("logs").
		Select(selectExpression, LogTypeConsume, LogTypeError).
		Where("model_name = ?", modelName).
		Where("created_at >= ? AND created_at <= ?", startTime, endTime).
		Where("type IN ?", []int{LogTypeConsume, LogTypeError})
	if group != "" {
		query = applyModelHealthGroupFilter(query, []string{group})
	}
	err := query.Group(bucketExpression).Order("hour_bucket").Scan(&hourlyStats).Error
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

func newModelHealthTimeline(endTime int64, hours int) []ModelHealthTimeline {
	if hours <= 0 {
		return []ModelHealthTimeline{}
	}

	bucketSeconds := modelHealthBucketSeconds(hours)
	pointCount := int((int64(hours)*3600 + bucketSeconds - 1) / bucketSeconds)
	timeline := make([]ModelHealthTimeline, pointCount)
	currentBucketStart := endTime / bucketSeconds * bucketSeconds
	firstBucketStart := currentBucketStart - int64(pointCount-1)*bucketSeconds
	for i := range timeline {
		timeline[i].Hour = firstBucketStart + int64(i)*bucketSeconds
	}
	return timeline
}

func modelHealthBucketSeconds(hours int) int64 {
	switch {
	case hours <= 1:
		return 5 * 60
	case hours <= 6:
		return 15 * 60
	case hours <= 24:
		return 30 * 60
	default:
		bucketHours := (hours + 47) / 48
		return int64(bucketHours) * 3600
	}
}

func modelHealthBucketExpression(bucketSeconds int64) string {
	switch common.LogDatabaseType() {
	case common.DatabaseTypeMySQL:
		return fmt.Sprintf("FLOOR(created_at / %d) * %d", bucketSeconds, bucketSeconds)
	case common.DatabaseTypeClickHouse:
		return fmt.Sprintf("intDiv(created_at, %d) * %d", bucketSeconds, bucketSeconds)
	default:
		return fmt.Sprintf("(created_at / %d) * %d", bucketSeconds, bucketSeconds)
	}
}

func modelHealthGroupExpression() string {
	return fmt.Sprintf("CASE WHEN %s IS NULL OR %s = '' THEN 'default' ELSE %s END", logGroupCol, logGroupCol, logGroupCol)
}

func applyModelHealthGroupFilter(query *gorm.DB, groups []string) *gorm.DB {
	if groups == nil {
		return query
	}
	if len(groups) == 0 {
		return query.Where("1 = 0")
	}

	includeLegacyDefault := false
	for _, group := range groups {
		if group == "default" {
			includeLegacyDefault = true
			break
		}
	}
	if includeLegacyDefault {
		condition := fmt.Sprintf("(%s IN ? OR %s = '' OR %s IS NULL)", logGroupCol, logGroupCol, logGroupCol)
		return query.Where(condition, groups)
	}
	return query.Where(logGroupCol+" IN ?", groups)
}

// GetModelHealthDetailWithErrors retrieves detailed health info including top errors
func GetModelHealthDetailWithErrors(modelName string, hours int) (*ModelHealthDetail, error) {
	now := time.Now().Unix()
	startTime := now - int64(hours*3600)

	models, err := getModelHealthAggregates(startTime, now, nil)
	if err != nil {
		return nil, err
	}

	matchingModels := make([]ModelHealthDetail, 0, len(models))
	for _, detail := range models {
		if detail.ModelName == modelName {
			matchingModels = append(matchingModels, detail)
		}
	}
	if len(matchingModels) == 0 {
		for _, enabledModel := range GetEnabledModels() {
			if enabledModel == modelName {
				matchingModels = append(matchingModels, ModelHealthDetail{ModelName: modelName})
				break
			}
		}
	}
	if len(matchingModels) == 0 {
		return nil, gorm.ErrRecordNotFound
	}

	detail := mergeModelHealthDetails(modelName, matchingModels)
	detail.Timeline, err = getModelTimeline("", modelName, startTime, now, hours)
	if err != nil {
		return nil, err
	}

	// Get top error types
	topErrors, err := getTopErrors(modelName, startTime, now)
	if err != nil {
		return nil, err
	}
	detail.TopErrors = topErrors

	return &detail, nil
}

func mergeModelHealthDetails(modelName string, details []ModelHealthDetail) ModelHealthDetail {
	merged := ModelHealthDetail{ModelName: modelName}
	var totalLatency int64
	for _, detail := range details {
		merged.TotalTokens += detail.TotalTokens
		merged.TotalRequests += detail.TotalRequests
		merged.SuccessCount += detail.SuccessCount
		merged.FailedCount += detail.FailedCount
		totalLatency += int64(detail.AvgLatency) * detail.SuccessCount
	}

	if merged.TotalRequests > 0 {
		merged.SuccessRate = float64(merged.SuccessCount) / float64(merged.TotalRequests) * 100
	}
	if merged.SuccessCount > 0 {
		merged.AvgLatency = int(totalLatency / merged.SuccessCount)
	}
	return merged
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
