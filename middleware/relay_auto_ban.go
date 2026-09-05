package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func abortWithAutoBanResponse(c *gin.Context, response model.AutoBanResponse) {
	status := response.Status
	if status < 400 || status > 599 {
		status = http.StatusForbidden
	}
	abortWithOpenAiMessage(c, status, response.Message, types.ErrorCode(response.Code))
}

func abortDashboardWithAutoBanResponse(c *gin.Context, response model.AutoBanResponse) {
	status := response.Status
	if status < 400 || status > 599 {
		status = http.StatusForbidden
	}
	c.AbortWithStatusJSON(status, gin.H{
		"success":   false,
		"code":      response.Code,
		"message":   response.Message,
		"ban_until": response.Until,
	})
}

// RelayAutoBanClientMetrics evaluates the excessive-IP auto-ban rule before
// token authentication so distinct-IP counts attribute to the account.
func RelayAutoBanClientMetrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		_, normalizedIP := service.NormalizeAutoBanIP(c.ClientIP())
		decision, err := service.EvaluateAutoBanTrigger(c, service.AutoBanTrigger{
			RuleType: setting.AutoBanRuleExcessiveIPs,
			Subject:  normalizedIP,
			Distinct: true,
			Evidence: map[string]interface{}{"normalized_ip": normalizedIP},
		})
		if err != nil {
			common.SysLog("failed to evaluate excessive IP auto-ban rule: " + err.Error())
		}
		if decision != nil && decision.Banned {
			abortWithAutoBanResponse(c, decision.Response)
			return
		}
		c.Next()
	}
}

// RelayUserAgentBlacklist blocks configured clients after token authentication
// so ban actions can be attributed to an account. It does not write the raw
// header to application logs. The action on hit is configured via the
// RelayUserAgentBlacklistAction option: reject only, ban the account, or ban
// the account and additionally block every IP it has logged in from.
func RelayUserAgentBlacklist() gin.HandlerFunc {
	return func(c *gin.Context) {
		pattern, matched := common.MatchRelayUserAgentBlacklist(c.GetHeader("User-Agent"))
		if matched {
			action := common.RelayUserAgentBlacklistAction()
			if action != common.RelayUserAgentBlacklistAction403 {
				banResponse, banned := applyUserAgentBlacklistBan(c, c.GetInt("id"), pattern, action == common.RelayUserAgentBlacklistActionBanIP)
				if banned && action == common.RelayUserAgentBlacklistActionBan {
					abortWithAutoBanResponse(c, banResponse)
					return
				}
			}
			abortWithOpenAiMessage(c, http.StatusForbidden, "您的客户端触发ua自动封禁，请联系管理员", types.ErrorCodeAccessDenied)
			return
		}
		c.Next()
	}
}

// applyUserAgentBlacklistBan bans the account permanently, optionally also
// blocking every IP the account has logged in from. It reports whether the
// account ended up banned.
func applyUserAgentBlacklistBan(c *gin.Context, userId int, pattern string, blockIPs bool) (model.AutoBanResponse, bool) {
	response := model.AutoBanResponse{}
	if userId <= 0 {
		return response, false
	}
	evidence := map[string]interface{}{"matched_pattern": pattern}
	if blockIPs {
		evidence["blocked_login_ips"] = true
	}
	evidenceJSON, err := common.Marshal(evidence)
	if err != nil {
		evidenceJSON = []byte("{}")
	}
	ip := c.ClientIP()
	if len(ip) > 64 {
		ip = ip[:64]
	}
	userAgent := c.Request.UserAgent()
	if len(userAgent) > 512 {
		userAgent = userAgent[:512]
	}
	record, applied, err := model.ApplyUserAutoBan(model.AutoBanActionInput{
		UserId:             userId,
		RuleType:           setting.AutoBanRuleUserAgent,
		Mode:               setting.AutoBanModeEnforce,
		TriggerCount:       1,
		Threshold:          1,
		WindowMinutes:      1,
		BanDurationMinutes: -1,
		ResponseStatus:     http.StatusForbidden,
		ResponseCode:       "account_banned",
		ResponseMessage:    "您的客户端触发ua自动封禁，请联系管理员",
		Ip:                 ip,
		UserAgent:          userAgent,
		Evidence:           string(evidenceJSON),
	})
	if err != nil {
		common.SysLog("failed to apply User-Agent blacklist ban: " + err.Error())
		return response, false
	}
	if record == nil {
		return response, false
	}
	now := time.Now().Unix()
	banned := applied || (record.Status == model.AutoBanRecordStatusActive && (record.ExpiresAt == 0 || record.ExpiresAt > now))
	if !banned {
		return response, false
	}
	if blockIPs {
		blocked, ipErr := model.BanUserLoginIPs(userId, fmt.Sprintf("命中 UA 黑名单自动封锁（匹配规则: %s）", pattern), record.ExpiresAt, 0)
		if ipErr != nil {
			common.SysLog("failed to block login IPs after User-Agent blacklist ban: " + ipErr.Error())
		} else if len(blocked) > 0 {
			common.SysLog(fmt.Sprintf("User-Agent blacklist banned %d login IPs of user %d", len(blocked), userId))
		}
	}
	banUntil := record.ExpiresAt
	if banUntil == 0 && record.Status == model.AutoBanRecordStatusActive {
		banUntil = -1
	}
	return model.AutoBanResponse{
		Until:   banUntil,
		Rule:    record.RuleType,
		Status:  record.ResponseStatus,
		Code:    record.ResponseCode,
		Message: record.ResponseMessage,
	}, true
}
