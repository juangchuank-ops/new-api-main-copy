package service

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	maxAutoSyncResultIDs    = 100
	maxAutoSyncResultErrors = 20
	autoSyncSchedulerInterval = 15 * time.Second
)

type AutoPriceSyncTaskSummary struct {
	EventCount       int      `json:"event_count"`
	SourceCount      int      `json:"source_count"`
	ModelsConsidered int      `json:"models_considered"`
	PricesFilled     int      `json:"prices_filled"`
	RetainedChannels []int    `json:"retained_channels"`
	DeletedChannels  []int    `json:"deleted_channels"`
	SkippedChannels  []int    `json:"skipped_channels"`
	Errors           []string `json:"errors"`
}

type AutoModelMetadataSyncTaskSummary struct {
	EventCount     int      `json:"event_count"`
	CreatedModels  int      `json:"created_models"`
	CreatedVendors int      `json:"created_vendors"`
	SkippedModels  int      `json:"skipped_models"`
	Errors         []string `json:"errors"`
}

type AutoSyncTaskRunResult[T any] struct {
	Summary  T
	EventIDs []int64
	Failed   bool
}

type autoPriceSourceBatch struct {
	Source PricingSourceDescriptor
	Models map[string]struct{}
}

// RunAutoPriceSyncBatch performs idempotent business work for one frozen event
// generation. Returned errors are infrastructure/cancellation errors and must
// leave the events pending. Classified upstream/business failures are recorded
// in Summary and set Failed while allowing the batch to finish terminally.
func RunAutoPriceSyncBatch(ctx context.Context, cutoffGeneration int64) (AutoSyncTaskRunResult[AutoPriceSyncTaskSummary], error) {
	out := AutoSyncTaskRunResult[AutoPriceSyncTaskSummary]{Summary: AutoPriceSyncTaskSummary{Errors: []string{}, RetainedChannels: []int{}, DeletedChannels: []int{}, SkippedChannels: []int{}}}
	events, err := model.ListPendingAutoSyncEvents(AutoPriceSyncEventType, cutoffGeneration)
	if err != nil {
		return out, err
	}
	out.Summary.EventCount = len(events)
	groups := map[string]*autoPriceSourceBatch{}
	guardIDs := map[int64]struct{}{}
	for _, event := range events {
		if err := ctx.Err(); err != nil {
			return out, err
		}
		out.EventIDs = append(out.EventIDs, event.ID)
		var payload AutoPriceSyncEventPayload
		if err := json.Unmarshal([]byte(event.Payload), &payload); err != nil {
			out.Failed = true
			appendAutoSyncError(&out.Summary.Errors, errors.New("invalid price sync event"))
			continue
		}
		source, err := ValidatePricingSourceDescriptor(payload.Source)
		if err != nil || validateSnapshotModels(payload.Models) != nil {
			out.Failed = true
			appendAutoSyncError(&out.Summary.Errors, errors.New("invalid price sync event source"))
			continue
		}
		sourceJSON, _ := json.Marshal(source)
		key := string(sourceJSON)
		batch := groups[key]
		if batch == nil {
			batch = &autoPriceSourceBatch{Source: source, Models: map[string]struct{}{}}
			groups[key] = batch
		}
		for _, name := range payload.Models {
			batch.Models[name] = struct{}{}
		}
		if payload.GuardID != 0 {
			guardIDs[payload.GuardID] = struct{}{}
		}
	}
	out.Summary.SourceCount = len(groups)
	modelSet := map[string]struct{}{}
	for _, group := range groups {
		for name := range group.Models {
			modelSet[name] = struct{}{}
		}
		if err := ctx.Err(); err != nil {
			return out, err
		}
		pricing, fetchErr := FetchNormalizedPricing(ctx, group.Source, 20*time.Second)
		if fetchErr != nil {
			out.Failed = true
			appendAutoSyncError(&out.Summary.Errors, fetchErr)
			continue
		}
		models := sortedStringSet(group.Models)
		var operations []PricingPatchOperation
		for attempt := 0; attempt < 3; attempt++ {
			operations, err = BuildMissingPricingPatch(models, pricing)
			if err != nil || len(operations) == 0 {
				break
			}
			_, applied, patchErr := PatchPricingOptionsWithApplied(operations)
			if patchErr == nil {
				out.Summary.PricesFilled += applied
				err = nil
				break
			}
			err = patchErr
			if !errors.Is(patchErr, ErrPricingPatchConflict) {
				break
			}
		}
		if err != nil {
			out.Failed = true
			appendAutoSyncError(&out.Summary.Errors, err)
		}
	}
	out.Summary.ModelsConsidered = len(modelSet)

	orderedGuards := make([]int64, 0, len(guardIDs))
	for id := range guardIDs {
		orderedGuards = append(orderedGuards, id)
	}
	sort.Slice(orderedGuards, func(i, j int) bool { return orderedGuards[i] < orderedGuards[j] })
	cacheRefresh := false
	for _, guardID := range orderedGuards {
		if err := ctx.Err(); err != nil {
			return out, err
		}
		decision, channelID, changedCache, decisionErr := finalizeAutoPriceGuard(guardID)
		if decisionErr != nil {
			out.Failed = true
			appendAutoSyncError(&out.Summary.Errors, decisionErr)
			appendBoundedInt(&out.Summary.SkippedChannels, channelID)
			continue
		}
		cacheRefresh = cacheRefresh || changedCache
		switch decision {
		case "deleted":
			appendBoundedInt(&out.Summary.DeletedChannels, channelID)
		case "retained":
			appendBoundedInt(&out.Summary.RetainedChannels, channelID)
		default:
			appendBoundedInt(&out.Summary.SkippedChannels, channelID)
		}
	}
	if cacheRefresh {
		model.InitChannelCache()
		ResetProxyClientCache()
	}
	return out, nil
}

// RunAutoModelMetadataSyncBatch 在旧版中降级运行：旧版无 SyncModelMetadata /
// WithNamedLease，事件仍被消费以防队列无限增长，但不执行实际元数据同步。
func RunAutoModelMetadataSyncBatch(ctx context.Context, cutoffGeneration int64) (AutoSyncTaskRunResult[AutoModelMetadataSyncTaskSummary], error) {
	out := AutoSyncTaskRunResult[AutoModelMetadataSyncTaskSummary]{Summary: AutoModelMetadataSyncTaskSummary{Errors: []string{}}}
	events, err := model.ListPendingAutoSyncEvents(AutoModelMetadataSyncEventType, cutoffGeneration)
	if err != nil {
		return out, err
	}
	out.Summary.EventCount = len(events)
	for _, event := range events {
		out.EventIDs = append(out.EventIDs, event.ID)
	}
	if len(events) == 0 {
		return out, nil
	}
	// 旧版降级：model metadata sync 不可用，事件被消费以防队列无限增长。
	logger.LogWarn(ctx, "auto model metadata sync is not available in legacy mode; events consumed without syncing")
	return out, nil
}

// finalizeAutoPriceGuard 适配旧版：使用 InitialConfigHash 替代 ConfigRevision 比较，
// 使用 GetPendingAutoPriceGuardByChannelTx 替代 AutoPriceGuardID 指针比较。
func finalizeAutoPriceGuard(guardID int64) (decision string, channelID int, cacheChanged bool, err error) {
	guard, err := model.GetAutoPriceGuard(guardID)
	if err != nil {
		return "skipped", 0, false, err
	}
	if guard == nil {
		return "skipped", 0, false, errors.New("auto price guard is missing")
	}
	channelID = guard.ChannelID
	if guard.State == model.AutoPriceGuardStateResolved {
		return "retained", channelID, false, nil
	}
	if guard.State == model.AutoPriceGuardStateDeleted || guard.State == model.AutoPriceGuardStateDeleting {
		return "deleted", channelID, false, nil
	}
	var initialMissing []string
	if json.Unmarshal([]byte(guard.InitialMissingModels), &initialMissing) != nil {
		return "skipped", channelID, false, errors.New("invalid auto price guard snapshot")
	}
	usageFound, usageErr := channelUsageEvidence(guard)
	if usageErr != nil {
		usageFound = true // uncertainty always preserves the channel
	}
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		var currentGuard model.AutoPriceGuard
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&currentGuard, "id = ?", guardID).Error; err != nil {
			return err
		}
		if currentGuard.State == model.AutoPriceGuardStateUsed || currentGuard.State == model.AutoPriceGuardStateInvalidated {
			decision = "retained"
			return resolveGuardAndClearChannelTx(tx, &currentGuard, "channel used or edited")
		}
		if currentGuard.State != model.AutoPriceGuardStatePending {
			decision = "skipped"
			return nil
		}
		var channel model.Channel
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&channel, "id = ?", currentGuard.ChannelID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				cas, casErr := model.DeleteAutoPriceGuardCASTx(tx, currentGuard.ID)
				if casErr != nil || !cas.Transitioned {
					return casErr
				}
				_, terminalErr := model.UpdateAutoPriceGuardTerminalTx(tx, currentGuard.ID, model.AutoPriceGuardStateDeleted, "channel already absent")
				decision = "deleted"
				return terminalErr
			}
			return err
		}
		priced, priceErr := hasAnyBasePriceTx(tx, initialMissing)
		if priceErr != nil {
			return priceErr
		}
		if len(initialMissing) == 0 || priced {
			decision = "retained"
			return resolveGuardAndClearChannelTx(tx, &currentGuard, "base price available")
		}
		// 方案 E 适配：使用 config hash 比较 ConfigRevision
		if computeChannelConfigHash(&channel) != currentGuard.InitialConfigHash {
			decision = "retained"
			return resolveGuardAndClearChannelTx(tx, &currentGuard, "channel configuration changed")
		}
		// 方案 E 适配：使用 pending guard 查询替代 AutoPriceGuardID 指针比较
		pendingGuard, lookupErr := model.GetPendingAutoPriceGuardByChannelTx(tx, channel.Id)
		if lookupErr != nil {
			return lookupErr
		}
		if pendingGuard == nil || pendingGuard.ID != currentGuard.ID {
			decision = "retained"
			return resolveGuardAndClearChannelTx(tx, &currentGuard, "channel configuration changed")
		}
		if usageFound || channel.UsedQuota > currentGuard.InitialUsedQuota {
			decision = "retained"
			reason := "channel usage detected"
			if usageErr != nil {
				reason = "channel usage could not be verified"
			}
			return resolveGuardAndClearChannelTx(tx, &currentGuard, reason)
		}
		cas, err := model.DeleteAutoPriceGuardCASTx(tx, currentGuard.ID)
		if err != nil {
			return err
		}
		if !cas.Transitioned {
			decision = "retained"
			return nil
		}
		if err := tx.Where("channel_id = ?", channel.Id).Delete(&model.Ability{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&model.Channel{}, channel.Id).Error; err != nil {
			return err
		}
		updated, err := model.UpdateAutoPriceGuardTerminalTx(tx, currentGuard.ID, model.AutoPriceGuardStateDeleted, "no base price available")
		if err != nil {
			return err
		}
		if !updated {
			return errors.New("auto price guard terminal transition failed")
		}
		decision, cacheChanged = "deleted", true
		return nil
	})
	return decision, channelID, cacheChanged, err
}

// resolveGuardAndClearChannelTx 方案 E 适配：旧版 Channel 无 auto_price_guard_id 列，
// 仅 resolve guard 即可，无需清零指针。
func resolveGuardAndClearChannelTx(tx *gorm.DB, guard *model.AutoPriceGuard, reason string) error {
	_, err := model.ResolveAutoPriceGuardTx(tx, guard.ID, reason)
	return err
}

func hasAnyBasePriceTx(tx *gorm.DB, names []string) (bool, error) {
	prices, err := loadPricingMapTx(tx, "ModelPrice")
	if err != nil {
		return false, err
	}
	ratios, err := loadPricingMapTx(tx, "ModelRatio")
	if err != nil {
		return false, err
	}
	for _, name := range names {
		if _, ok := prices[name]; ok {
			return true, nil
		}
		if _, ok := ratios[name]; ok {
			return true, nil
		}
	}
	return false, nil
}

func channelUsageEvidence(guard *model.AutoPriceGuard) (bool, error) {
	if model.LOG_DB == nil {
		return false, errors.New("log database unavailable")
	}
	var count int64
	err := model.LOG_DB.Model(&model.Log{}).
		Where("channel_id = ? AND created_at >= ?", guard.ChannelID, guard.CreatedAt).
		Limit(1).Count(&count).Error
	return count > 0, err
}

func appendAutoSyncError(target *[]string, err error) {
	if err == nil || len(*target) >= maxAutoSyncResultErrors {
		return
	}
	message := SanitizePricingError(err)
	if message == "" {
		message = "auto sync failed"
	}
	*target = append(*target, message)
}

func appendBoundedInt(target *[]int, value int) {
	if value != 0 && len(*target) < maxAutoSyncResultIDs {
		*target = append(*target, value)
	}
}

func sortedStringSet(values map[string]struct{}) []string {
	result := make([]string, 0, len(values))
	for value := range values {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

// --- Handler implementations ---

// autoPriceSyncHandler 实现 ScheduledSystemTaskHandler，由旧版调度器周期触发。
type autoPriceSyncHandler struct{}

func (autoPriceSyncHandler) Type() string         { return AutoPriceSyncEventType }
func (autoPriceSyncHandler) Interval() time.Duration { return autoSyncSchedulerInterval }
func (autoPriceSyncHandler) NewPayload() any {
	return model.AutoSyncTaskPayload{EventType: AutoPriceSyncEventType}
}

func (autoPriceSyncHandler) Enabled() bool {
	config, err := LoadChannelAutoSyncConfigTx(model.DB)
	if err != nil {
		return false
	}
	return config.PriceEnabled
}

func (h autoPriceSyncHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	var payload model.AutoSyncTaskPayload
	_ = task.DecodePayload(&payload)

	cutoff := payload.CutoffGeneration
	if cutoff == 0 {
		var due bool
		var err error
		cutoff, due, err = model.FreezeDueAutoSyncBatchTx(model.DB, AutoPriceSyncEventType, common.GetTimestamp())
		if err != nil {
			failSystemTask(task, runnerID, err)
			return
		}
		if !due {
			_ = model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, nil, "")
			return
		}
	}

	result, err := RunAutoPriceSyncBatch(ctx, cutoff)
	if err != nil {
		failSystemTask(task, runnerID, err)
		return
	}

	if err := model.FinalizeAutoSyncBatchTx(model.DB, AutoPriceSyncEventType, cutoff, result.EventIDs, task.TaskID); err != nil {
		failSystemTask(task, runnerID, err)
		return
	}

	_ = model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, result.Summary, "")
}

// autoModelMetadataSyncHandler 实现 ScheduledSystemTaskHandler，由旧版调度器周期触发。
type autoModelMetadataSyncHandler struct{}

func (autoModelMetadataSyncHandler) Type() string         { return AutoModelMetadataSyncEventType }
func (autoModelMetadataSyncHandler) Interval() time.Duration { return autoSyncSchedulerInterval }
func (autoModelMetadataSyncHandler) NewPayload() any {
	return model.AutoSyncTaskPayload{EventType: AutoModelMetadataSyncEventType}
}

func (autoModelMetadataSyncHandler) Enabled() bool {
	enabled, err := readBoolOption(AutoModelMetadataSyncEnabledOptionKey)
	if err != nil {
		return false
	}
	return enabled
}

func (h autoModelMetadataSyncHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	var payload model.AutoSyncTaskPayload
	_ = task.DecodePayload(&payload)

	cutoff := payload.CutoffGeneration
	if cutoff == 0 {
		var due bool
		var err error
		cutoff, due, err = model.FreezeDueAutoSyncBatchTx(model.DB, AutoModelMetadataSyncEventType, common.GetTimestamp())
		if err != nil {
			failSystemTask(task, runnerID, err)
			return
		}
		if !due {
			_ = model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, nil, "")
			return
		}
	}

	result, err := RunAutoModelMetadataSyncBatch(ctx, cutoff)
	if err != nil {
		failSystemTask(task, runnerID, err)
		return
	}

	if err := model.FinalizeAutoSyncBatchTx(model.DB, AutoModelMetadataSyncEventType, cutoff, result.EventIDs, task.TaskID); err != nil {
		failSystemTask(task, runnerID, err)
		return
	}

	_ = model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, result.Summary, "")
}

func init() {
	RegisterSystemTaskHandler(autoPriceSyncHandler{})
	RegisterSystemTaskHandler(autoModelMetadataSyncHandler{})
}
