package controller

import (
	"net/http"
	"strconv"

	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

// ModelAvailabilityItem represents availability statistics for a single model
type ModelAvailabilityItem struct {
	ModelName    string  `json:"model_name"`
	SuccessRate  float64 `json:"success_rate"`
	RequestCount int64   `json:"request_count"`
	SuccessCount int64   `json:"success_count"`
	FailureCount int64   `json:"failure_count"`
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	AvgTps       float64 `json:"avg_tps"`
}

// GetModelAvailability returns model availability statistics
// GET /api/model-availability?hours=24
func GetModelAvailability(c *gin.Context) {
	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil && parsed > 0 {
			hours = parsed
		}
	}

	activeGroups := append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
	result, err := perfmetrics.QuerySummaryAll(hours, activeGroups)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// Transform the result to include success/failure counts
	items := make([]ModelAvailabilityItem, 0, len(result.Models))
	for _, model := range result.Models {
		// Calculate success and failure counts from request count and success rate
		successCount := int64(float64(model.RequestCount) * model.SuccessRate / 100.0)
		failureCount := model.RequestCount - successCount

		items = append(items, ModelAvailabilityItem{
			ModelName:    model.ModelName,
			SuccessRate:  model.SuccessRate,
			RequestCount: model.RequestCount,
			SuccessCount: successCount,
			FailureCount: failureCount,
			AvgLatencyMs: model.AvgLatencyMs,
			AvgTps:       model.AvgTps,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"models": items,
			"hours":  hours,
		},
	})
}
