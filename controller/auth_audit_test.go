package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAuthenticationAuditUsesRequestMetadata(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Log{}))

	previousLogDB := model.LOG_DB
	model.LOG_DB = db
	t.Cleanup(func() {
		model.LOG_DB = previousLogDB
	})

	user := &model.User{Id: 19, Username: "oauth_user"}
	router := gin.New()
	router.GET("/api/oauth/:provider", func(c *gin.Context) {
		recordRegistrationAudit(user, c, "oauth:"+c.Param("provider"))
		recordLoginAudit(user, c)
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/api/oauth/github", nil)
	request.RemoteAddr = "203.0.113.25:43210"
	request.Header.Set("User-Agent", "auth-audit-test/1.0")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusNoContent, response.Code)

	var logs []model.Log
	require.NoError(t, db.Order("id ASC").Find(&logs).Error)
	require.Len(t, logs, 2)
	assert.Equal(t, "203.0.113.25", logs[0].Ip)
	assert.Equal(t, "203.0.113.25", logs[1].Ip)

	registrationOther, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	assert.Equal(t, "oauth:github", registrationOther["registration_method"])
	assert.Equal(t, "auth-audit-test/1.0", registrationOther["user_agent"])
	registrationOp, ok := registrationOther["op"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "register", registrationOp["action"])

	loginOther, err := common.StrToMap(logs[1].Other)
	require.NoError(t, err)
	assert.Equal(t, "oauth:github", loginOther["login_method"])
	assert.Equal(t, "auth-audit-test/1.0", loginOther["user_agent"])
	loginOp, ok := loginOther["op"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "login", loginOp["action"])
}
