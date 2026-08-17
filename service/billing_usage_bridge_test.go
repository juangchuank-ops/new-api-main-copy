package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaykitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Bridge conversion: oldUsageToRelaykit ---

func TestOldUsageToRelaykit_FieldCopy(t *testing.T) {
	old := &dto.Usage{
		PromptTokens:                100,
		CompletionTokens:            50,
		TotalTokens:                 150,
		PromptCacheHitTokens:        10,
		UsageSemantic:               "openai",
		UsageSource:                 "oai_chat",
		PromptTokensDetails:         dto.InputTokenDetails{CachedTokens: 5, CachedCreationTokens: 3, TextTokens: 90, AudioTokens: 2, ImageTokens: 1},
		CompletionTokenDetails:      dto.OutputTokenDetails{TextTokens: 40, AudioTokens: 5, ImageTokens: 3, ReasoningTokens: 2},
		InputTokens:                 100,
		OutputTokens:                50,
		ClaudeCacheCreation5mTokens: 7,
		ClaudeCacheCreation1hTokens: 9,
		Cost:                        map[string]any{"total": "0.001"},
	}
	old.InputTokensDetails = &dto.InputTokenDetails{CachedTokens: 1, TextTokens: 99}

	rk := oldUsageToRelaykit(old)
	require.NotNil(t, rk)
	assert.Equal(t, 100, rk.PromptTokens)
	assert.Equal(t, 50, rk.CompletionTokens)
	assert.Equal(t, 150, rk.TotalTokens)
	assert.Equal(t, 10, rk.PromptCacheHitTokens)
	assert.Equal(t, "openai", rk.UsageSemantic)
	assert.Equal(t, "oai_chat", rk.UsageSource)
	assert.Nil(t, rk.BillingUsage)
	assert.Equal(t, 5, rk.PromptTokensDetails.CachedTokens)
	assert.Equal(t, 3, rk.PromptTokensDetails.CachedCreationTokens)
	assert.Equal(t, 0, rk.PromptTokensDetails.CacheWriteTokens)
	assert.Equal(t, 90, rk.PromptTokensDetails.TextTokens)
	assert.Equal(t, 40, rk.CompletionTokenDetails.TextTokens)
	assert.Equal(t, 2, rk.CompletionTokenDetails.ReasoningTokens)
	assert.Equal(t, 100, rk.InputTokens)
	assert.Equal(t, 50, rk.OutputTokens)
	assert.Equal(t, 7, rk.ClaudeCacheCreation5mTokens)
	assert.Equal(t, 9, rk.ClaudeCacheCreation1hTokens)
	require.NotNil(t, rk.InputTokensDetails)
	assert.Equal(t, 1, rk.InputTokensDetails.CachedTokens)
	assert.Equal(t, 99, rk.InputTokensDetails.TextTokens)
}

func TestOldUsageToRelaykit_Nil(t *testing.T) {
	assert.Nil(t, oldUsageToRelaykit(nil))
}

// --- Bridge conversion: relaykitUsageToOld ---

func TestRelaykitUsageToOld_CacheWriteTokensMerge(t *testing.T) {
	// CacheWriteTokens > CachedCreationTokens → merge
	rk := &relaykitdto.Usage{
		PromptTokens:         10,
		PromptTokensDetails:  relaykitdto.InputTokenDetails{CachedCreationTokens: 3, CacheWriteTokens: 7},
	}
	old := relaykitUsageToOld(rk)
	assert.Equal(t, 7, old.PromptTokensDetails.CachedCreationTokens, "CacheWriteTokens should merge into CachedCreationTokens (take larger)")

	// CacheWriteTokens < CachedCreationTokens → keep original
	rk2 := &relaykitdto.Usage{
		PromptTokensDetails: relaykitdto.InputTokenDetails{CachedCreationTokens: 9, CacheWriteTokens: 2},
	}
	old2 := relaykitUsageToOld(rk2)
	assert.Equal(t, 9, old2.PromptTokensDetails.CachedCreationTokens)

	// Both zero
	rk3 := &relaykitdto.Usage{}
	old3 := relaykitUsageToOld(rk3)
	assert.Equal(t, 0, old3.PromptTokensDetails.CachedCreationTokens)
}

func TestRelaykitUsageToOld_Nil(t *testing.T) {
	assert.Nil(t, relaykitUsageToOld(nil))
}

// --- Bridge round-trip identity (no BillingUsage = no change) ---

func TestBridge_RoundTripIdentity(t *testing.T) {
	cases := []struct {
		name  string
		usage *dto.Usage
	}{
		{"normal", &dto.Usage{PromptTokens: 100, CompletionTokens: 50, TotalTokens: 150}},
		{"cache_tokens", &dto.Usage{PromptTokens: 200, CompletionTokens: 80, TotalTokens: 280,
			PromptTokensDetails: dto.InputTokenDetails{CachedTokens: 50, CachedCreationTokens: 20}}},
		{"reasoning_tokens", &dto.Usage{PromptTokens: 10, CompletionTokens: 90, TotalTokens: 100,
			CompletionTokenDetails: dto.OutputTokenDetails{ReasoningTokens: 40}}},
		{"extreme_quota", &dto.Usage{PromptTokens: 999999999, CompletionTokens: 999999999, TotalTokens: 1999999998}},
		{"claude_cache", &dto.Usage{PromptTokens: 300, CompletionTokens: 100, TotalTokens: 400,
			ClaudeCacheCreation5mTokens: 15, ClaudeCacheCreation1hTokens: 25}},
		{"with_input_tokens_details", &dto.Usage{PromptTokens: 50, CompletionTokens: 30, TotalTokens: 80,
			InputTokensDetails: &dto.InputTokenDetails{CachedTokens: 5, TextTokens: 45}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result := effectiveBillingUsageFromOldDto(tc.usage)
			require.NotNil(t, result)
			assert.Equal(t, tc.usage.PromptTokens, result.PromptTokens, "PromptTokens must match")
			assert.Equal(t, tc.usage.CompletionTokens, result.CompletionTokens, "CompletionTokens must match")
			assert.Equal(t, tc.usage.TotalTokens, result.TotalTokens, "TotalTokens must match")
			assert.Equal(t, tc.usage.PromptTokensDetails, result.PromptTokensDetails, "PromptTokensDetails must match")
			assert.Equal(t, tc.usage.CompletionTokenDetails, result.CompletionTokenDetails, "CompletionTokenDetails must match")
			assert.Equal(t, tc.usage.ClaudeCacheCreation5mTokens, result.ClaudeCacheCreation5mTokens)
			assert.Equal(t, tc.usage.ClaudeCacheCreation1hTokens, result.ClaudeCacheCreation1hTokens)
			if tc.usage.InputTokensDetails != nil {
				require.NotNil(t, result.InputTokensDetails)
				assert.Equal(t, tc.usage.InputTokensDetails.CachedTokens, result.InputTokensDetails.CachedTokens)
				assert.Equal(t, tc.usage.InputTokensDetails.TextTokens, result.InputTokensDetails.TextTokens)
			}
		})
	}
}

func TestEffectiveBillingUsageFromOldDto_Nil(t *testing.T) {
	assert.Nil(t, effectiveBillingUsageFromOldDto(nil))
}

// --- effectiveBillingUsage with BillingUsage data ---

func TestEffectiveBillingUsage_NoBillingUsage(t *testing.T) {
	usage := &relaykitdto.Usage{PromptTokens: 100, CompletionTokens: 50, TotalTokens: 150}
	result := effectiveBillingUsage(usage)
	require.NotNil(t, result)
	assert.Equal(t, 100, result.PromptTokens)
	assert.Equal(t, 50, result.CompletionTokens)
	assert.Equal(t, 150, result.TotalTokens)
	assert.Nil(t, result.BillingUsage)
}

func TestEffectiveBillingUsage_OpenAIBillingUsage(t *testing.T) {
	original := &relaykitdto.Usage{
		PromptTokens:     999,
		CompletionTokens: 888,
		TotalTokens:      1887,
	}
	original.BillingUsage = relaykitdto.NewOpenAIChatBillingUsage(&relaykitdto.Usage{
		PromptTokens:     100,
		CompletionTokens: 50,
		TotalTokens:      150,
	})
	result := effectiveBillingUsage(original)
	require.NotNil(t, result)
	assert.Equal(t, 100, result.PromptTokens, "should use BillingUsage-derived PromptTokens")
	assert.Equal(t, 50, result.CompletionTokens, "should use BillingUsage-derived CompletionTokens")
	assert.Equal(t, 150, result.TotalTokens, "should use BillingUsage-derived TotalTokens")
	assert.NotNil(t, result.BillingUsage)
}

func TestEffectiveBillingUsage_ClaudeBillingUsage(t *testing.T) {
	original := &relaykitdto.Usage{
		PromptTokens:     999,
		CompletionTokens: 888,
		TotalTokens:      1887,
	}
	original.BillingUsage = relaykitdto.NewClaudeMessagesBillingUsage(&relaykitdto.ClaudeUsage{
		InputTokens:              200,
		OutputTokens:             80,
		CacheReadInputTokens:     50,
		CacheCreationInputTokens: 30,
	})
	result := effectiveBillingUsage(original)
	require.NotNil(t, result)
	assert.Equal(t, 200, result.PromptTokens, "Claude PromptTokens = InputTokens")
	assert.Equal(t, 80, result.CompletionTokens, "Claude CompletionTokens = OutputTokens")
	assert.Equal(t, 280, result.TotalTokens, "Claude TotalTokens = Input+Output")
	assert.Equal(t, 50, result.PromptTokensDetails.CachedTokens, "cache read tokens")
	assert.Equal(t, 30, result.PromptTokensDetails.CachedCreationTokens, "cache creation tokens")
	assert.Equal(t, 280, result.InputTokens, "InputTokens includes cache tokens")
	assert.NotNil(t, result.BillingUsage)
}

func TestEffectiveBillingUsage_ClaudeBillingUsage_With5m1hCache(t *testing.T) {
	original := &relaykitdto.Usage{
		PromptTokens:     10,
		CompletionTokens: 5,
		TotalTokens:      15,
	}
	original.BillingUsage = relaykitdto.NewClaudeMessagesBillingUsage(&relaykitdto.ClaudeUsage{
		InputTokens:              100,
		OutputTokens:             40,
		CacheReadInputTokens:     20,
		CacheCreationInputTokens: 10,
		ClaudeCacheCreation5mTokens: 8,
		ClaudeCacheCreation1hTokens: 12,
	})
	result := effectiveBillingUsage(original)
	require.NotNil(t, result)
	assert.Equal(t, 8, result.ClaudeCacheCreation5mTokens)
	assert.Equal(t, 12, result.ClaudeCacheCreation1hTokens)
}

// --- appendUsageBillingPathForLogFromOldDto ---

func TestAppendUsageBillingPathForLogFromOldDto_NoBillingUsage(t *testing.T) {
	other := map[string]interface{}{}
	usage := &dto.Usage{PromptTokens: 10, CompletionTokens: 5}
	appendUsageBillingPathForLogFromOldDto(other, false, usage)
	adminInfo, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "upstream", adminInfo["usage_billing_path"])
}

func TestAppendUsageBillingPathForLogFromOldDto_LocalCountTokens(t *testing.T) {
	other := map[string]interface{}{}
	usage := &dto.Usage{PromptTokens: 10, CompletionTokens: 5}
	appendUsageBillingPathForLogFromOldDto(other, true, usage)
	adminInfo, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "local", adminInfo["usage_billing_path"])
}

func TestAppendUsageBillingPathForLogFromOldDto_NilUsage(t *testing.T) {
	other := map[string]interface{}{}
	appendUsageBillingPathForLogFromOldDto(other, false, nil)
	adminInfo, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "upstream", adminInfo["usage_billing_path"])
}

func TestAppendUsageBillingPathForLogFromOldDto_NilOther(t *testing.T) {
	assert.NotPanics(t, func() {
		appendUsageBillingPathForLogFromOldDto(nil, false, &dto.Usage{PromptTokens: 1})
	})
}

// --- Quota math regression: token counts preserved through bridge ---

func TestBridge_TokenCountsPreserved_ExtremeValues(t *testing.T) {
	cases := []struct {
		name    string
		prompt  int
		compl   int
	}{
		{"zero", 0, 0},
		{"one", 1, 1},
		{"normal", 1000, 500},
		{"large", 1000000, 500000},
		{"max_int_like", 2147483647, 2147483647},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			old := &dto.Usage{
				PromptTokens:     tc.prompt,
				CompletionTokens: tc.compl,
				TotalTokens:      tc.prompt + tc.compl,
			}
			result := effectiveBillingUsageFromOldDto(old)
			require.NotNil(t, result)
			assert.Equal(t, tc.prompt, result.PromptTokens)
			assert.Equal(t, tc.compl, result.CompletionTokens)
			assert.Equal(t, tc.prompt+tc.compl, result.TotalTokens)
		})
	}
}

func TestBridge_CacheAndReasoningTokensPreserved(t *testing.T) {
	old := &dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 50,
		TotalTokens:      150,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         30,
			CachedCreationTokens: 15,
			TextTokens:           50,
			AudioTokens:          10,
			ImageTokens:          5,
		},
		CompletionTokenDetails: dto.OutputTokenDetails{
			TextTokens:      30,
			AudioTokens:     5,
			ImageTokens:     5,
			ReasoningTokens: 10,
		},
	}
	result := effectiveBillingUsageFromOldDto(old)
	require.NotNil(t, result)
	assert.Equal(t, 30, result.PromptTokensDetails.CachedTokens, "cache read tokens preserved")
	assert.Equal(t, 15, result.PromptTokensDetails.CachedCreationTokens, "cache creation tokens preserved")
	assert.Equal(t, 10, result.CompletionTokenDetails.ReasoningTokens, "reasoning tokens preserved")
	assert.Equal(t, 50, result.PromptTokensDetails.TextTokens, "text tokens preserved")
	assert.Equal(t, 10, result.PromptTokensDetails.AudioTokens, "audio tokens preserved")
	assert.Equal(t, 5, result.PromptTokensDetails.ImageTokens, "image tokens preserved")
}
