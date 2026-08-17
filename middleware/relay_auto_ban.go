package middleware

import (
	"net/http"

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
// so repeated matches can be attributed to an account. It does not write the
// raw header to application logs.
func RelayUserAgentBlacklist() gin.HandlerFunc {
	return func(c *gin.Context) {
		pattern, matched := common.MatchRelayUserAgentBlacklist(c.GetHeader("User-Agent"))
		if matched {
			decision, err := service.EvaluateAutoBanTrigger(c, service.AutoBanTrigger{
				RuleType: setting.AutoBanRuleUserAgent,
				Subject:  pattern,
				Evidence: map[string]interface{}{"matched_pattern": pattern},
			})
			if err != nil {
				common.SysLog("failed to evaluate User-Agent auto-ban rule: " + err.Error())
			}
			if decision != nil && decision.Banned {
				abortWithAutoBanResponse(c, decision.Response)
				return
			}
			abortWithOpenAiMessage(c, http.StatusForbidden, "User-Agent blocked by blacklist", types.ErrorCodeAccessDenied)
			return
		}
		c.Next()
	}
}
