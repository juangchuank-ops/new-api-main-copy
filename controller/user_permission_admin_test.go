package controller

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestManageUserPermissionAdmin 复现 Root 通过 /api/user/manage 提升权限管理员的
// 完整链路：角色变更与 sidebar_modules 写入必须同请求成功并持久化。
func TestManageUserPermissionAdmin(t *testing.T) {
	db := setupManageUserTestDB(t)

	target := model.User{
		Username: "perm-target",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, target.Insert(0))

	payload := fmt.Sprintf(`{"id":%d,"action":"permission_admin","sidebar_modules":{"admin":{"enabled":true,"user":true,"channel":true}}}`, target.Id)
	w := performManageUserRequest(t, payload)
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
	w2 := performManageUserRequest(t, payload)
	assert.Contains(t, w2.Body.String(), `"success":true`, "idempotent re-assign should succeed, got: %s", w2.Body.String())
	assert.Contains(t, w2.Body.String(), `"role":5`)
}
