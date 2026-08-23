package controller

import (
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ---------- 游戏配置 ----------

func ListGames(c *gin.Context) {
	games, err := model.ListGameConfigs()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, games)
}

type updateGamesRequest struct {
	Title string         `json:"title"`
	Games []model.GameConfig `json:"games"`
}

func UpdateGames(c *gin.Context) {
	// 仅 root 可改配置
	if c.GetInt("role") != common.RoleRootUser {
		common.ApiErrorMsg(c, "仅超级管理员可修改游戏配置")
		return
	}
	var req updateGamesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Title != "" {
		if err := model.SetGamePageTitle(req.Title); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if len(req.Games) > 0 {
		if err := model.UpdateGameConfigs(req.Games); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	games, err := model.ListGameConfigs()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, games)
}

type redeemScoreRequest struct {
	GameKey string `json:"game_key"`
	Score   int    `json:"score"`
}

func RedeemGameScore(c *gin.Context) {
	userId := c.GetInt("id")
	var req redeemScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	username := c.GetString("username")
	quota, usd, err := model.RedeemGameScore(userId, username, req.GameKey, req.Score)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, gin.H{
		"quota": quota,
		"usd":   usd,
		"score": req.Score,
	})
}

func ListGameScores(c *gin.Context) {
	userId := c.GetInt("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	logs, err := model.ListGameScoreLogs(userId, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, logs)
}

// ---------- TOKEN 股市 ----------

func GetStockOverview(c *gin.Context) {
	stocks, err := model.ListGameStocks()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	phase := model.GetStockPhase(time.Now())
	regime := model.GetMarketRegime()
	nowTs := time.Now().Unix()
	// 带上停牌剩余秒数与退市标记
	stockViews := make([]map[string]any, 0, len(stocks))
	for _, s := range stocks {
		stockViews = append(stockViews, map[string]any{
			"id": s.Id, "code": s.Code, "name": s.Name,
			"prev_close": s.PrevClose, "last_price": s.LastPrice,
			"open_price": s.OpenPrice, "high_price": s.HighPrice, "low_price": s.LowPrice,
			"listing_price": s.ListingPrice,
			"halted":       s.HaltedUntil > nowTs, "halt_remaining": maxInt64(0, s.HaltedUntil-nowTs),
			"delisted": s.Delisted,
		})
	}
	common.ApiSuccess(c, gin.H{
		"phase":  phase,
		"regime": regime,
		"stocks": stockViews,
	})
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

// GetStockNews 新闻事件流
func GetStockNews(c *gin.Context) {
	stockId, _ := strconv.Atoi(c.Query("stock_id"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	events, err := model.ListGameStockEvents(stockId, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, events)
}

// GetStockOrderBook 五档盘口
func GetStockOrderBook(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	stock, err := model.GetGameStockById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"book":  model.BuildOrderBook(stock),
		"last":  stock.LastPrice,
		"halted": stock.HaltedUntil > time.Now().Unix(),
		"delisted": stock.Delisted,
	})
}

func GetStockKlines(c *gin.Context) {
	stockId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "240"))
	klines, err := model.GetGameStockKlines(stockId, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, klines)
}

type stockTradeRequest struct {
	StockId int    `json:"stock_id"`
	Side    string `json:"side"`
	Shares  int    `json:"shares"`
}

func TradeStock(c *gin.Context) {
	userId := c.GetInt("id")
	var req stockTradeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	stock, quota, usd, err := model.TradeGameStock(userId, req.StockId, req.Side, req.Shares)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, gin.H{
		"stock_code": stock.Code,
		"price":      stock.LastPrice,
		"shares":     req.Shares,
		"usd":        usd,
		"quota":      quota,
	})
}

func ListStockPositions(c *gin.Context) {
	userId := c.GetInt("id")
	positions, err := model.GetUserStockPositions(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	trades, _ := model.GetUserStockTrades(userId, 50)
	common.ApiSuccess(c, gin.H{
		"positions": positions,
		"trades":    trades,
	})
}

// ---------- 永续合约 ----------

type futuresOpenRequest struct {
	StockId      int    `json:"stock_id"`
	Side         string `json:"side"`
	Leverage     int    `json:"leverage"`
	MarginAmount int    `json:"margin_amount"` // 以额度原生单位
}

func OpenFuturesPosition(c *gin.Context) {
	userId := c.GetInt("id")
	var req futuresOpenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	position, err := model.OpenFutures(userId, req.Side, req.Leverage, req.MarginAmount, req.StockId)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, position)
}

type futuresCloseRequest struct {
	PositionId int `json:"position_id"`
}

func CloseFuturesPosition(c *gin.Context) {
	userId := c.GetInt("id")
	var req futuresCloseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	position, err := model.CloseFutures(userId, req.PositionId)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, position)
}

func ListFuturesPositions(c *gin.Context) {
	userId := c.GetInt("id")
	open, err := model.ListOpenFutures(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 附加标记价格与浮动盈亏
	quotes, _ := model.GetGameStockQuoteMap()
	for _, pos := range open {
		if stock, ok := quotes[pos.StockId]; ok {
			pos.MarkPrice = stock.LastPrice
			var diff float64
			if pos.Side == "long" {
				diff = stock.LastPrice - pos.EntryPrice
			} else {
				diff = pos.EntryPrice - stock.LastPrice
			}
			pnl := diff * pos.Size
			pos.PnlUsd = pnl
			if pos.MarginUsd > 0 {
				pos.PnlPct = pnl / pos.MarginUsd * 100
			}
		}
	}
	history, _ := model.ListFuturesHistory(userId, 50)
	common.ApiSuccess(c, gin.H{
		"open":    open,
		"history": history,
	})
}
