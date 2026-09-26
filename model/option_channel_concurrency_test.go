package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// 渠道并发限制的开关与默认值必须同时满足两件事：落库可读回，以及热更新到
// setting 包里的运行时变量（relay 每轮都会读它，重启才生效是不可接受的）。
func TestChannelConcurrencyOptionsPersistAndUpdateRuntime(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}))

	previousDB := DB
	previousOptionMap := common.OptionMap
	previousEnabled := setting.ChannelConcurrencyEnabled
	previousDefault := setting.ChannelConcurrencyDefault
	DB = db
	common.OptionMapRWMutex.Lock()
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		DB = previousDB
		setting.ChannelConcurrencyEnabled = previousEnabled
		setting.ChannelConcurrencyDefault = previousDefault
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptionMap
		common.OptionMapRWMutex.Unlock()
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	require.NoError(t, UpdateOption(setting.ChannelConcurrencyEnabledOptionKey, "true"))
	require.NoError(t, UpdateOption(setting.ChannelConcurrencyDefaultOptionKey, "120"))
	assert.True(t, setting.ChannelConcurrencyEnabled)
	assert.Equal(t, 120, setting.ChannelConcurrencyDefault)

	var stored Option
	require.NoError(t, db.First(&stored, "key = ?", setting.ChannelConcurrencyDefaultOptionKey).Error)
	assert.Equal(t, "120", stored.Value)

	// 0 是合法值，语义是「不做并发限制」，必须与「未设置」区分开并允许写回。
	require.NoError(t, UpdateOption(setting.ChannelConcurrencyDefaultOptionKey, "0"))
	assert.Equal(t, 0, setting.ChannelConcurrencyDefault)
	require.NoError(t, db.First(&stored, "key = ?", setting.ChannelConcurrencyDefaultOptionKey).Error)
	assert.Equal(t, "0", stored.Value)

	// 超上限与非整数都必须被拒绝，且不能污染已生效的运行时值与库里的值。
	require.NoError(t, UpdateOption(setting.ChannelConcurrencyDefaultOptionKey, "120"))
	for _, invalid := range []string{
		strconv.Itoa(setting.MaxChannelConcurrency + 1),
		"-1",
		"abc",
	} {
		require.Errorf(t, UpdateOption(setting.ChannelConcurrencyDefaultOptionKey, invalid), "value %q must be rejected", invalid)
		require.Errorf(t, updateOptionMap(setting.ChannelConcurrencyDefaultOptionKey, invalid), "value %q must be rejected", invalid)
		assert.Equal(t, 120, setting.ChannelConcurrencyDefault)
	}
	require.NoError(t, db.First(&stored, "key = ?", setting.ChannelConcurrencyDefaultOptionKey).Error)
	assert.Equal(t, "120", stored.Value)

	// 上限本身是闭区间端点，必须可写。
	require.NoError(t, UpdateOption(setting.ChannelConcurrencyDefaultOptionKey, strconv.Itoa(setting.MaxChannelConcurrency)))
	assert.Equal(t, setting.MaxChannelConcurrency, setting.ChannelConcurrencyDefault)
}
