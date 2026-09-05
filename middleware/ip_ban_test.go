package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestIPBanMiddlewareBlocksAndBypassesRecoveryPaths(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.IPBan{}))
	previousDB := model.DB
	model.DB = db
	model.InvalidateIPBanSnapshot()
	t.Cleanup(func() {
		model.DB = previousDB
		model.InvalidateIPBanSnapshot()
	})
	require.NoError(t, model.CreateIPBan(&model.IPBan{Rule: "192.0.2.10", Reason: `<script>alert("x")</script>`, Enabled: true, OperatorId: 1}))

	router := gin.New()
	require.NoError(t, router.SetTrustedProxies(nil))
	router.Use(IPBan())
	router.Any("/*path", func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	tests := []struct {
		name        string
		path        string
		wantStatus  int
		contentType string
	}{
		{name: "API blocked as JSON", path: "/api/user/self", wantStatus: http.StatusForbidden, contentType: "application/json; charset=utf-8"},
		{name: "relay blocked as JSON", path: "/v1/chat/completions", wantStatus: http.StatusForbidden, contentType: "application/json; charset=utf-8"},
		{name: "web blocked as HTML", path: "/dashboard", wantStatus: http.StatusForbidden, contentType: "text/html; charset=utf-8"},
		{name: "status bypass", path: "/api/status", wantStatus: http.StatusOK, contentType: "text/plain; charset=utf-8"},
		{name: "login UI bypass", path: "/sign-in", wantStatus: http.StatusOK, contentType: "text/plain; charset=utf-8"},
		{name: "admin recovery bypass", path: "/api/ip-bans", wantStatus: http.StatusOK, contentType: "text/plain; charset=utf-8"},
		{name: "webhook bypass", path: "/api/stripe/webhook", wantStatus: http.StatusOK, contentType: "text/plain; charset=utf-8"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			request.RemoteAddr = "192.0.2.10:1234"
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			assert.Equal(t, test.wantStatus, response.Code)
			assert.Equal(t, test.contentType, response.Header().Get("Content-Type"))
			if test.path == "/dashboard" {
				assert.Contains(t, response.Body.String(), "访问受限")
				assert.Contains(t, response.Body.String(), "永久限制")
				assert.NotContains(t, response.Body.String(), `<script>alert("x")</script>`)
				assert.Contains(t, response.Body.String(), "&lt;script&gt;")
				assert.Equal(t, "no-store", response.Header().Get("Cache-Control"))
			}
			if test.path == "/api/user/self" {
				assert.JSONEq(t, `{"error":"ip_banned","message":"您的账号/ip/指纹已被封禁，请联系管理员"}`, response.Body.String())
				assert.NotContains(t, response.Body.String(), "<html")
			}

		})
	}
}

func TestIPBanMiddlewareUsesTrustedProxyClientIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.IPBan{}))
	previousDB := model.DB
	model.DB = db
	model.InvalidateIPBanSnapshot()
	t.Cleanup(func() {
		model.DB = previousDB
		model.InvalidateIPBanSnapshot()
	})
	require.NoError(t, model.CreateIPBan(&model.IPBan{Rule: "203.0.113.25", Enabled: true, OperatorId: 1}))

	router := gin.New()
	require.NoError(t, router.SetTrustedProxies([]string{"198.51.100.10"}))
	router.Use(IPBan())
	router.GET("/api/private", func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	request := httptest.NewRequest(http.MethodGet, "/api/private", nil)
	request.RemoteAddr = "198.51.100.10:1234"
	request.Header.Set("X-Forwarded-For", "203.0.113.25")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusForbidden, response.Code)
}

func TestIPBanMiddlewareFailsOpenOnDatabaseError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())
	previousDB := model.DB
	model.DB = db
	model.InvalidateIPBanSnapshot()
	t.Cleanup(func() {
		model.DB = previousDB
		model.InvalidateIPBanSnapshot()
	})

	router := gin.New()
	router.Use(IPBan())
	router.GET("/api/private", func(c *gin.Context) { c.String(http.StatusOK, "ok") })
	request := httptest.NewRequest(http.MethodGet, "/api/private", nil)
	request.RemoteAddr = "192.0.2.10:1234"
	response := httptest.NewRecorder()
	require.NotPanics(t, func() { router.ServeHTTP(response, request) })
	assert.Equal(t, http.StatusOK, response.Code)
}
