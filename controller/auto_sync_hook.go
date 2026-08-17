package controller

import (
	"context"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"gorm.io/gorm"
)

// appendAutoSyncOnChannelCreate 是 post-commit best-effort 钩子。
// 在渠道创建成功后追加 Auto Sync 事件。失败仅记日志，不影响渠道创建。
func appendAutoSyncOnChannelCreate(channels []model.Channel) {
	for i := range channels {
		ch := &channels[i]
		if ch.Id == 0 {
			var found model.Channel
			if err := model.DB.Where("name = ?", ch.Name).First(&found).Error; err != nil {
				logger.LogWarn(context.Background(), fmt.Sprintf("auto sync hook: channel not found by name %q: %v", ch.Name, err))
				continue
			}
			ch = &found
		}
		appendAutoSyncForChannel(ch, "channel_create")
	}
}

// appendAutoSyncOnChannelUpdate 在渠道更新成功后先失效 pending Guard，再追加新事件。
func appendAutoSyncOnChannelUpdate(channel *model.Channel) {
	invalidatePendingGuards(channel.Id, "channel_update")
	appendAutoSyncForChannel(channel, "channel_update")
}

// appendAutoSyncOnChannelDelete 在渠道删除成功后失效 pending Guard。
func appendAutoSyncOnChannelDelete(channelID int) {
	invalidatePendingGuards(channelID, "channel_delete")
}

// appendAutoSyncOnChannelBatchDelete 在批量删除渠道后失效 pending Guard。
func appendAutoSyncOnChannelBatchDelete(channelIDs []int) {
	for _, id := range channelIDs {
		invalidatePendingGuards(id, "channel_delete_batch")
	}
}

// appendAutoSyncForChannel 在独立短事务中加载配置、构建 Guard、追加事件。
// 任何失败仅记日志，不影响渠道 CRUD 结果。
func appendAutoSyncForChannel(channel *model.Channel, trigger string) {
	defer func() {
		if r := recover(); r != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf("auto sync hook panic: %v", r))
		}
	}()
	now := common.GetTimestamp()
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		config, err := service.LoadChannelAutoSyncConfigTx(tx)
		if err != nil {
			return err
		}
		if !config.PriceEnabled && !config.MetadataEnabled {
			return nil
		}
		var guard *model.AutoPriceGuard
		if config.PriceEnabled {
			guard, err = service.BuildChannelAutoPriceGuardTx(tx, channel, config, now)
			if err != nil {
				return err
			}
		}
		return service.AppendChannelAutoSyncEventsTx(tx, channel, config, trigger, guard, now)
	})
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("auto sync hook failed for channel %d: %v", channel.Id, err))
	}
}

// invalidatePendingGuards 失效指定渠道的所有 pending Guard。
// 这是补偿机制的核心：即使后续 Auto Sync Event 写入失败，Guard 的 pending
// 状态也会被清除，下次周期任务不会据此误删渠道。
func invalidatePendingGuards(channelID int, reason string) {
	defer func() {
		if r := recover(); r != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf("auto sync invalidate guard panic: %v", r))
		}
	}()
	_, err := model.InvalidatePendingAutoPriceGuardsByChannelTx(model.DB, channelID, reason)
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("auto sync invalidate guard failed for channel %d: %v", channelID, err))
	}
}
