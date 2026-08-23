package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStockBuyAndSellSettlesQuotaAndPosition(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&GameStock{}, &GameStockPosition{}, &GameStockTrade{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM game_stock_trades")
		DB.Exec("DELETE FROM game_stock_positions")
		DB.Exec("DELETE FROM game_stocks")
	})

	user := &User{Username: "stock-user", Password: "password", Quota: 30_000_000}
	require.NoError(t, DB.Create(user).Error)
	stock := &GameStock{Code: "STEST", Name: "股票测试", LastPrice: 10, ListingPrice: 10}
	require.NoError(t, DB.Create(stock).Error)

	_, quota, _, err := tradeGameStock(user.Id, stock.Id, "buy", 2, false)
	require.NoError(t, err)
	assert.Equal(t, 10_000_000, quota)

	var position GameStockPosition
	require.NoError(t, DB.Where("user_id = ? AND stock_id = ?", user.Id, stock.Id).First(&position).Error)
	assert.Equal(t, 2, position.Shares)
	assert.Equal(t, 20.0, position.CostTotal)
	userQuota, err := GetUserQuota(user.Id, true)
	require.NoError(t, err)
	assert.Equal(t, 20_000_000, userQuota)

	_, quota, _, err = tradeGameStock(user.Id, stock.Id, "sell", 1, false)
	require.NoError(t, err)
	assert.Equal(t, 5_000_000, quota)
	require.NoError(t, DB.First(&position, position.Id).Error)
	assert.Equal(t, 1, position.Shares)
	assert.Equal(t, 10.0, position.CostTotal)
	userQuota, err = GetUserQuota(user.Id, true)
	require.NoError(t, err)
	assert.Equal(t, 25_000_000, userQuota)

	var tradeCount int64
	require.NoError(t, DB.Model(&GameStockTrade{}).Where("user_id = ?", user.Id).Count(&tradeCount).Error)
	assert.Equal(t, int64(2), tradeCount)
}

func TestStockTradeRejectsInsufficientQuotaAndShares(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&GameStock{}, &GameStockPosition{}, &GameStockTrade{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM game_stock_trades")
		DB.Exec("DELETE FROM game_stock_positions")
		DB.Exec("DELETE FROM game_stocks")
	})

	user := &User{Username: "stock-guard-user", Password: "password", Quota: 4_999_999}
	require.NoError(t, DB.Create(user).Error)
	stock := &GameStock{Code: "SGUARD", Name: "交易保护", LastPrice: 10, ListingPrice: 10}
	require.NoError(t, DB.Create(stock).Error)

	_, _, _, err := tradeGameStock(user.Id, stock.Id, "buy", 1, false)
	require.ErrorContains(t, err, "余额不足")
	_, _, _, err = tradeGameStock(user.Id, stock.Id, "sell", 1, false)
	require.ErrorContains(t, err, "持仓不足")

	var positionCount int64
	require.NoError(t, DB.Model(&GameStockPosition{}).Where("user_id = ?", user.Id).Count(&positionCount).Error)
	assert.Zero(t, positionCount)
	var tradeCount int64
	require.NoError(t, DB.Model(&GameStockTrade{}).Where("user_id = ?", user.Id).Count(&tradeCount).Error)
	assert.Zero(t, tradeCount)
}
func TestFuturesOpenAndCloseSettlesQuotaAtomically(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&GameStock{}, &GameFuturesPosition{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM game_futures_positions")
		DB.Exec("DELETE FROM game_stocks")
	})

	user := &User{Username: "futures-user", Password: "password", Quota: 20_000}
	require.NoError(t, DB.Create(user).Error)
	stock := &GameStock{Code: "FTEST", Name: "合约测试", LastPrice: 100, ListingPrice: 100}
	require.NoError(t, DB.Create(stock).Error)

	position, err := OpenFutures(user.Id, "long", 10, 10_000, stock.Id)
	require.NoError(t, err)
	assert.Equal(t, stock.Id, position.StockId)

	quota, err := GetUserQuota(user.Id, true)
	require.NoError(t, err)
	assert.Equal(t, 10_000, quota)

	closed, err := CloseFutures(user.Id, position.Id)
	require.NoError(t, err)
	assert.Equal(t, "closed", closed.Status)
	assert.Equal(t, 100.0, closed.ClosePrice)
	assert.Equal(t, 0.0, closed.PnlUsd)

	quota, err = GetUserQuota(user.Id, true)
	require.NoError(t, err)
	assert.Equal(t, 20_000, quota)

	_, err = CloseFutures(user.Id, position.Id)
	require.ErrorContains(t, err, "already closed")
	quota, err = GetUserQuota(user.Id, true)
	require.NoError(t, err)
	assert.Equal(t, 20_000, quota)
}

func TestOpenFuturesRejectsInsufficientQuotaWithoutCreatingPosition(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&GameStock{}, &GameFuturesPosition{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM game_futures_positions")
		DB.Exec("DELETE FROM game_stocks")
	})

	user := &User{Username: "poor-futures-user", Password: "password", Quota: 999}
	require.NoError(t, DB.Create(user).Error)
	stock := &GameStock{Code: "FPOOR", Name: "余额测试", LastPrice: 100, ListingPrice: 100}
	require.NoError(t, DB.Create(stock).Error)

	_, err := OpenFutures(user.Id, "long", 10, 1_000, stock.Id)
	require.ErrorContains(t, err, "余额不足")

	var count int64
	require.NoError(t, DB.Model(&GameFuturesPosition{}).Where("user_id = ?", user.Id).Count(&count).Error)
	assert.Zero(t, count)
	quota, err := GetUserQuota(user.Id, true)
	require.NoError(t, err)
	assert.Equal(t, 999, quota)
}
