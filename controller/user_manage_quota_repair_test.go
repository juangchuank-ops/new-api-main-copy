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

// 历史遗留的超范围余额（早期版本允许 override 到钱包上限之外）必须仍能通过
// 管理接口改回正常值，否则账号会被永久冻结、无法修复。
func TestManageUserQuotaRepairsLegacyOutOfRangeBalance(t *testing.T) {
	db := setupManageUserTestDB(t)
	legacyQuota := common.MaxWalletQuota * 100
	user := model.User{Username: "legacy-quota-owner", Role: common.RoleCommonUser, Quota: legacyQuota, AffCode: "legacy-quota-owner-aff"}
	require.NoError(t, db.Create(&user).Error)
	createQuotaTestOperator(t, db, common.RoleRootUser)

	recorder := performManageUserRequest(t, fmt.Sprintf(`{"id":%d,"action":"add_quota","mode":"override","value":1000}`, user.Id))
	assert.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":true`)
	require.NoError(t, db.First(&user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)

	var audits []model.AuditLog
	require.NoError(t, model.LOG_DB.Find(&audits).Error)
	require.Len(t, audits, 1)
	assert.True(t, audits[0].Success)
	params, err := common.Marshal(audits[0].Other.Op.Params)
	require.NoError(t, err)
	expected, err := common.Marshal(model.AuditFields{
		"target_user_id": user.Id, "target_username": user.Username, "mode": "override",
		"requested_quota": 1000, "from": legacyQuota, "to": 1000,
	})
	require.NoError(t, err)
	assert.JSONEq(t, string(expected), string(params))
}
