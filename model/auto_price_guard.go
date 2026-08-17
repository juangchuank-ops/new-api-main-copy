package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type AutoPriceGuardState string

const (
	AutoPriceGuardStatePending     AutoPriceGuardState = "pending"
	AutoPriceGuardStateUsed        AutoPriceGuardState = "used"
	AutoPriceGuardStateInvalidated AutoPriceGuardState = "invalidated"
	AutoPriceGuardStateDeleting    AutoPriceGuardState = "deleting"
	AutoPriceGuardStateResolved    AutoPriceGuardState = "resolved"
	AutoPriceGuardStateDeleted     AutoPriceGuardState = "deleted"
)

// AutoPriceGuard 故意不与 Channel 建立关联：Guard tombstone 必须在渠道
// 删除后仍然存活，以避免陈旧缓存条目误删渠道。
//
// 本表为方案 E 的独立表，通过 ChannelID 关联，不在 Channel 模型上挂
// AutoPriceGuardID 指针。当前活动 Guard 通过
// (channel_id, state='pending') 查询。
//
// InitialConfigHash 替代新版的 InitialRevision：渠道配置内容的 SHA256
// hash，用于检测 Guard 创建后渠道配置是否变更。若 Guard 创建后配置
// hash 不变，则 Guard 仍有效；若变化则 Guard 被失效。
type AutoPriceGuard struct {
	ID                   int64               `json:"id" gorm:"primaryKey"`
	ChannelID            int                 `json:"channel_id" gorm:"index;not null"`
	State                AutoPriceGuardState `json:"state" gorm:"type:varchar(16);index;not null"`
	InitialRevision      int64               `json:"initial_revision" gorm:"not null"`
	InitialConfigHash    string              `json:"initial_config_hash" gorm:"type:varchar(64);index"`
	InitialMissingModels string              `json:"initial_missing_models" gorm:"type:text"`
	InitialUsedQuota     int64               `json:"initial_used_quota" gorm:"not null"`
	Source               string              `json:"source" gorm:"type:text"`
	Reason               string              `json:"reason" gorm:"type:text"`
	CreatedAt            int64               `json:"created_at" gorm:"bigint;index"`
	UpdatedAt            int64               `json:"updated_at" gorm:"bigint;index"`
}

func (AutoPriceGuard) TableName() string {
	return "channel_auto_price_guards"
}

type AutoPriceGuardCASResult struct {
	Found         bool
	Transitioned  bool
	State         AutoPriceGuardState
	ChannelID     int
	OwnerMatched  bool
}

// UseChannelAutoPriceGuardCAS 是请求所拥有的 guard 转换。与遗留的通用 CAS
// 不同，它将转换绑定到选定的渠道，因此一个陈旧/错误关联的缓存条目永远
// 无法消费另一个渠道的 guard。
func UseChannelAutoPriceGuardCAS(guardID int64, channelID int) (AutoPriceGuardCASResult, error) {
	return UseChannelAutoPriceGuardCASTx(DB, guardID, channelID)
}

func UseChannelAutoPriceGuardCASTx(tx *gorm.DB, guardID int64, channelID int) (AutoPriceGuardCASResult, error) {
	if tx == nil {
		return AutoPriceGuardCASResult{}, errors.New("auto price guard transaction is nil")
	}
	result := tx.Model(&AutoPriceGuard{}).Where("id = ? AND channel_id = ? AND state = ?", guardID, channelID, AutoPriceGuardStatePending).
		Updates(map[string]any{"state": AutoPriceGuardStateUsed, "updated_at": common.GetTimestamp()})
	if result.Error != nil {
		return AutoPriceGuardCASResult{}, result.Error
	}
	if result.RowsAffected == 1 {
		return AutoPriceGuardCASResult{Found: true, Transitioned: true, State: AutoPriceGuardStateUsed, ChannelID: channelID, OwnerMatched: true}, nil
	}
	guard, err := GetAutoPriceGuardTx(tx, guardID)
	if err != nil {
		return AutoPriceGuardCASResult{}, err
	}
	if guard == nil {
		return AutoPriceGuardCASResult{}, nil
	}
	return AutoPriceGuardCASResult{Found: true, State: guard.State, ChannelID: guard.ChannelID, OwnerMatched: guard.ChannelID == channelID}, nil
}

func (guard *AutoPriceGuard) BeforeCreate(_ *gorm.DB) error {
	if guard.State == "" {
		guard.State = AutoPriceGuardStatePending
	}
	now := common.GetTimestamp()
	if guard.CreatedAt == 0 {
		guard.CreatedAt = now
	}
	if guard.UpdatedAt == 0 {
		guard.UpdatedAt = now
	}
	return nil
}

// GetAutoPriceGuard 对缺失的 guard 返回 nil, nil，这有别于包括 deleted
// tombstone 在内的所有持久化状态。
func GetAutoPriceGuard(id int64) (*AutoPriceGuard, error) {
	return GetAutoPriceGuardTx(DB, id)
}

func GetAutoPriceGuardTx(tx *gorm.DB, id int64) (*AutoPriceGuard, error) {
	if tx == nil {
		return nil, errors.New("auto price guard transaction is nil")
	}
	var guard AutoPriceGuard
	err := tx.Where("id = ?", id).First(&guard).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &guard, nil
}

// GetPendingAutoPriceGuardByChannel 按渠道查询当前 pending 的 Guard。
// 替代新版 Channel.AutoPriceGuardID 指针的快速访问。
func GetPendingAutoPriceGuardByChannel(channelID int) (*AutoPriceGuard, error) {
	return GetPendingAutoPriceGuardByChannelTx(DB, channelID)
}

func GetPendingAutoPriceGuardByChannelTx(tx *gorm.DB, channelID int) (*AutoPriceGuard, error) {
	if tx == nil {
		return nil, errors.New("auto price guard transaction is nil")
	}
	var guard AutoPriceGuard
	err := tx.Where("channel_id = ? AND state = ?", channelID, AutoPriceGuardStatePending).
		Order("id desc").First(&guard).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &guard, nil
}

func transitionAutoPriceGuardTx(tx *gorm.DB, id int64, to AutoPriceGuardState, reason string) (AutoPriceGuardCASResult, error) {
	if tx == nil {
		return AutoPriceGuardCASResult{}, errors.New("auto price guard transaction is nil")
	}
	result := tx.Model(&AutoPriceGuard{}).Where("id = ? AND state = ?", id, AutoPriceGuardStatePending).
		Updates(map[string]any{"state": to, "reason": reason, "updated_at": common.GetTimestamp()})
	if result.Error != nil {
		return AutoPriceGuardCASResult{}, result.Error
	}
	if result.RowsAffected == 1 {
		return AutoPriceGuardCASResult{Found: true, Transitioned: true, State: to}, nil
	}
	guard, err := GetAutoPriceGuardTx(tx, id)
	if err != nil {
		return AutoPriceGuardCASResult{}, err
	}
	if guard == nil {
		return AutoPriceGuardCASResult{}, nil
	}
	return AutoPriceGuardCASResult{Found: true, State: guard.State}, nil
}

func UseAutoPriceGuardCAS(id int64) (AutoPriceGuardCASResult, error) {
	return UseAutoPriceGuardCASTx(DB, id)
}

func UseAutoPriceGuardCASTx(tx *gorm.DB, id int64) (AutoPriceGuardCASResult, error) {
	return transitionAutoPriceGuardTx(tx, id, AutoPriceGuardStateUsed, "")
}

func UseAutoPriceGuardTx(tx *gorm.DB, id int64) (AutoPriceGuardCASResult, error) {
	return UseAutoPriceGuardCASTx(tx, id)
}

func DeleteAutoPriceGuardCAS(id int64) (AutoPriceGuardCASResult, error) {
	return DeleteAutoPriceGuardCASTx(DB, id)
}

func DeleteAutoPriceGuardCASTx(tx *gorm.DB, id int64) (AutoPriceGuardCASResult, error) {
	return transitionAutoPriceGuardTx(tx, id, AutoPriceGuardStateDeleting, "")
}

func DeleteAutoPriceGuardTx(tx *gorm.DB, id int64) (AutoPriceGuardCASResult, error) {
	return DeleteAutoPriceGuardCASTx(tx, id)
}

func InvalidateAutoPriceGuardCAS(id int64, reason string) (AutoPriceGuardCASResult, error) {
	return InvalidateAutoPriceGuardCASTx(DB, id, reason)
}

func InvalidateAutoPriceGuardCASTx(tx *gorm.DB, id int64, reason string) (AutoPriceGuardCASResult, error) {
	return transitionAutoPriceGuardTx(tx, id, AutoPriceGuardStateInvalidated, reason)
}

func InvalidateAutoPriceGuardTx(tx *gorm.DB, id int64, reason string) (AutoPriceGuardCASResult, error) {
	return InvalidateAutoPriceGuardCASTx(tx, id, reason)
}

// ResolveAutoPriceGuardTx 在价格任务将渠道分类为保留后关闭非 deleting 的
// guard。Deleted guard 保持为持久 tombstone，deleting guard 只能使用
// UpdateAutoPriceGuardTerminalTx。
func ResolveAutoPriceGuardTx(tx *gorm.DB, id int64, reason string) (bool, error) {
	if tx == nil {
		return false, errors.New("auto price guard transaction is nil")
	}
	result := tx.Model(&AutoPriceGuard{}).
		Where("id = ? AND state IN ?", id, []AutoPriceGuardState{
			AutoPriceGuardStatePending,
			AutoPriceGuardStateUsed,
			AutoPriceGuardStateInvalidated,
		}).
		Updates(map[string]any{"state": AutoPriceGuardStateResolved, "reason": reason, "updated_at": common.GetTimestamp()})
	return result.RowsAffected == 1, result.Error
}

// UpdateAutoPriceGuardTerminal 将 deleting guard 更新为终态。
// Deleted 是 tombstone 状态，而非行删除。
func UpdateAutoPriceGuardTerminal(id int64, state AutoPriceGuardState, reason string) (bool, error) {
	return UpdateAutoPriceGuardTerminalTx(DB, id, state, reason)
}

func UpdateAutoPriceGuardTerminalTx(tx *gorm.DB, id int64, state AutoPriceGuardState, reason string) (bool, error) {
	if tx == nil {
		return false, errors.New("auto price guard transaction is nil")
	}
	if state != AutoPriceGuardStateResolved && state != AutoPriceGuardStateDeleted {
		return false, errors.New("auto price guard terminal state must be resolved or deleted")
	}
	result := tx.Model(&AutoPriceGuard{}).Where("id = ? AND state = ?", id, AutoPriceGuardStateDeleting).
		Updates(map[string]any{"state": state, "reason": reason, "updated_at": common.GetTimestamp()})
	return result.RowsAffected == 1, result.Error
}

// ListPendingAutoPriceGuardsTx 返回所有 pending 状态的 Guard，供 reconciliation
// 扫描使用。
func ListPendingAutoPriceGuardsTx(tx *gorm.DB) ([]*AutoPriceGuard, error) {
	if tx == nil {
		return nil, errors.New("auto price guard transaction is nil")
	}
	var guards []*AutoPriceGuard
	err := tx.Where("state = ?", AutoPriceGuardStatePending).
		Order("id asc").Find(&guards).Error
	return guards, err
}

// PurgeTerminalAutoPriceGuardsBeforeTx 物理删除早于给定时间戳的终态 Guard，
// 防止 Guard 表无限增长。仅由维护任务调用。
func PurgeTerminalAutoPriceGuardsBeforeTx(tx *gorm.DB, before int64) (int64, error) {
	if tx == nil {
		return 0, errors.New("auto price guard transaction is nil")
	}
	result := tx.Where("state IN ? AND updated_at < ?", []AutoPriceGuardState{
		AutoPriceGuardStateResolved,
		AutoPriceGuardStateDeleted,
	}, before).Delete(&AutoPriceGuard{})
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}
