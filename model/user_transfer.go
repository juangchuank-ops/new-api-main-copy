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
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
)

// TransferFeeRate 余额转账手续费比例，由转账人承担。
const TransferFeeRate = 0.03

type TransferQuotaResult struct {
	Quota   int `json:"quota"`   // 收款人实际到账额度
	Fee     int `json:"fee"`     // 手续费
	Total   int `json:"total"`   // 转账人实扣额度 = Quota + Fee
	Balance int `json:"balance"` // 转账人转账后余额
}

// TransferQuota 把 quota 额度从 fromUserId 转给 toUserId（用户 ID 与用户名必须匹配），
// 手续费 = quota * 3% 向上取整，由转账人额外承担。整个转账在单个事务内完成。
func TransferQuota(fromUserId int, toUserId int, toUsername string, quota int) (*TransferQuotaResult, error) {
	if quota <= 0 {
		return nil, errors.New("转账额度必须大于 0")
	}
	if fromUserId == toUserId {
		return nil, errors.New("不能转账给自己")
	}
	if toUsername == "" {
		return nil, errors.New("请输入收款用户名")
	}

	fee := int(math.Ceil(float64(quota) * TransferFeeRate))
	total := quota + fee

	var fromUser User
	var toUser User
	balance := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		// 固定顺序锁定两个用户行，避免并发互相转账时死锁
		firstId, secondId := fromUserId, toUserId
		if firstId > secondId {
			firstId, secondId = secondId, firstId
		}
		var count int64
		if err := lockForUpdate(tx).Model(&User{}).
			Where("id IN ?", []int{firstId, secondId}).Count(&count).Error; err != nil {
			return err
		}
		if count != 2 {
			return errors.New("收款用户不存在")
		}
		if err := tx.Select("id", "username", "quota").
			Where("id = ?", fromUserId).First(&fromUser).Error; err != nil {
			return err
		}
		if err := tx.Select("id", "username", "quota").
			Where("id = ?", toUserId).First(&toUser).Error; err != nil {
			return err
		}
		if toUser.Username != toUsername {
			return errors.New("收款用户 ID 与用户名不匹配")
		}

		// quota >= ? 条件兜底，防止锁失效场景下扣成负数
		result := tx.Model(&User{}).
			Where("id = ? AND quota >= ?", fromUserId, total).
			Update("quota", gorm.Expr("quota - ?", total))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("余额不足")
		}
		result = tx.Model(&User{}).
			Where("id = ?", toUserId).
			Update("quota", gorm.Expr("quota + ?", quota))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		balance = fromUser.Quota - total
		return nil
	})
	if err != nil {
		return nil, err
	}

	RecordLog(fromUserId, LogTypeSystem, fmt.Sprintf(
		"余额转账给 %s(#%d)：对方到账 %s，手续费 %s，实扣 %s",
		toUser.Username, toUser.Id, logger.LogQuota(quota), logger.LogQuota(fee), logger.LogQuota(total)))
	RecordLog(toUserId, LogTypeSystem, fmt.Sprintf(
		"收到 %s(#%d) 转账 %s",
		fromUser.Username, fromUser.Id, logger.LogQuota(quota)))

	if err := cacheDecrUserQuota(fromUserId, int64(total)); err != nil {
		common.SysLog("failed to decrease user quota cache: " + err.Error())
	}
	if err := cacheIncrUserQuota(toUserId, int64(quota)); err != nil {
		common.SysLog("failed to increase user quota cache: " + err.Error())
	}

	return &TransferQuotaResult{Quota: quota, Fee: fee, Total: total, Balance: balance}, nil
}
