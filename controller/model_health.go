package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetModelHealth returns model health statistics
// GET /api/admin/model-health?range=24h
func GetModelHealth(c *gin.Context) {
	rangeParam := c.DefaultQuery("range", "24h")
	
	// Parse range parameter
	hours := 24
	switch rangeParam {
	case "1h":
		hours = 1
	case "6h":
		hours = 6
	case "24h":
		hours = 24
	case "7d":
		hours = 168
	case "30d":
		hours = 720
	default:
		// Try parsing as integer
		if h, err := strconv.Atoi(rangeParam); err == nil && h > 0 && h <= 720 {
			hours = h
		}
	}

	// Get health data
	data, err := model.GetModelHealth(hours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to retrieve model health data: " + err.Error(),
		})
		return
	}

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

	rangeParam := c.DefaultQuery("range", "24h")
	hours := 24
	switch rangeParam {
	case "1h":
		hours = 1
	case "6h":
		hours = 6
	case "24h":
		hours = 24
	case "7d":
		hours = 168
	case "30d":
		hours = 720
	}

	// Get detailed health data with errors
	data, err := model.GetModelHealthDetailWithErrors(modelName, hours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to retrieve model detail: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}
