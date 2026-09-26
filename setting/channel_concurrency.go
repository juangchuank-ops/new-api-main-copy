package setting

import (
	"fmt"
	"strconv"
	"strings"
)

// 渠道并发限制：限制同一渠道同时在途（in-flight）的请求数，超出即拒绝。
//
// 优先级：模型级配置（dto.ChannelOtherSettings.ModelConcurrency）优先于渠道级，
// 且独立计数，不受渠道总并发管辖；未单独配置的模型共用渠道级上限。
// 渠道级为 nil 时回落到全局默认值。
const (
	ChannelConcurrencyEnabledOptionKey = "ChannelConcurrencyEnabled"
	ChannelConcurrencyDefaultOptionKey = "ChannelConcurrencyDefault"

	// DefaultChannelConcurrency 为 0，表示不做并发限制。
	DefaultChannelConcurrency = 0
	// MaxChannelConcurrency 与用户每分钟请求数的量级保持一致，避免出现无意义的巨大值。
	MaxChannelConcurrency = 1_000_000
)

var ChannelConcurrencyEnabled = false
var ChannelConcurrencyDefault = DefaultChannelConcurrency

// ValidateChannelConcurrency 校验单个渠道的并发上限。
// nil 表示未单独设置（走全局默认）；0 表示该渠道不限制；正数为上限。
func ValidateChannelConcurrency(concurrency *int) error {
	if concurrency == nil {
		return nil
	}
	if *concurrency < 0 || *concurrency > MaxChannelConcurrency {
		return fmt.Errorf("concurrency must be between 0 and %d", MaxChannelConcurrency)
	}
	return nil
}

// ValidateChannelModelConcurrency 校验渠道的按模型并发配置。
// 模型名不能为空，上限必须为正数 —— 0 或负数在这个位置没有可表达的语义
// （要取消某个模型的单独限制，直接删掉该条目即可）。
func ValidateChannelModelConcurrency(modelConcurrency map[string]int) error {
	for model, limit := range modelConcurrency {
		if strings.TrimSpace(model) == "" {
			return fmt.Errorf("model concurrency contains an empty model name")
		}
		if limit <= 0 || limit > MaxChannelConcurrency {
			return fmt.Errorf("model %s concurrency must be between 1 and %d", model, MaxChannelConcurrency)
		}
	}
	return nil
}

func ValidateChannelConcurrencyDefault(value string) error {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return fmt.Errorf("%s must be an integer", ChannelConcurrencyDefaultOptionKey)
	}
	if parsed < 0 || parsed > MaxChannelConcurrency {
		return fmt.Errorf("%s must be between 0 and %d", ChannelConcurrencyDefaultOptionKey, MaxChannelConcurrency)
	}
	return nil
}
