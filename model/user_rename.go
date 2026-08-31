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

package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
)

// RenameFeeQuota 修改用户名单次收取的费用（原生额度单位）。
// 1000 配合默认 QuotaPerUnit=500000 约合 $0.002，由调用方按展示需要换算。
const RenameFeeQuota = 1000

// RenameUser 修改用户名并收取费用。改名与扣费在同一事务内完成；
// 新用户名冲突返回错误，余额不足返回错误，用户名不变不收费。
func RenameUser(userId int, newUsername string) (fee int, balance int, err error) {
	newUsername = strings.TrimSpace(newUsername)
	if newUsername == "" {
		return 0, 0, errors.New("请输入新用户名")
	}
	if len(newUsername) > UserNameMaxLength {
		return 0, 0, fmt.Errorf("用户名最长 %d 个字符", UserNameMaxLength)
	}

	var user User
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Select("id", "username", "quota").
			Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if user.Username == newUsername {
			return errors.New("新用户名与当前用户名相同")
		}
		var count int64
		if err := tx.Model(&User{}).
			Where("username = ?", newUsername).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return errors.New("用户名已被占用")
		}
		if user.Quota < RenameFeeQuota {
			return errors.New("余额不足")
		}
		if err := tx.Model(&User{}).
			Where("id = ? AND quota >= ?", userId, RenameFeeQuota).
			Update("quota", gorm.Expr("quota - ?", RenameFeeQuota)).Error; err != nil {
			return err
		}
		return tx.Model(&User{}).
			Where("id = ?", userId).
			Update("username", newUsername).Error
	})
	if err != nil {
		return 0, 0, err
	}

	RecordLog(userId, LogTypeSystem, fmt.Sprintf(
		"修改用户名：由 %s 改为 %s，支付 %s",
		user.Username, newUsername, logger.LogQuota(RenameFeeQuota)))

	if err := cacheDecrUserQuota(userId, int64(RenameFeeQuota)); err != nil {
		common.SysLog("failed to decrease user quota cache: " + err.Error())
	}

	return RenameFeeQuota, user.Quota - RenameFeeQuota, nil
}
