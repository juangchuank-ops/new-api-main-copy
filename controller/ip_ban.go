package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type ipBanRequest struct {
	Rule         string `json:"rule"`
	Reason       string `json:"reason"`
	Enabled      *bool  `json:"enabled"`
	ExpiresAt    int64  `json:"expires_at"`
	TargetUserId int    `json:"target_user_id"`
}

func validateIPBanRequest(request ipBanRequest) error {
	if strings.TrimSpace(request.Rule) == "" {
		return errors.New("IP rule is required")
	}
	if len(strings.TrimSpace(request.Reason)) > 1000 {
		return errors.New("reason is too long")
	}
	if request.ExpiresAt < 0 {
		return errors.New("expires_at cannot be negative")
	}
	return nil
}

func ListIPBanUsers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	users, total, err := model.ListIPBanUsers(c.Query("keyword"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)
	common.ApiSuccess(c, pageInfo)
}
func ListIPBans(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	bans, total, err := model.ListIPBans(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), c.Query("search"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(bans)
	common.ApiSuccess(c, pageInfo)
}

func CreateIPBan(c *gin.Context) {
	var request ipBanRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := validateIPBanRequest(request); err != nil {
		common.ApiError(c, err)
		return
	}
	enabled := true
	if request.Enabled != nil {
		enabled = *request.Enabled
	}
	ban := &model.IPBan{
		Rule:         request.Rule,
		Reason:       request.Reason,
		Enabled:      enabled,
		ExpiresAt:    request.ExpiresAt,
		TargetUserId: request.TargetUserId,
		OperatorId:   c.GetInt("id"),
	}
	if err := model.CreateIPBan(ban); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "ip_ban.create", map[string]interface{}{"id": ban.Id, "rule": ban.Rule})
	common.ApiSuccess(c, ban)
}

func UpdateIPBan(c *gin.Context) {
	id, ok := parseIPBanID(c)
	if !ok {
		return
	}
	var request ipBanRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := validateIPBanRequest(request); err != nil {
		common.ApiError(c, err)
		return
	}
	current, err := model.GetIPBanByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	enabled := current.Enabled
	if request.Enabled != nil {
		enabled = *request.Enabled
	}
	ban, err := model.UpdateIPBan(id, request.Rule, request.Reason, enabled, request.ExpiresAt, request.TargetUserId, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "ip_ban.update", map[string]interface{}{"id": ban.Id, "rule": ban.Rule})
	common.ApiSuccess(c, ban)
}

func ToggleIPBan(c *gin.Context) {
	id, ok := parseIPBanID(c)
	if !ok {
		return
	}
	ban, err := model.ToggleIPBan(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "ip_ban.toggle", map[string]interface{}{"id": ban.Id, "rule": ban.Rule, "enabled": ban.Enabled})
	common.ApiSuccess(c, ban)
}

func DeleteIPBan(c *gin.Context) {
	id, ok := parseIPBanID(c)
	if !ok {
		return
	}
	ban, err := model.GetIPBanByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteIPBan(id); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "ip_ban.delete", map[string]interface{}{"id": ban.Id, "rule": ban.Rule})
	common.ApiSuccess(c, nil)
}

func parseIPBanID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid IP ban ID")
		return 0, false
	}
	return id, true
}
