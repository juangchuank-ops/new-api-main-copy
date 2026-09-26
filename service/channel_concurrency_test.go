package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
)

// withChannelConcurrencySetting 覆盖全局开关与默认值，并在用例结束后恢复。
func withChannelConcurrencySetting(t *testing.T, enabled bool, defaultValue int) {
	t.Helper()
	prevEnabled, prevDefault := setting.ChannelConcurrencyEnabled, setting.ChannelConcurrencyDefault
	setting.ChannelConcurrencyEnabled = enabled
	setting.ChannelConcurrencyDefault = defaultValue
	t.Cleanup(func() {
		setting.ChannelConcurrencyEnabled = prevEnabled
		setting.ChannelConcurrencyDefault = prevDefault
	})
}

func TestResolveChannelConcurrencyContract(t *testing.T) {
	tests := []struct {
		name             string
		enabled          bool
		defaultLimit     int
		channelLimit     *int
		modelConcurrency map[string]int
		modelName        string
		wantKey          string
		wantLimit        int
	}{
		{
			name:         "开关关闭时不限制",
			enabled:      false,
			defaultLimit: 5,
			channelLimit: common.GetPointer(3),
			wantKey:      "",
			wantLimit:    0,
		},
		{
			name:             "命中模型级配置时独立计数",
			enabled:          true,
			defaultLimit:     5,
			channelLimit:     common.GetPointer(3),
			modelConcurrency: map[string]int{"gpt-4o": 2},
			modelName:        "gpt-4o",
			wantKey:          "m:1:gpt-4o",
			wantLimit:        2,
		},
		{
			name:             "模型级配置为 0 表示该模型不受渠道级管辖",
			enabled:          true,
			defaultLimit:     5,
			channelLimit:     common.GetPointer(3),
			modelConcurrency: map[string]int{"gpt-4o": 0},
			modelName:        "gpt-4o",
			wantKey:          "m:1:gpt-4o",
			wantLimit:        0,
		},
		{
			name:             "未命中模型级配置时回落到渠道级",
			enabled:          true,
			defaultLimit:     5,
			channelLimit:     common.GetPointer(3),
			modelConcurrency: map[string]int{"gpt-4o": 2},
			modelName:        "claude-3",
			wantKey:          "c:1",
			wantLimit:        3,
		},
		{
			name:             "模型名为空时不进入模型级维度",
			enabled:          true,
			defaultLimit:     5,
			channelLimit:     common.GetPointer(3),
			modelConcurrency: map[string]int{"gpt-4o": 2},
			modelName:        "",
			wantKey:          "c:1",
			wantLimit:        3,
		},
		{
			name:         "渠道未单独设置时使用全局默认值",
			enabled:      true,
			defaultLimit: 5,
			channelLimit: nil,
			modelName:    "gpt-4o",
			wantKey:      "c:1",
			wantLimit:    5,
		},
		{
			name:         "渠道显式设置为 0 表示该渠道不限制",
			enabled:      true,
			defaultLimit: 5,
			channelLimit: common.GetPointer(0),
			modelName:    "gpt-4o",
			wantKey:      "c:1",
			wantLimit:    0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			withChannelConcurrencySetting(t, tt.enabled, tt.defaultLimit)

			channel := &model.Channel{Id: 1, Name: "test-channel", Concurrency: tt.channelLimit}
			if tt.modelConcurrency != nil {
				channel.SetOtherSettings(dto.ChannelOtherSettings{ModelConcurrency: tt.modelConcurrency})
			}

			scope := ResolveChannelConcurrency(channel, tt.modelName)
			assert.Equal(t, tt.wantKey, scope.Key)
			assert.Equal(t, tt.wantLimit, scope.Limit)
		})
	}
}

func TestResolveChannelConcurrencyWithoutChannel(t *testing.T) {
	withChannelConcurrencySetting(t, true, 5)

	scope := ResolveChannelConcurrency(nil, "gpt-4o")
	assert.Equal(t, ChannelConcurrencyScope{}, scope)
}

func TestResolveChannelConcurrencySeparatesChannels(t *testing.T) {
	withChannelConcurrencySetting(t, true, 5)

	first := ResolveChannelConcurrency(&model.Channel{Id: 7, Name: "a"}, "gpt-4o")
	second := ResolveChannelConcurrency(&model.Channel{Id: 8, Name: "b"}, "gpt-4o")

	assert.Equal(t, "c:7", first.Key)
	assert.Equal(t, "c:8", second.Key)
	assert.NotEqual(t, first.Key, second.Key)
}
