package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
)

// ChannelConcurrencyScope 表示一次请求需要占用的并发维度。
type ChannelConcurrencyScope struct {
	// Key 是计数维度：模型级为 "m:<channelId>:<model>"，渠道级为 "c:<channelId>"。
	Key string
	// Limit 是并发上限，<= 0 表示不限制。
	Limit int
}

// ResolveChannelConcurrency 计算某个渠道在指定模型下的并发限制。
//
// 规则：
//   - 未开启渠道并发限制时不做任何限制；
//   - 模型级配置（channel settings 里的 model_concurrency）优先，且独立计数，
//     不受渠道级上限管辖；
//   - 其余模型共用渠道级上限；渠道级为 nil 时回落到全局默认值。
func ResolveChannelConcurrency(channel *model.Channel, modelName string) ChannelConcurrencyScope {
	if channel == nil || !setting.ChannelConcurrencyEnabled {
		return ChannelConcurrencyScope{}
	}

	if modelName != "" {
		if limit, ok := channel.GetOtherSettings().ModelConcurrency[modelName]; ok {
			return ChannelConcurrencyScope{
				Key:   fmt.Sprintf("m:%d:%s", channel.Id, modelName),
				Limit: limit,
			}
		}
	}

	limit := setting.ChannelConcurrencyDefault
	if channel.Concurrency != nil {
		limit = *channel.Concurrency
	}
	return ChannelConcurrencyScope{
		Key:   fmt.Sprintf("c:%d", channel.Id),
		Limit: limit,
	}
}
