package service

import (
	"github.com/QuantumNous/new-api/dto"
	relaykitdto "github.com/QuantumNous/new-api/relaykit/dto"
)

// billing_usage_bridge.go — 桥接旧版 dto.Usage 与 relaykit/dto.Usage，使已迁移的
// effectiveBillingUsage / appendUsageBillingPathForLog（定义在 billing_usage.go，
// 操作 relaykit/dto 类型）能进入旧版 text_quota.go 的计费调用链。
//
// 设计原则：
//   - 不改旧版 dto.Usage / relaykit/dto.Usage 结构体
//   - 不改 PostTextConsumeQuota 签名（仍接收 *dto.Usage 旧版）
//   - 当 BillingUsage 为 nil（旧版当前所有路径）时，返回值与输入完全一致 — 零行为变化
//   - 当 BillingUsage 存在时（未来 relayconvert 或直接填充），effectiveBillingUsage
//     返回的 token 计数会被正确反映回旧版 dto.Usage

// effectiveBillingUsageFromOldDto 将旧版 dto.Usage 桥接到 relaykit/dto.Usage，
// 调用 effectiveBillingUsage 提取 BillingUsage 派生的有效用量，再转回旧版 dto.Usage。
func effectiveBillingUsageFromOldDto(usage *dto.Usage) *dto.Usage {
	if usage == nil {
		return nil
	}
	relaykitUsage := oldUsageToRelaykit(usage)
	effective := effectiveBillingUsage(relaykitUsage)
	return relaykitUsageToOld(effective)
}

// appendUsageBillingPathForLogFromOldDto 桥接旧版 dto.Usage 到 relaykit/dto.Usage，
// 用于 billing path 日志记录。
func appendUsageBillingPathForLogFromOldDto(other map[string]interface{}, isLocalCountTokens bool, usage *dto.Usage) {
	appendUsageBillingPathForLog(other, isLocalCountTokens, oldUsageToRelaykit(usage))
}

// oldUsageToRelaykit 将旧版 dto.Usage 转换为 relaykit/dto.Usage。
// BillingUsage 始终为 nil（旧版 dto.Usage 没有该字段）。
func oldUsageToRelaykit(usage *dto.Usage) *relaykitdto.Usage {
	if usage == nil {
		return nil
	}
	result := &relaykitdto.Usage{
		PromptTokens:                usage.PromptTokens,
		CompletionTokens:            usage.CompletionTokens,
		TotalTokens:                 usage.TotalTokens,
		PromptCacheHitTokens:        usage.PromptCacheHitTokens,
		UsageSemantic:               usage.UsageSemantic,
		UsageSource:                 usage.UsageSource,
		BillingUsage:                nil,
		PromptTokensDetails:         oldInputDetailsToRelaykit(usage.PromptTokensDetails),
		CompletionTokenDetails:      oldOutputDetailsToRelaykit(usage.CompletionTokenDetails),
		InputTokens:                 usage.InputTokens,
		OutputTokens:                usage.OutputTokens,
		ClaudeCacheCreation5mTokens: usage.ClaudeCacheCreation5mTokens,
		ClaudeCacheCreation1hTokens: usage.ClaudeCacheCreation1hTokens,
		Cost:                        usage.Cost,
	}
	if usage.InputTokensDetails != nil {
		details := oldInputDetailsToRelaykit(*usage.InputTokensDetails)
		result.InputTokensDetails = &details
	}
	return result
}

// relaykitUsageToOld 将 relaykit/dto.Usage 转换回旧版 dto.Usage。
// BillingUsage 字段被丢弃（旧版没有该字段），但 effectiveBillingUsage 已将
// BillingUsage 派生的 token 计数写入主字段，因此计费结果不受影响。
// CacheWriteTokens 被合并到 CachedCreationTokens（取较大值），确保
// 旧版 calculateTextQuotaSummary 能正确读取 cache creation tokens。
func relaykitUsageToOld(usage *relaykitdto.Usage) *dto.Usage {
	if usage == nil {
		return nil
	}
	result := &dto.Usage{
		PromptTokens:                usage.PromptTokens,
		CompletionTokens:            usage.CompletionTokens,
		TotalTokens:                 usage.TotalTokens,
		PromptCacheHitTokens:        usage.PromptCacheHitTokens,
		UsageSemantic:               usage.UsageSemantic,
		UsageSource:                 usage.UsageSource,
		PromptTokensDetails:         relaykitInputDetailsToOld(usage.PromptTokensDetails),
		CompletionTokenDetails:      relaykitOutputDetailsToOld(usage.CompletionTokenDetails),
		InputTokens:                 usage.InputTokens,
		OutputTokens:                usage.OutputTokens,
		ClaudeCacheCreation5mTokens: usage.ClaudeCacheCreation5mTokens,
		ClaudeCacheCreation1hTokens: usage.ClaudeCacheCreation1hTokens,
		Cost:                        usage.Cost,
	}
	if usage.InputTokensDetails != nil {
		details := relaykitInputDetailsToOld(*usage.InputTokensDetails)
		result.InputTokensDetails = &details
	}
	return result
}

func oldInputDetailsToRelaykit(d dto.InputTokenDetails) relaykitdto.InputTokenDetails {
	return relaykitdto.InputTokenDetails{
		CachedTokens:         d.CachedTokens,
		CachedCreationTokens: d.CachedCreationTokens,
		TextTokens:           d.TextTokens,
		AudioTokens:          d.AudioTokens,
		ImageTokens:          d.ImageTokens,
	}
}

func relaykitInputDetailsToOld(d relaykitdto.InputTokenDetails) dto.InputTokenDetails {
	result := dto.InputTokenDetails{
		CachedTokens:         d.CachedTokens,
		CachedCreationTokens: d.CachedCreationTokens,
		TextTokens:           d.TextTokens,
		AudioTokens:          d.AudioTokens,
		ImageTokens:          d.ImageTokens,
	}
	if d.CacheWriteTokens > result.CachedCreationTokens {
		result.CachedCreationTokens = d.CacheWriteTokens
	}
	return result
}

func oldOutputDetailsToRelaykit(d dto.OutputTokenDetails) relaykitdto.OutputTokenDetails {
	return relaykitdto.OutputTokenDetails{
		TextTokens:      d.TextTokens,
		AudioTokens:     d.AudioTokens,
		ImageTokens:     d.ImageTokens,
		ReasoningTokens: d.ReasoningTokens,
	}
}

func relaykitOutputDetailsToOld(d relaykitdto.OutputTokenDetails) dto.OutputTokenDetails {
	return dto.OutputTokenDetails{
		TextTokens:      d.TextTokens,
		AudioTokens:     d.AudioTokens,
		ImageTokens:     d.ImageTokens,
		ReasoningTokens: d.ReasoningTokens,
	}
}
