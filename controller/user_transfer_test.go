/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

package controller

import (
	"bytes"
	"fmt"
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

func setupTransferQuotaTest(t *testing.T) (*gorm.DB, *model.User, *model.User) {
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

	sender := model.User{Username: "transfer-sender", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	require.NoError(t, sender.Insert(0))
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", sender.Id).Update("quota", 1000000).Error)

	recipient := model.User{Username: "transfer-recipient", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	require.NoError(t, recipient.Insert(0))

	return db, &sender, &recipient
}

func runTransferQuota(t *testing.T, senderId int, body string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/user/transfer", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Set("id", senderId)
	TransferUserQuota(c)
	return w
}

func TestTransferUserQuotaSuccess(t *testing.T) {
	db, sender, recipient := setupTransferQuotaTest(t)

	body := fmt.Sprintf(`{"to_user_id":%d,"to_username":"transfer-recipient","quota":100000}`, recipient.Id)
	w := runTransferQuota(t, sender.Id, body)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"success":true`)
	assert.Contains(t, w.Body.String(), `"total":103000`)
	assert.Contains(t, w.Body.String(), `"fee":3000`)
	assert.Contains(t, w.Body.String(), `"quota":100000`)

	var senderQuota, recipientQuota int
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", sender.Id).Pluck("quota", &senderQuota).Error)
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", recipient.Id).Pluck("quota", &recipientQuota).Error)
	assert.Equal(t, 897000, senderQuota)
	assert.Equal(t, 100000, recipientQuota)

	var logCount int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).
		Where("user_id IN ? AND type = ?", []int{sender.Id, recipient.Id}, model.LogTypeSystem).
		Count(&logCount).Error)
	assert.Equal(t, int64(2), logCount, "转出方与收款方应各记录一条日志")
}

func TestTransferUserQuotaInsufficientBalance(t *testing.T) {
	db, sender, recipient := setupTransferQuotaTest(t)

	body := fmt.Sprintf(`{"to_user_id":%d,"to_username":"transfer-recipient","quota":980000}`, recipient.Id)
	w := runTransferQuota(t, sender.Id, body)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"success":false`)
	assert.Contains(t, w.Body.String(), "余额不足")

	var senderQuota, recipientQuota int
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", sender.Id).Pluck("quota", &senderQuota).Error)
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", recipient.Id).Pluck("quota", &recipientQuota).Error)
	assert.Equal(t, 1000000, senderQuota, "失败时转账人额度不应变化")
	assert.Equal(t, 0, recipientQuota, "失败时收款人额度不应变化")
}

func TestTransferUserQuotaUsernameMismatch(t *testing.T) {
	db, sender, recipient := setupTransferQuotaTest(t)

	body := fmt.Sprintf(`{"to_user_id":%d,"to_username":"someone-else","quota":100}`, recipient.Id)
	w := runTransferQuota(t, sender.Id, body)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"success":false`)
	assert.Contains(t, w.Body.String(), "不匹配")

	var senderQuota int
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", sender.Id).Pluck("quota", &senderQuota).Error)
	assert.Equal(t, 1000000, senderQuota)
}
