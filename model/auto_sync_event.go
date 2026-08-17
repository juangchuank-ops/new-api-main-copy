package model

import (
	"errors"
	"fmt"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const autoSyncDebounceSeconds int64 = 5

// AutoSyncTaskPayload 是冻结的事件批次的完整、不含密钥的调度器 payload。
type AutoSyncTaskPayload struct {
	EventType        string `json:"event_type"`
	CutoffGeneration int64  `json:"cutoff_generation"`
}

// AutoSyncCursor 是按同步类型划分的持久化去抖游标。每次事件推进
// Generation，使调度器可以冻结一个精确的批次。
type AutoSyncCursor struct {
	Type       string `json:"type" gorm:"type:varchar(64);primaryKey"`
	Generation int64  `json:"generation" gorm:"not null"`
	DueAt      int64  `json:"due_at" gorm:"bigint;index;not null"`
	UpdatedAt  int64  `json:"updated_at" gorm:"bigint;not null"`
}

func (AutoSyncCursor) TableName() string {
	return "channel_auto_sync_cursors"
}

// AutoSyncEvent 仅包含调度器元数据；调用方不得在 Payload 中持久化渠道密钥。
type AutoSyncEvent struct {
	ID          int64  `json:"id" gorm:"primaryKey"`
	Type        string `json:"type" gorm:"type:varchar(64);index;not null"`
	Generation  int64  `json:"generation" gorm:"index;not null"`
	ChannelID   int    `json:"channel_id" gorm:"index;not null"`
	Trigger     string `json:"trigger" gorm:"type:varchar(64);not null"`
	Payload     string `json:"payload" gorm:"type:text"`
	State       string `json:"state" gorm:"type:text"`
	TaskID      string `json:"task_id" gorm:"type:varchar(64);index"`
	EventAt     int64  `json:"event_at" gorm:"bigint;index;not null"`
	ProcessedAt *int64 `json:"processed_at" gorm:"bigint;index"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint;index;not null"`
}

func (AutoSyncEvent) TableName() string {
	return "channel_auto_sync_events"
}

// autoSyncCursorLocks 用于避免本进程内并发生产者导致的 SQLITE_BUSY 失败。
// Generation 的 compare-and-swap 仍是跨进程/跨方言的正确性机制。
var autoSyncCursorLocks sync.Map

func autoSyncCursorLock(eventType string) *sync.Mutex {
	lock, _ := autoSyncCursorLocks.LoadOrStore(eventType, &sync.Mutex{})
	return lock.(*sync.Mutex)
}

// AppendAutoSyncEventTx 在同一事务内推进游标并插入事件。
// EventAt 为 0 时默认为当前时间戳。
func AppendAutoSyncEventTx(tx *gorm.DB, event *AutoSyncEvent) error {
	if tx == nil {
		return errors.New("auto sync transaction is nil")
	}
	if event == nil || event.Type == "" {
		return errors.New("auto sync event type is required")
	}
	if event.EventAt == 0 {
		event.EventAt = common.GetTimestamp()
	}
	if event.CreatedAt == 0 {
		event.CreatedAt = event.EventAt
	}

	lock := autoSyncCursorLock(event.Type)
	lock.Lock()
	defer lock.Unlock()

	for attempts := 0; attempts < 8; attempts++ {
		var cursor AutoSyncCursor
		err := lockForUpdate(tx).Where("type = ?", event.Type).First(&cursor).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			cursor = AutoSyncCursor{Type: event.Type, Generation: 1, DueAt: event.EventAt + autoSyncDebounceSeconds, UpdatedAt: event.EventAt}
			result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&cursor)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				continue // 冲突已被安全忽略；在本事务内重试
			}
			event.Generation = cursor.Generation
			return tx.Create(event).Error
		}
		if err != nil {
			return err
		}

		nextGeneration := cursor.Generation + 1
		proposedDueAt := event.EventAt + autoSyncDebounceSeconds
		result := tx.Model(&AutoSyncCursor{}).
			Where("type = ? AND generation = ?", event.Type, cursor.Generation).
			Updates(map[string]any{
				"generation": nextGeneration,
				"due_at":     gorm.Expr("CASE WHEN due_at > ? THEN due_at ELSE ? END", proposedDueAt, proposedDueAt),
				"updated_at": gorm.Expr("CASE WHEN updated_at > ? THEN updated_at ELSE ? END", event.EventAt, event.EventAt),
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			continue
		}
		event.Generation = nextGeneration
		return tx.Create(event).Error
	}
	return fmt.Errorf("auto sync cursor CAS retry limit reached for type %q", event.Type)
}

// FreezeDueAutoSyncBatchTx 在静默窗口已过时冻结当前 generation。
// 生产者必须在插入前推进同一游标，因此后续事件会获得大于此 cutoff 的
// generation。
func FreezeDueAutoSyncBatchTx(tx *gorm.DB, eventType string, now int64) (int64, bool, error) {
	if tx == nil {
		return 0, false, errors.New("auto sync transaction is nil")
	}
	lock := autoSyncCursorLock(eventType)
	lock.Lock()
	defer lock.Unlock()
	return freezeDueAutoSyncBatchTx(tx, eventType, now)
}

func freezeDueAutoSyncBatchTx(tx *gorm.DB, eventType string, now int64) (int64, bool, error) {
	var cursor AutoSyncCursor
	err := lockForUpdate(tx).Where("type = ?", eventType).First(&cursor).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	if cursor.DueAt > now {
		return 0, false, nil
	}
	return cursor.Generation, true, nil
}

// BuildDueAutoSyncTaskTx 原子地冻结一个到期批次并创建其普通 singleton
// SystemTask。若游标无待处理事件，则清除游标而非产生空任务。
func BuildDueAutoSyncTaskTx(tx *gorm.DB, eventType string, now int64) (*SystemTask, bool, error) {
	if tx == nil {
		return nil, false, errors.New("auto sync transaction is nil")
	}
	lock := autoSyncCursorLock(eventType)
	lock.Lock()
	defer lock.Unlock()

	cutoff, due, err := freezeDueAutoSyncBatchTx(tx, eventType, now)
	if err != nil || !due {
		return nil, false, err
	}
	var pendingCount int64
	if err := tx.Model(&AutoSyncEvent{}).
		Where("type = ? AND generation <= ? AND processed_at IS NULL", eventType, cutoff).
		Count(&pendingCount).Error; err != nil {
		return nil, false, err
	}
	if pendingCount == 0 {
		result := tx.Model(&AutoSyncCursor{}).Where("type = ? AND generation = ?", eventType, cutoff).
			Update("due_at", 0)
		return nil, false, result.Error
	}
	task, err := CreateSystemTaskTx(tx, eventType, AutoSyncTaskPayload{EventType: eventType, CutoffGeneration: cutoff}, nil)
	if err != nil {
		return nil, false, err
	}
	return task, true, nil
}

func ListPendingAutoSyncEventsTx(tx *gorm.DB, eventType string, cutoffGeneration int64) ([]*AutoSyncEvent, error) {
	if tx == nil {
		return nil, errors.New("auto sync transaction is nil")
	}
	var events []*AutoSyncEvent
	err := tx.Where("type = ? AND generation <= ? AND processed_at IS NULL", eventType, cutoffGeneration).
		Order("generation asc, id asc").Find(&events).Error
	return events, err
}

func ListPendingAutoSyncEvents(eventType string, cutoffGeneration int64) ([]*AutoSyncEvent, error) {
	return ListPendingAutoSyncEventsTx(DB, eventType, cutoffGeneration)
}

// MarkAutoSyncEventsProcessedTx 终态标记精确给定的 event ID。
// 保留 type/cutoff 谓词可防止一个陈旧的 handler 吸收后继 generation。
func MarkAutoSyncEventsProcessedTx(tx *gorm.DB, eventType string, cutoffGeneration int64, eventIDs []int64, taskID string) error {
	if tx == nil {
		return errors.New("auto sync transaction is nil")
	}
	if len(eventIDs) == 0 {
		return nil
	}
	now := common.GetTimestamp()
	return tx.Model(&AutoSyncEvent{}).
		Where("id IN ? AND type = ? AND generation <= ? AND processed_at IS NULL", eventIDs, eventType, cutoffGeneration).
		Updates(map[string]any{"task_id": taskID, "processed_at": now}).Error
}

// FinalizeAutoSyncBatchTx 标记本 handler 的 event ID 为终态，并在不存在
// 后继 generation 时清除游标。它旨在与 handler 终态事务组合使用。
func FinalizeAutoSyncBatchTx(tx *gorm.DB, eventType string, cutoffGeneration int64, eventIDs []int64, taskID string) error {
	if tx == nil {
		return errors.New("auto sync transaction is nil")
	}
	if err := MarkAutoSyncEventsProcessedTx(tx, eventType, cutoffGeneration, eventIDs, taskID); err != nil {
		return err
	}
	lock := autoSyncCursorLock(eventType)
	lock.Lock()
	defer lock.Unlock()
	var cursor AutoSyncCursor
	err := lockForUpdate(tx).Where("type = ?", eventType).First(&cursor).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if cursor.Generation <= cutoffGeneration {
		return tx.Model(&AutoSyncCursor{}).Where("type = ? AND generation = ?", eventType, cursor.Generation).Update("due_at", 0).Error
	}
	return nil
}

// InvalidatePendingAutoPriceGuardsByChannelTx 在渠道变更/删除后将该渠道所有
// pending 的价格 Guard 置为 invalidated。返回受影响行数。该函数是 Auto Sync
// post-commit 补偿机制的核心：即使后续 Auto Sync Event 写入失败，Guard 的
// pending 状态也会被清除，下次周期任务不会据此误删渠道。
func InvalidatePendingAutoPriceGuardsByChannelTx(tx *gorm.DB, channelID int, reason string) (int64, error) {
	if tx == nil {
		return 0, errors.New("auto price guard transaction is nil")
	}
	now := common.GetTimestamp()
	result := tx.Model(&AutoPriceGuard{}).
		Where("channel_id = ? AND state = ?", channelID, AutoPriceGuardStatePending).
		Updates(map[string]any{"state": AutoPriceGuardStateInvalidated, "reason": reason, "updated_at": now})
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}

// CountPendingAutoSyncEvents 返回给定类型的未处理事件数，供状态视图与
// reconciliation 判断使用。
func CountPendingAutoSyncEvents(eventType string) (int64, error) {
	var count int64
	if err := DB.Model(&AutoSyncEvent{}).
		Where("type = ? AND processed_at IS NULL", eventType).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// GetAutoSyncCursor 返回给定类型的游标，不存在时返回 (nil, nil)。
func GetAutoSyncCursor(eventType string) (*AutoSyncCursor, error) {
	var cursor AutoSyncCursor
	if err := DB.Where("type = ?", eventType).First(&cursor).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &cursor, nil
}

// PurgeProcessedAutoSyncEventsBeforeTx 物理删除早于给定时间戳的已处理事件，
// 防止事件表无限增长。仅由维护任务调用。
func PurgeProcessedAutoSyncEventsBeforeTx(tx *gorm.DB, before int64) (int64, error) {
	if tx == nil {
		return 0, errors.New("auto sync transaction is nil")
	}
	result := tx.Where("processed_at IS NOT NULL AND processed_at < ?", before).
		Delete(&AutoSyncEvent{})
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}
