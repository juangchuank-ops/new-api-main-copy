package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRedeemGameScoreAwardsOneQuotaUnitPerThousandPoints(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&GameConfig{}, &GameScoreLog{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM game_score_logs")
		DB.Exec("DELETE FROM game_configs")
	})

	user := &User{Username: "game-redeem-user", Password: "password"}
	require.NoError(t, DB.Create(user).Error)
	require.NoError(t, DB.Create(&GameConfig{
		GameKey: "snake", Name: "贪吃蛇", Status: GameStatusAvailable, MaxScore: 100000,
	}).Error)

	quota, usd, err := RedeemGameScore(user.Id, user.Username, "snake", 1000)
	require.NoError(t, err)
	assert.Equal(t, int(common.QuotaPerUnit), quota)
	assert.Equal(t, 1.0, usd)

	userQuota, err := GetUserQuota(user.Id, true)
	require.NoError(t, err)
	assert.Equal(t, int(common.QuotaPerUnit), userQuota)

	var scoreLog GameScoreLog
	require.NoError(t, DB.Where("user_id = ?", user.Id).First(&scoreLog).Error)
	assert.Equal(t, 1000, scoreLog.Score)
	assert.Equal(t, int(common.QuotaPerUnit), scoreLog.QuotaAwarded)
	assert.Equal(t, 1.0, scoreLog.UsdAwarded)
}

func TestRedeemRoguelikeScoreAwardsOneQuotaUnitPerTenThousandPoints(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&GameConfig{}, &GameScoreLog{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM game_score_logs")
		DB.Exec("DELETE FROM game_configs")
	})

	user := &User{Username: "roguelike-redeem-user", Password: "password"}
	require.NoError(t, DB.Create(user).Error)
	require.NoError(t, DB.Create(&GameConfig{
		GameKey: "roguelike", Name: "肉鸽 NEON-PULSE", Status: GameStatusAvailable, MaxScore: 100000,
	}).Error)

	quota, usd, err := RedeemGameScore(user.Id, user.Username, "roguelike", 10000)
	require.NoError(t, err)
	assert.Equal(t, int(common.QuotaPerUnit), quota)
	assert.Equal(t, 1.0, usd)

	userQuota, err := GetUserQuota(user.Id, true)
	require.NoError(t, err)
	assert.Equal(t, int(common.QuotaPerUnit), userQuota)

	var scoreLog GameScoreLog
	require.NoError(t, DB.Where("user_id = ?", user.Id).First(&scoreLog).Error)
	assert.Equal(t, "roguelike", scoreLog.GameKey)
	assert.Equal(t, 10000, scoreLog.Score)
	assert.Equal(t, int(common.QuotaPerUnit), scoreLog.QuotaAwarded)
	assert.Equal(t, 1.0, scoreLog.UsdAwarded)
}
