package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRecordAuthLogWritesStructuredEventToLogDatabase(t *testing.T) {
	mainDB, err := gorm.Open(sqlite.Open("file:"+t.Name()+"-main?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	logDB, err := gorm.Open(sqlite.Open("file:"+t.Name()+"-log?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, mainDB.AutoMigrate(&Log{}))
	require.NoError(t, logDB.AutoMigrate(&Log{}))

	previousDB := DB
	previousLogDB := LOG_DB
	DB = mainDB
	LOG_DB = logDB
	t.Cleanup(func() {
		DB = previousDB
		LOG_DB = previousLogDB
	})

	RecordAuthLog(
		42,
		"alice",
		"Registered successfully via password",
		"198.51.100.24",
		"register",
		map[string]interface{}{"method": "password"},
		map[string]interface{}{
			"registration_method": "password",
			"user_agent":          "audit-test-agent",
		},
	)

	var mainCount int64
	require.NoError(t, mainDB.Model(&Log{}).Count(&mainCount).Error)
	assert.Zero(t, mainCount)

	var stored Log
	require.NoError(t, logDB.First(&stored).Error)
	assert.Equal(t, 42, stored.UserId)
	assert.Equal(t, "alice", stored.Username)
	assert.Equal(t, LogTypeLogin, stored.Type)
	assert.Equal(t, "198.51.100.24", stored.Ip)
	assert.NotEmpty(t, stored.RequestId)

	other, err := common.StrToMap(stored.Other)
	require.NoError(t, err)
	assert.Equal(t, "password", other["registration_method"])
	assert.Equal(t, "audit-test-agent", other["user_agent"])
	op, ok := other["op"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "register", op["action"])
	params, ok := op["params"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "password", params["method"])
}
