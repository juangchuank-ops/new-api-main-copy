package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func ListUpstreamAccounts(c *gin.Context) {
	accounts, err := model.ListUpstreamAccounts()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, accounts)
}

func CreateUpstreamAccount(c *gin.Context) {
	account := &model.UpstreamAccount{}
	if err := c.ShouldBindJSON(account); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.CreateUpstreamAccount(account); err != nil {
		common.ApiError(c, err)
		return
	}
	created, err := model.GetUpstreamAccountById(account.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, created)
}

func UpdateUpstreamAccount(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	account := &model.UpstreamAccount{}
	if err := c.ShouldBindJSON(account); err != nil {
		common.ApiError(c, err)
		return
	}
	account.Id = id
	if err := model.UpdateUpstreamAccount(account); err != nil {
		common.ApiError(c, err)
		return
	}
	updated, err := model.GetUpstreamAccountById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, updated)
}

func DeleteUpstreamAccount(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteUpstreamAccount(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func ListUpstreamAccountLogs(c *gin.Context) {
	accountId, _ := strconv.Atoi(c.Query("account_id"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	logs, err := model.ListUpstreamAccountLogs(accountId, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, logs)
}

func loadUpstreamAccountParam(c *gin.Context) (*model.UpstreamAccount, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return nil, false
	}
	account, err := model.GetUpstreamAccountById(id)
	if err != nil {
		common.ApiError(c, err)
		return nil, false
	}
	return account, true
}

func CheckinUpstreamAccount(c *gin.Context) {
	account, ok := loadUpstreamAccountParam(c)
	if !ok {
		return
	}
	result, err := service.CheckinUpstreamAccount(c.Request.Context(), account, model.UpstreamTriggerManual)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error(), "data": result})
		return
	}
	common.ApiSuccess(c, result)
}

func RefreshUpstreamAccountBalance(c *gin.Context) {
	account, ok := loadUpstreamAccountParam(c)
	if !ok {
		return
	}
	result, err := service.RefreshUpstreamAccountBalance(c.Request.Context(), account, model.UpstreamTriggerManual)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error(), "data": result})
		return
	}
	common.ApiSuccess(c, result)
}

func HealthCheckUpstreamAccount(c *gin.Context) {
	account, ok := loadUpstreamAccountParam(c)
	if !ok {
		return
	}
	result, err := service.HealthCheckUpstreamAccount(c.Request.Context(), account, model.UpstreamTriggerManual)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error(), "data": result})
		return
	}
	common.ApiSuccess(c, result)
}
