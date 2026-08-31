package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// TestManageUserPermissionAdmin 复现 Root 通过 /api/user/manage 提升权限管理员的
// 完整链路：角色变更与 sidebar_modules 写入必须同请求成功并持久化。
func TestManageUserPermissionAdmin(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}))

	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.RedisEnabled = previousRedisEnabled
	})

	target := model.User{
		Username: "perm-target",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, target.Insert(0))

	runManage := func(body string) *httptest.ResponseRecorder {
		gin.SetMode(gin.TestMode)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		req := httptest.NewRequest(http.MethodPost, "/api/user/manage", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		c.Request = req
		c.Set("role", common.RoleRootUser)
		c.Set("id", 99999)
		ManageUser(c)
		return w
	}

	payload := fmt.Sprintf(`{"id":%d,"action":"permission_admin","sidebar_modules":{"admin":{"enabled":true,"user":true,"channel":true}}}`, target.Id)
	w := runManage(payload)
	require.Equal(t, http.StatusOK, w.Code, "response body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"success":true`, "permission_admin save should succeed, got: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"role":5`, "response should report the new permission-admin role")

	var saved model.User
	require.NoError(t, db.Where("id = ?", target.Id).First(&saved).Error)
	assert.Equal(t, common.RolePermissionAdmin, saved.Role)
	persistedSetting := saved.GetSetting()
	assert.Equal(t, `{"admin":{"channel":true,"enabled":true,"user":true}}`, persistedSetting.SidebarModules,
		"module config must persist unescaped inside the user setting")

	// 对已是权限管理员的用户重复 permission_admin 是幂等操作（后端仅拦截 >=10 的用户），
	// 应再次成功并保持角色不变。
	w2 := runManage(payload)
	assert.Contains(t, w2.Body.String(), `"success":true`, "idempotent re-assign should succeed, got: %s", w2.Body.String())
	assert.Contains(t, w2.Body.String(), `"role":5`)
}
