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

func setupRenameTest(t *testing.T) (*gorm.DB, *model.User) {
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

	user := model.User{Username: "rename-user", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	require.NoError(t, user.Insert(0))
	return db, &user
}

func runRename(t *testing.T, userId int, newUsername string, initialQuota int) *httptest.ResponseRecorder {
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", userId).
		Update("quota", initialQuota).Error)
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := `{"username":"` + newUsername + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/user/rename", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Set("id", userId)
	RenameSelf(c)
	return w
}

func TestRenameSelfSuccess(t *testing.T) {
	db, user := setupRenameTest(t)

	w := runRename(t, user.Id, "rename-new", 5000)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"success":true`)
	assert.Contains(t, w.Body.String(), `"fee":1000`)

	var username string
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", user.Id).Pluck("username", &username).Error)
	assert.Equal(t, "rename-new", username)

	var quota int
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", user.Id).Pluck("quota", &quota).Error)
	assert.Equal(t, 4000, quota)

	var logCount int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).
		Where("user_id = ? AND type = ?", user.Id, model.LogTypeSystem).Count(&logCount).Error)
	assert.Equal(t, int64(1), logCount, "改名应记录一条系统日志")
}

func TestRenameSelfDuplicate(t *testing.T) {
	db, user := setupRenameTest(t)
	other := model.User{Username: "taken-name", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	require.NoError(t, other.Insert(0))

	w := runRename(t, user.Id, "taken-name", 5000)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"success":false`)
	assert.Contains(t, w.Body.String(), "已被占用")

	var quota int
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", user.Id).Pluck("quota", &quota).Error)
	assert.Equal(t, 5000, quota, "失败时不应扣费")
}

func TestRenameSelfInsufficientBalance(t *testing.T) {
	db, user := setupRenameTest(t)

	w := runRename(t, user.Id, "rename-new", 999)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"success":false`)
	assert.Contains(t, w.Body.String(), "余额不足")

	var username string
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", user.Id).Pluck("username", &username).Error)
	assert.Equal(t, "rename-user", username, "失败时不应改名")
	var quota int
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", user.Id).Pluck("quota", &quota).Error)
	assert.Equal(t, 999, quota)
}

func TestRenameSelfSameName(t *testing.T) {
	db, user := setupRenameTest(t)

	w := runRename(t, user.Id, "rename-user", 5000)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"success":false`)
	assert.Contains(t, w.Body.String(), "相同")

	var quota int
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", user.Id).Pluck("quota", &quota).Error)
	assert.Equal(t, 5000, quota)
}
