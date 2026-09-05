package middleware

import (
	"bytes"
	"fmt"
	"html/template"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

var ipBanPageTemplate = template.Must(template.New("ip-ban").Parse(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>访问受限</title>
<style>
:root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#35151a;background:#fff7f7}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 0,#ffe6e5 0,transparent 48%),#fff7f7}.panel{width:min(100%,500px);padding:2px;border-radius:20px;background:linear-gradient(135deg,#ffb1ad,#e53935 45%,#7f151a);box-shadow:0 18px 55px rgba(157,30,35,.18)}.inner{border-radius:18px;background:rgba(255,251,251,.98);padding:48px 42px 40px;text-align:center}.icon{width:76px;height:76px;margin:0 auto 24px;border-radius:50%;display:grid;place-items:center;background:#fff0ef;color:#c9282d;box-shadow:0 0 0 10px #fff8f7;font-size:42px;font-weight:700;line-height:1}.code{margin:0 0 8px;color:#b3262b;font-size:13px;letter-spacing:2px;font-weight:700}.title{margin:0;color:#301114;font-size:30px;line-height:1.25}.copy{margin:14px 0 28px;color:#77565a;font-size:15px;line-height:1.7}.details{border-top:1px solid #f1d8d7;text-align:left}.row{display:flex;justify-content:space-between;gap:20px;padding:14px 0;border-bottom:1px solid #f1d8d7;font-size:14px}.label{color:#947477}.value{max-width:70%;color:#4d262a;text-align:right;overflow-wrap:anywhere}.footer{margin-top:24px;color:#ad888a;font-size:12px}@media(max-width:420px){.inner{padding:38px 24px 30px}.title{font-size:26px}.row{display:block}.value{max-width:none;margin-top:5px;text-align:left}}
</style></head><body><main class="panel"><section class="inner"><div class="icon" aria-hidden="true">⊘</div><p class="code">403 · FORBIDDEN</p><h1 class="title">访问受限</h1><p class="copy">当前网络地址暂时无法访问此服务，请联系管理员了解详情。</p><div class="details"><div class="row"><span class="label">限制原因</span><span class="value">{{.Reason}}</span></div><div class="row"><span class="label">限制状态</span><span class="value">{{.Expiry}}</span></div></div><p class="footer">如有疑问，请向服务管理员提交申诉。</p></section></main></body></html>`))

type ipBanPageData struct {
	Reason string
	Expiry string
}

func IPBan() gin.HandlerFunc {
	return func(c *gin.Context) {
		if bypassIPBan(c.Request.Method, c.Request.URL.Path) {
			c.Next()
			return
		}
		now := time.Now()
		ipBan, err := model.MatchIPBan(c.ClientIP(), now)
		if err != nil {
			common.SysError(fmt.Sprintf("IP ban check failed open for %s: %v", c.ClientIP(), err))
		} else if ipBan != nil {
			respondBan(c, "ip_banned", "您的账号/ip/指纹已被封禁，请联系管理员", ipBan.Reason, ipBan.ExpiresAt)
			return
		}

		fingerprint := c.GetHeader("X-Browser-Fingerprint")
		fingerprintBan, err := model.MatchBrowserFingerprint(fingerprint, now)
		if err != nil {
			common.SysError(fmt.Sprintf("browser fingerprint ban check failed open: %v", err))
		} else if fingerprintBan != nil {
			respondBan(c, "browser_fingerprint_banned", "您的账号/ip/指纹已被封禁，请联系管理员", fingerprintBan.Reason, fingerprintBan.ExpiresAt)
			return
		}
		c.Next()
	}
}

func respondBan(c *gin.Context, errorCode, apiMessage, reason string, expiresAt int64) {
	c.Header("Cache-Control", "no-store")
	if isAPIOrRelayPath(c.Request.URL.Path) {
		body, marshalErr := common.Marshal(gin.H{"error": errorCode, "message": apiMessage})
		if marshalErr != nil {
			common.SysError("failed to marshal ban response: " + marshalErr.Error())
			c.Data(http.StatusForbidden, "text/plain; charset=utf-8", []byte(apiMessage))
		} else {
			c.Data(http.StatusForbidden, "application/json; charset=utf-8", body)
		}
	} else {
		reason = strings.TrimSpace(reason)
		if reason == "" {
			reason = "违反服务访问规则"
		}
		expiry := "永久限制"
		if expiresAt > 0 {
			expiry = time.Unix(expiresAt, 0).Format("2006年01月02日 15:04") + " 解除限制"
		}
		var page bytes.Buffer
		if renderErr := ipBanPageTemplate.Execute(&page, ipBanPageData{Reason: reason, Expiry: expiry}); renderErr != nil {
			common.SysError("failed to render ban page: " + renderErr.Error())
			c.Data(http.StatusForbidden, "text/plain; charset=utf-8", []byte(apiMessage))
		} else {
			c.Data(http.StatusForbidden, "text/html; charset=utf-8", page.Bytes())
		}
	}
	c.Abort()
}

func bypassIPBan(method, requestPath string) bool {
	if requestPath == "/login" || strings.HasPrefix(requestPath, "/login/") ||
		requestPath == "/sign-in" || strings.HasPrefix(requestPath, "/sign-in/") ||
		requestPath == "/oauth" || strings.HasPrefix(requestPath, "/oauth/") ||
		strings.HasPrefix(requestPath, "/assets/") || strings.HasPrefix(requestPath, "/static/") {
		return true
	}
	if extension := path.Ext(requestPath); extension != "" && !strings.HasPrefix(requestPath, "/api/") && !strings.HasPrefix(requestPath, "/v1/") {
		return true
	}
	switch requestPath {
	case "/api/status", "/api/user/login", "/api/user/login/2fa",
		"/api/user/passkey/login/begin", "/api/user/passkey/login/finish",
		"/api/user/logout", "/api/oauth/state", "/api/oauth/complete":
		return true
	}
	if requestPath == "/api/ip-bans" || strings.HasPrefix(requestPath, "/api/ip-bans/") {
		return true
	}
	if requestPath == "/api/browser-fingerprint-bans" || strings.HasPrefix(requestPath, "/api/browser-fingerprint-bans/") {
		return true
	}
	if requestPath == "/api/oauth/wechat" {
		return true
	}
	if strings.Contains(requestPath, "/webhook") || strings.HasSuffix(requestPath, "/notify") {
		return true
	}
	if method == http.MethodGet && strings.HasPrefix(requestPath, "/api/oauth/") {
		return true
	}
	return false
}

func isAPIOrRelayPath(requestPath string) bool {
	return requestPath == "/api" || strings.HasPrefix(requestPath, "/api/") ||
		requestPath == "/v1" || strings.HasPrefix(requestPath, "/v1/") ||
		strings.HasPrefix(requestPath, "/v1beta/") || strings.HasPrefix(requestPath, "/v1beta1/") ||
		strings.HasPrefix(requestPath, "/pg/") || strings.HasPrefix(requestPath, "/kling/") ||
		strings.HasPrefix(requestPath, "/jimeng") || strings.HasPrefix(requestPath, "/mj/") ||
		strings.Contains(requestPath, "/mj/") || strings.HasPrefix(requestPath, "/suno/")
}
