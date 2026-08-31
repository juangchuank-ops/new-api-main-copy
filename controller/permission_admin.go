package controller

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
)

type permissionAdminRequest struct {
	Role           *int                       `json:"role"`
	SidebarModules map[string]map[string]bool `json:"sidebar_modules"`
	Permissions    authz.PermissionsMap       `json:"permissions"`
}

// GetPermissionAdmin returns the effective module and action permissions for a user.
func GetPermissionAdmin(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	setting := user.GetSetting()
	common.ApiSuccess(c, gin.H{
		"user_id":         user.Id,
		"role":            user.Role,
		"sidebar_modules": setting.SidebarModules,
		"permissions":     authz.Capabilities(user.Id, user.Role),
	})
}

// UpdatePermissionAdmin is intentionally Root-only. It updates the role and
// module/action allow-list atomically from the operator's perspective.
func UpdatePermissionAdmin(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req permissionAdminRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user.Role == common.RoleRootUser || id == c.GetInt("id") {
		common.ApiError(c, errors.New("cannot modify root user or yourself"))
		return
	}
	if req.Role != nil {
		if *req.Role != common.RoleCommonUser && *req.Role != common.RolePermissionAdmin && *req.Role != common.RoleAdminUser {
			common.ApiError(c, errors.New("invalid managed role"))
			return
		}
		user.Role = *req.Role
	}
	if req.SidebarModules != nil {
		setting := user.GetSetting()
		bytes, err := common.Marshal(req.SidebarModules)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		setting.SidebarModules = string(bytes)
		user.SetSetting(setting)
	}
	if err := user.Update(false); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.InvalidateUserCache(user.Id); err != nil {
		common.SysError(fmt.Sprintf("failed to invalidate user cache for user %d: %s", user.Id, err.Error()))
	}
	if req.Permissions != nil {
		if err := authz.SetUserPermissions(user.Id, req.Permissions); err != nil {
			common.ApiError(c, err)
			return
		}
		if err := authz.ReloadPolicy(); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	recordManageAuditFor(c, user.Id, "permission_admin.update", map[string]interface{}{
		"role": user.Role,
	})
	common.ApiSuccess(c, gin.H{"id": user.Id, "role": user.Role})
}
