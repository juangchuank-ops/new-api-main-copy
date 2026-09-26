package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 用户管理的状态筛选依赖 SearchUsers 的 status 契约：
// 1 启用 / 2 禁用是落库状态；-1 已注销（软删除）、-2 自动封禁中是虚拟筛选值。
// 列表里处于自动封禁中的用户统一显示为"自动封禁"标签，
// 因此按启用/禁用筛选时必须排除它们，筛选结果才能与状态标签一致。
func TestSearchUsersFiltersByStatusContract(t *testing.T) {
	truncateTables(t)
	now := time.Now().Unix()

	users := []*User{
		{Id: 1, Username: "status-enabled", Password: "password123", Status: common.UserStatusEnabled, Group: "default", AffCode: "aff-status-1"},
		{Id: 2, Username: "status-disabled", Password: "password123", Status: common.UserStatusDisabled, Group: "default", AffCode: "aff-status-2"},
		{Id: 3, Username: "status-banned-forever", Password: "password123", Status: common.UserStatusEnabled, Group: "default", AffCode: "aff-status-3",
			AutoBanRule: "sensitive_words", AutoBanUntil: -1},
		{Id: 4, Username: "status-banned-active", Password: "password123", Status: common.UserStatusEnabled, Group: "default", AffCode: "aff-status-4",
			AutoBanRule: "ip", AutoBanUntil: now + 3600},
		{Id: 5, Username: "status-banned-expired", Password: "password123", Status: common.UserStatusEnabled, Group: "default", AffCode: "aff-status-5",
			AutoBanRule: "ip", AutoBanUntil: now - 3600},
	}
	for _, user := range users {
		require.NoError(t, DB.Create(user).Error)
	}

	deleted := &User{Id: 6, Username: "status-deleted", Password: "password123", Status: common.UserStatusEnabled, Group: "default", AffCode: "aff-status-6"}
	require.NoError(t, DB.Create(deleted).Error)
	require.NoError(t, DB.Delete(deleted).Error)

	searchIDs := func(status int) []int {
		t.Helper()
		found, total, err := SearchUsers("", "", nil, &status, 0, 50, NewUserSortOptions("id", "asc"))
		require.NoError(t, err)
		require.Equal(t, int64(len(found)), total)
		return collectUserIDs(found)
	}

	// 封禁中的 3、4 与未过期的封禁一起被排除；5 已解禁，回到启用状态。
	assert.Equal(t, []int{1, 5}, searchIDs(common.UserStatusEnabled))
	assert.Equal(t, []int{2}, searchIDs(common.UserStatusDisabled))
	assert.Equal(t, []int{6}, searchIDs(-1))
	assert.Equal(t, []int{3, 4}, searchIDs(-2))
}
