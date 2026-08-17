package controller

import (
	"net/http"
	"sort"
	"strconv"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// GetModelHealth returns model health statistics
// GET /api/admin/model-health?range=24h
func GetModelHealth(c *gin.Context) {
	hours := parseModelHealthHours(c.DefaultQuery("range", "24h"))
	userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	usableGroups := service.GetUserUsableGroups(userGroup)
	availableGroups := make([]string, 0, len(usableGroups))
	for group := range usableGroups {
		if group != "" {
			availableGroups = append(availableGroups, group)
		}
	}
	sort.Strings(availableGroups)

	queryGroups := availableGroups
	if selectedGroup := c.Query("group"); selectedGroup != "" {
		if _, ok := usableGroups[selectedGroup]; !ok {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "Selected group is not available to the current user",
			})
			return
		}
		queryGroups = []string{selectedGroup}
	}

	data, err := model.GetModelHealthForGroups(hours, queryGroups)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to retrieve model health data: " + err.Error(),
		})
		return
	}
	data.Groups = availableGroups
	var waitGroup sync.WaitGroup
	for i := range data.Models {
		waitGroup.Add(1)
		go func(detail *model.ModelHealthDetail) {
			defer waitGroup.Done()
			if err := addModelHealthPerformance(detail, hours); err != nil {
				common.SysError("failed to retrieve model performance data: " + err.Error())
			}
		}(&data.Models[i])
	}
	waitGroup.Wait()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

// GetModelHealthDetail returns detailed health info for a specific model
// GET /api/admin/model-health/:model
func GetModelHealthDetail(c *gin.Context) {
	modelName := c.Param("model")
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Model name is required",
		})
		return
	}

	hours := parseModelHealthHours(c.DefaultQuery("range", "24h"))

	// Get detailed health data with errors
	data, err := model.GetModelHealthDetailWithErrors(modelName, hours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to retrieve model detail: " + err.Error(),
		})
		return
	}
	if err := addModelHealthPerformance(data, hours); err != nil {
		common.SysError("failed to retrieve model performance data: " + err.Error())
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

func parseModelHealthHours(value string) int {
	switch value {
	case "1h":
		return 1
	case "6h":
		return 6
	case "24h":
		return 24
	case "7d":
		return 168
	case "30d":
		return 720
	default:
		hours, err := strconv.Atoi(value)
		if err == nil && hours > 0 && hours <= 720 {
			return hours
		}
		return 24
	}
}

func addModelHealthPerformance(detail *model.ModelHealthDetail, hours int) error {
	result, err := perfmetrics.Query(perfmetrics.QueryParams{
		Model: detail.ModelName,
		Group: detail.Group,
		Hours: hours,
	})
	if err != nil {
		return err
	}

	var ttftSum int64
	var ttftGroupCount int64
	var tpsSum float64
	var tpsGroupCount int64
	for _, group := range result.Groups {
		if detail.Group != "" && group.Group != detail.Group {
			continue
		}
		if group.AvgTtftMs > 0 {
			ttftSum += group.AvgTtftMs
			ttftGroupCount++
		}
		if group.AvgTps > 0 {
			tpsSum += group.AvgTps
			tpsGroupCount++
		}
	}
	if ttftGroupCount > 0 {
		avgTTFT := ttftSum / ttftGroupCount
		detail.AvgTTFT = &avgTTFT
	}
	if tpsGroupCount > 0 {
		avgTPS := tpsSum / float64(tpsGroupCount)
		detail.AvgTPS = &avgTPS
	}
	return nil
}
