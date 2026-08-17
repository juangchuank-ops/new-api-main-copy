package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// GetAutoPriceSyncStatus 返回 Auto Price Sync 的配置与运行状态。
func GetAutoPriceSyncStatus(c *gin.Context) {
	view, err := service.GetAutoPriceSyncStatus()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    view,
	})
}

// UpdateAutoPriceSyncConfig 更新 Auto Price Sync 的启用状态与定价源。
func UpdateAutoPriceSyncConfig(c *gin.Context) {
	var req struct {
		Enabled bool                          `json:"enabled"`
		Source  *service.PricingSourceDescriptor `json:"source"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.UpdateAutoPriceSyncConfig(req.Enabled, req.Source); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// GetAutoModelSyncStatus 返回 Auto Model Metadata Sync 的配置与运行状态。
func GetAutoModelSyncStatus(c *gin.Context) {
	view, err := service.GetAutoModelSyncStatus()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    view,
	})
}

// UpdateAutoModelSyncConfig 更新 Auto Model Metadata Sync 的启用状态。
func UpdateAutoModelSyncConfig(c *gin.Context) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.UpdateAutoModelSyncConfig(req.Enabled); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}
