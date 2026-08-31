package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type browserFingerprintBanRequest struct {
	FingerprintHash string `json:"fingerprint_hash"`
	Reason          string `json:"reason"`
	Enabled         *bool  `json:"enabled"`
	ExpiresAt       int64  `json:"expires_at"`
	TargetUserId    int    `json:"target_user_id"`
}

func ListBrowserFingerprintUsers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	users, total, err := model.ListBrowserFingerprintUsers(c.Query("keyword"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)
	common.ApiSuccess(c, pageInfo)
}

func validateBrowserFingerprintBanRequest(request browserFingerprintBanRequest) error {
	if err := model.ValidateBrowserFingerprintHash(request.FingerprintHash); err != nil {
		return err
	}
	if len(strings.TrimSpace(request.Reason)) > 1000 {
		return errors.New("reason is too long")
	}
	if request.ExpiresAt < 0 {
		return errors.New("expires_at cannot be negative")
	}
	return nil
}

func ListBrowserFingerprintBans(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	bans, total, err := model.ListBrowserFingerprintBans(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), c.Query("search"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(bans)
	common.ApiSuccess(c, pageInfo)
}

func CreateBrowserFingerprintBan(c *gin.Context) {
	var request browserFingerprintBanRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := validateBrowserFingerprintBanRequest(request); err != nil {
		common.ApiError(c, err)
		return
	}
	enabled := true
	if request.Enabled != nil {
		enabled = *request.Enabled
	}
	ban := &model.BrowserFingerprintBan{
		FingerprintHash: request.FingerprintHash,
		Reason:          request.Reason,
		Enabled:         enabled,
		ExpiresAt:       request.ExpiresAt,
		TargetUserId:    request.TargetUserId,
		OperatorId:      c.GetInt("id"),
	}
	if err := model.CreateBrowserFingerprintBan(ban); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "browser_fingerprint_ban.create", map[string]interface{}{"id": ban.Id, "fingerprint_hash": ban.FingerprintHash})
	common.ApiSuccess(c, ban)
}

func UpdateBrowserFingerprintBan(c *gin.Context) {
	id, ok := parseBrowserFingerprintBanID(c)
	if !ok {
		return
	}
	var request browserFingerprintBanRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := validateBrowserFingerprintBanRequest(request); err != nil {
		common.ApiError(c, err)
		return
	}
	current, err := model.GetBrowserFingerprintBanByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	enabled := current.Enabled
	if request.Enabled != nil {
		enabled = *request.Enabled
	}
	ban, err := model.UpdateBrowserFingerprintBan(id, request.FingerprintHash, request.Reason, enabled, request.ExpiresAt, request.TargetUserId, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "browser_fingerprint_ban.update", map[string]interface{}{"id": ban.Id, "fingerprint_hash": ban.FingerprintHash})
	common.ApiSuccess(c, ban)
}

func ToggleBrowserFingerprintBan(c *gin.Context) {
	id, ok := parseBrowserFingerprintBanID(c)
	if !ok {
		return
	}
	ban, err := model.ToggleBrowserFingerprintBan(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "browser_fingerprint_ban.toggle", map[string]interface{}{"id": ban.Id, "fingerprint_hash": ban.FingerprintHash, "enabled": ban.Enabled})
	common.ApiSuccess(c, ban)
}

func DeleteBrowserFingerprintBan(c *gin.Context) {
	id, ok := parseBrowserFingerprintBanID(c)
	if !ok {
		return
	}
	ban, err := model.GetBrowserFingerprintBanByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteBrowserFingerprintBan(id); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "browser_fingerprint_ban.delete", map[string]interface{}{"id": ban.Id, "fingerprint_hash": ban.FingerprintHash})
	common.ApiSuccess(c, nil)
}

func parseBrowserFingerprintBanID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid browser fingerprint ban ID")
		return 0, false
	}
	return id, true
}
