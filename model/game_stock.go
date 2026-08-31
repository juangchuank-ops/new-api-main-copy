package model

import (
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	StockPhasePreOpen  = "pre_open" // 开盘前
	StockPhaseOpen     = "open"     // 交易中（9:30-11:30, 13:00-15:00）
	StockPhaseLunch    = "lunch"    // 午间休市
	StockPhaseClosed   = "closed"   // 已收盘
	StockKlineMinute   = 60         // 每根K线代表60秒
	StockPriceLimitPct = 0.10       // 涨跌幅 ±10%
)

type GameStock struct {
	Id        int     `json:"id"`
	Code      string  `json:"code" gorm:"type:varchar(16);uniqueIndex"`
	Name      string  `json:"name" gorm:"type:varchar(64)"`
	PrevClose float64 `json:"prev_close"`
	LastPrice float64 `json:"last_price"`
	OpenPrice float64 `json:"open_price"`
	HighPrice float64 `json:"high_price"`
	LowPrice  float64 `json:"low_price"`
	// ListingPrice 上市基础价
	ListingPrice float64 `json:"listing_price"`
	// HaltedUntil 停牌截止时间（unix 秒），0 表示未停牌
	HaltedUntil int64 `json:"halted_until" gorm:"bigint;default:0"`
	// Delisted 退市标记，退市后不可交易
	Delisted bool `json:"delisted"`
	// NextEarningsTs 下次财报时间（unix 秒）
	NextEarningsTs int64 `json:"next_earnings_ts" gorm:"bigint;default:0"`
	UpdatedTime    int64 `json:"updated_time" gorm:"bigint"`
}

type GameStockKline struct {
	Id      int     `json:"id"`
	StockId int     `json:"stock_id" gorm:"uniqueIndex:idx_kline_stock_ts"`
	Ts      int64   `json:"ts" gorm:"uniqueIndex:idx_kline_stock_ts"`
	Open    float64 `json:"open"`
	High    float64 `json:"high"`
	Low     float64 `json:"low"`
	Close   float64 `json:"close"`
	Volume  int64   `json:"volume"`
}

type GameStockPosition struct {
	Id          int     `json:"id"`
	UserId      int     `json:"user_id" gorm:"uniqueIndex:idx_stock_pos_user_stock"`
	StockId     int     `json:"stock_id" gorm:"uniqueIndex:idx_stock_pos_user_stock"`
	Shares      int     `json:"shares"`
	CostTotal   float64 `json:"cost_total"` // 持仓成本总额（USD）
	UpdatedTime int64   `json:"updated_time" gorm:"bigint"`
}

type GameStockTrade struct {
	Id          int     `json:"id"`
	UserId      int     `json:"user_id" gorm:"index"`
	StockId     int     `json:"stock_id"`
	StockCode   string  `json:"stock_code" gorm:"type:varchar(16)"`
	Side        string  `json:"side" gorm:"type:varchar(8)"` // buy / sell
	Price       float64 `json:"price"`
	Shares      int     `json:"shares"`
	UsdAmount   float64 `json:"usd_amount"`
	QuotaAmount int     `json:"quota_amount"`
	CreatedTime int64   `json:"created_time" gorm:"index"`
}

// GameFuturesPosition 永续合约持仓
type GameFuturesPosition struct {
	Id          int     `json:"id"`
	UserId      int     `json:"user_id" gorm:"index"`
	StockId     int     `json:"stock_id" gorm:"index"`
	Side        string  `json:"side" gorm:"type:varchar(8)"` // long / short
	Leverage    int     `json:"leverage"`
	MarginUsd   float64 `json:"margin_usd"`                     // 保证金（USD）
	EntryPrice  float64 `json:"entry_price"`                    // 开仓价格
	Size        float64 `json:"size"`                           // 仓位大小（股）
	Status      string  `json:"status" gorm:"type:varchar(16)"` // open / closed
	ClosePrice  float64 `json:"close_price"`
	PnlUsd      float64 `json:"pnl_usd"`
	CreatedTime int64   `json:"created_time" gorm:"bigint"`
	UpdatedTime int64   `json:"updated_time" gorm:"bigint"`
	// MarkPrice/PnlPct 为渲染时的实时数据，不入库
	MarkPrice float64 `json:"mark_price" gorm:"-:all"`
	PnlPct    float64 `json:"pnl_pct" gorm:"-:all"`
}

var defaultStocks = []GameStock{
	{Code: "NEON", Name: "霓虹科技", ListingPrice: 100},
	{Code: "PULSE", Name: "脉冲能源", ListingPrice: 42.5},
	{Code: "TOKEN", Name: "代币矿业", ListingPrice: 18.8},
	{Code: "AURA", Name: "光环生物", ListingPrice: 66.6},
	{Code: "VOID", Name: "虚空半导体", ListingPrice: 250},
}

func InitGameStocks() error {
	if err := DB.AutoMigrate(&GameStock{}, &GameStockKline{}, &GameStockPosition{}, &GameStockTrade{}, &GameFuturesPosition{}, &GameStockEvent{}); err != nil {
		return err
	}
	for _, stock := range defaultStocks {
		stock.PrevClose = stock.ListingPrice
		stock.LastPrice = stock.ListingPrice
		stock.UpdatedTime = common.GetTimestamp()
		if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&stock).Error; err != nil {
			return err
		}
	}
	return nil
}

// GetStockPhase 按真实A股时间判断交易阶段。
func GetStockPhase(now time.Time) string {
	weekday := now.Weekday()
	if weekday == time.Saturday || weekday == time.Sunday {
		return StockPhaseClosed
	}
	hm := now.Hour()*100 + now.Minute()
	switch {
	case hm < 915:
		return StockPhasePreOpen
	case hm < 930:
		return StockPhasePreOpen // 集合竞价，简化为未开盘
	case hm < 1130:
		return StockPhaseOpen
	case hm < 1300:
		return StockPhaseLunch
	case hm < 1500:
		return StockPhaseOpen
	default:
		return StockPhaseClosed
	}
}

func ListGameStocks() ([]*GameStock, error) {
	stocks := make([]*GameStock, 0)
	if err := DB.Order("id asc").Find(&stocks).Error; err != nil {
		return nil, err
	}
	return stocks, nil
}

func GetGameStockById(id int) (*GameStock, error) {
	var stock GameStock
	if err := DB.First(&stock, id).Error; err != nil {
		return nil, err
	}
	return &stock, nil
}

func clampPrice(price float64, prevClose float64) float64 {
	upper := prevClose * (1 + StockPriceLimitPct)
	lower := prevClose * (1 - StockPriceLimitPct)
	if price > upper {
		return upper
	}
	if price < lower {
		return lower
	}
	return price
}

// AdvanceGameStockTick 推进一根1分钟K线（仅在交易阶段为 open 时调用）。
func AdvanceGameStockTick() {
	now := time.Now()
	if GetStockPhase(now) != StockPhaseOpen {
		return
	}
	// 对齐到分钟
	ts := now.Unix() - int64(now.Second())
	stocks, err := ListGameStocks()
	if err != nil || len(stocks) == 0 {
		return
	}
	advanced := false
	for _, stock := range stocks {
		var lastKline GameStockKline
		err := DB.Where("stock_id = ? AND ts = ?", stock.Id, ts).First(&lastKline).Error
		if err == nil {
			continue // 本分钟已有K线
		}
		// 今天的首根K线：开盘不再跳空低开（用户要求取消），
		// 开盘 = 昨收平开或 0~1% 内小幅高开
		openPrice := stock.LastPrice
		todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
		var todayFirst GameStockKline
		hasToday := DB.Where("stock_id = ? AND ts >= ?", stock.Id, todayStart).First(&todayFirst).Error == nil
		if !hasToday {
			gap := rand.Float64() * 0.01
			openPrice = clampPrice(stock.PrevClose*(1+gap), stock.PrevClose)
			stock.LastPrice = openPrice
			stock.OpenPrice = openPrice
			stock.HighPrice = openPrice
			stock.LowPrice = openPrice
		}

		// 随机游走：市场情绪漂移 + 均值回归 + 随机波动
		regime := GetMarketRegime()
		regimeDriftPct, regimeVol := regimeDrift(regime)
		drift := (stock.ListingPrice - stock.LastPrice) / stock.ListingPrice * 0.02
		change := (rand.Float64()-0.5)*regimeVol + drift*0.5 + regimeDriftPct
		closePrice := clampPrice(stock.LastPrice*(1+change), stock.PrevClose)
		high := stock.LastPrice
		if closePrice > high {
			high = closePrice
		}
		low := stock.LastPrice
		if closePrice < low {
			low = closePrice
		}
		// 分钟内高低点模拟
		wick := (rand.Float64() - 0.5) * 0.006 * stock.LastPrice
		high = clampPrice(high+wick, stock.PrevClose)
		low = clampPrice(low-wick, stock.PrevClose)
		if high < low {
			high, low = low, high
		}
		volume := int64(1000 + rand.Intn(9000))

		kline := &GameStockKline{
			StockId: stock.Id,
			Ts:      ts,
			Open:    openPrice,
			High:    high,
			Low:     low,
			Close:   closePrice,
			Volume:  volume,
		}
		if err := DB.Create(kline).Error; err != nil {
			continue
		}
		advanced = true

		stock.LastPrice = closePrice
		if high > stock.HighPrice || stock.HighPrice == 0 {
			stock.HighPrice = high
		}
		if low < stock.LowPrice || stock.LowPrice == 0 {
			stock.LowPrice = low
		}
		stock.UpdatedTime = common.GetTimestamp()
		_ = DB.Model(stock).Updates(map[string]any{
			"prev_close":   stock.PrevClose,
			"last_price":   stock.LastPrice,
			"open_price":   stock.OpenPrice,
			"high_price":   stock.HighPrice,
			"low_price":    stock.LowPrice,
			"updated_time": stock.UpdatedTime,
		}).Error

		// 收盘（14:59 后的K线）时结算：昨收更新
		hm := now.Hour()*100 + now.Minute()
		if hm >= 1459 {
			_ = DB.Model(stock).Updates(map[string]any{
				"prev_close": closePrice,
			}).Error
		}
	}

	// 事件引擎：新闻事件与宏观事件随新K线触发，避免20秒tick在同一分钟重复触发
	if advanced {
		MaybeTriggerStockEvents(stocks, now)
		// 公司行为（分红/拆股/并购退市）：极低概率
		TriggerCorporateActions(now)
	}
}

func GetGameStockKlines(stockId int, limit int) ([]*GameStockKline, error) {
	if limit <= 0 || limit > 500 {
		limit = 240
	}
	klines := make([]*GameStockKline, 0)
	if err := DB.Where("stock_id = ?", stockId).Order("ts desc").Limit(limit).Find(&klines).Error; err != nil {
		return klines, err
	}
	for left, right := 0, len(klines)-1; left < right; left, right = left+1, right-1 {
		klines[left], klines[right] = klines[right], klines[left]
	}
	return klines, nil
}

func GetUserStockPositions(userId int) ([]map[string]any, error) {
	var positions []GameStockPosition
	if err := DB.Where("user_id = ?", userId).Find(&positions).Error; err != nil {
		return nil, err
	}
	result := make([]map[string]any, 0, len(positions))
	for _, pos := range positions {
		if pos.Shares <= 0 {
			continue
		}
		stock, err := GetGameStockById(pos.StockId)
		if err != nil {
			continue
		}
		costAvg := 0.0
		if pos.Shares > 0 {
			costAvg = pos.CostTotal / float64(pos.Shares)
		}
		marketValue := stock.LastPrice * float64(pos.Shares)
		pnl := marketValue - pos.CostTotal
		pnlPct := 0.0
		if pos.CostTotal > 0 {
			pnlPct = pnl / pos.CostTotal * 100
		}
		result = append(result, map[string]any{
			"stock_id":     pos.StockId,
			"stock_code":   stock.Code,
			"stock_name":   stock.Name,
			"shares":       pos.Shares,
			"cost_total":   pos.CostTotal,
			"cost_avg":     costAvg,
			"last_price":   stock.LastPrice,
			"market_value": marketValue,
			"pnl":          pnl,
			"pnl_pct":      pnlPct,
		})
	}
	return result, nil
}

// TradeGameStock 市价买卖。usd 由前端报价，实际成交价用最新价。
func tradeGameStock(userId int, stockId int, side string, shares int, enforceTradingHours bool) (*GameStock, int, float64, error) {
	if side != "buy" && side != "sell" {
		return nil, 0, 0, errors.New("invalid side")
	}
	if shares <= 0 {
		return nil, 0, 0, errors.New("shares must be positive")
	}
	if enforceTradingHours && GetStockPhase(time.Now()) != StockPhaseOpen {
		return nil, 0, 0, errors.New("当前不在交易时间内（9:30-11:30，13:00-15:00）")
	}

	var stock GameStock
	var quota int
	var usd float64
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).First(&stock, stockId).Error; err != nil {
			return errors.New("stock not found")
		}
		if stock.Delisted {
			return errors.New("该股票已退市，无法交易")
		}
		if stock.HaltedUntil > time.Now().Unix() {
			return errors.New("该股票临时停牌中，暂停交易")
		}

		usd = stock.LastPrice * float64(shares)
		quota = int(usd * common.QuotaPerUnit)
		now := common.GetTimestamp()
		if side == "buy" {
			result := tx.Model(&User{}).
				Where("id = ? AND quota >= ?", userId, quota).
				Update("quota", gorm.Expr("quota - ?", quota))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return errors.New("余额不足")
			}
			result = tx.Model(&GameStockPosition{}).
				Where("user_id = ? AND stock_id = ?", userId, stockId).
				Updates(map[string]any{
					"shares":       gorm.Expr("shares + ?", shares),
					"cost_total":   gorm.Expr("cost_total + ?", usd),
					"updated_time": now,
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				position := &GameStockPosition{
					UserId: userId, StockId: stockId, Shares: shares,
					CostTotal: usd, UpdatedTime: now,
				}
				if err := tx.Create(position).Error; err != nil {
					return err
				}
			}
		} else {
			var position GameStockPosition
			if err := lockForUpdate(tx).
				Where("user_id = ? AND stock_id = ?", userId, stockId).
				First(&position).Error; err != nil {
				return errors.New("持仓不足")
			}
			if position.Shares < shares {
				return errors.New("持仓不足")
			}
			soldCost := position.CostTotal * float64(shares) / float64(position.Shares)
			newShares := position.Shares - shares
			newCostTotal := position.CostTotal - soldCost
			if newShares == 0 {
				newCostTotal = 0
			}
			result := tx.Model(&GameStockPosition{}).
				Where("id = ? AND shares >= ?", position.Id, shares).
				Updates(map[string]any{
					"shares":       newShares,
					"cost_total":   newCostTotal,
					"updated_time": now,
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return errors.New("持仓不足")
			}
			result = tx.Model(&User{}).Where("id = ?", userId).
				Update("quota", gorm.Expr("quota + ?", quota))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return gorm.ErrRecordNotFound
			}
		}

		return tx.Create(&GameStockTrade{
			UserId: userId, StockId: stockId, StockCode: stock.Code, Side: side,
			Price: stock.LastPrice, Shares: shares, UsdAmount: usd, QuotaAmount: quota,
			CreatedTime: now,
		}).Error
	})
	if err != nil {
		return nil, 0, 0, err
	}
	if side == "buy" {
		if err := cacheDecrUserQuota(userId, int64(quota)); err != nil {
			common.SysLog("failed to decrease user quota cache: " + err.Error())
		}
	} else if err := cacheIncrUserQuota(userId, int64(quota)); err != nil {
		common.SysLog("failed to increase user quota cache: " + err.Error())
	}
	return &stock, quota, usd, nil
}

func TradeGameStock(userId int, stockId int, side string, shares int) (*GameStock, int, float64, error) {
	return tradeGameStock(userId, stockId, side, shares, true)
}

// OpenFutures 开仓
func OpenFutures(userId int, side string, leverage int, marginQuota int, stockId int) (*GameFuturesPosition, error) {
	if side != "long" && side != "short" {
		return nil, errors.New("invalid side")
	}
	if leverage < 1 || leverage > 10000 {
		return nil, errors.New("杠杆倍数需在 1-10000 之间")
	}
	if marginQuota <= 0 {
		return nil, errors.New("保证金必须大于0")
	}
	stock, err := GetGameStockById(stockId)
	if err != nil {
		return nil, errors.New("stock not found")
	}
	if stock.Delisted {
		return nil, errors.New("该股票已退市，无法交易")
	}
	if stock.HaltedUntil > time.Now().Unix() {
		return nil, errors.New("该股票临时停牌中，暂停交易")
	}
	userQuota, err := GetUserQuota(userId, false)
	if err != nil {
		return nil, err
	}
	if userQuota < marginQuota {
		return nil, errors.New("余额不足")
	}
	marginUsd := float64(marginQuota) / common.QuotaPerUnit
	// 仓位规模 = 保证金 * 杠杆 / 价格（股）
	size := marginUsd * float64(leverage) / stock.LastPrice
	now := common.GetTimestamp()
	position := &GameFuturesPosition{
		UserId: userId, StockId: stockId, Side: side, Leverage: leverage, MarginUsd: marginUsd,
		EntryPrice: stock.LastPrice, Size: size, Status: "open",
		CreatedTime: now, UpdatedTime: now,
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&User{}).
			Where("id = ? AND quota >= ?", userId, marginQuota).
			Update("quota", gorm.Expr("quota - ?", marginQuota))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("余额不足")
		}
		return tx.Create(position).Error
	})
	if err != nil {
		return nil, err
	}
	if err := cacheDecrUserQuota(userId, int64(marginQuota)); err != nil {
		common.SysLog("failed to decrease user quota cache: " + err.Error())
	}
	return position, nil
}

// CloseFutures 平仓，结算盈亏到余额。
func CloseFutures(userId int, positionId int) (*GameFuturesPosition, error) {
	var position GameFuturesPosition
	if err := DB.Where("id = ? AND user_id = ?", positionId, userId).First(&position).Error; err != nil {
		return nil, errors.New("position not found")
	}
	if position.Status != "open" {
		return nil, errors.New("position already closed")
	}
	stock, err := GetGameStockById(position.StockId)
	if err != nil {
		return nil, errors.New("stock not found")
	}
	var diff float64
	if position.Side == "long" {
		diff = stock.LastPrice - position.EntryPrice
	} else {
		diff = position.EntryPrice - stock.LastPrice
	}
	pnl := diff * position.Size
	// 强平：亏损达到保证金
	if pnl <= -position.MarginUsd {
		pnl = -position.MarginUsd
	}
	settleUsd := position.MarginUsd + pnl
	if settleUsd < 0 {
		settleUsd = 0
	}
	settleQuota := int(settleUsd * common.QuotaPerUnit)
	updates := map[string]any{
		"status":       "closed",
		"close_price":  stock.LastPrice,
		"pnl_usd":      pnl,
		"updated_time": common.GetTimestamp(),
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&GameFuturesPosition{}).
			Where("id = ? AND user_id = ? AND status = ?", positionId, userId, "open").
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("position already closed")
		}
		if settleQuota > 0 {
			result = tx.Model(&User{}).
				Where("id = ?", userId).
				Update("quota", gorm.Expr("quota + ?", settleQuota))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return errors.New("user not found")
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if settleQuota > 0 {
		if err := cacheIncrUserQuota(userId, int64(settleQuota)); err != nil {
			common.SysLog("failed to increase user quota cache: " + err.Error())
		}
	}
	DB.First(&position, positionId)
	return &position, nil
}

func ListOpenFutures(userId int) ([]*GameFuturesPosition, error) {
	positions := make([]*GameFuturesPosition, 0)
	err := DB.Where("user_id = ? AND status = 'open'", userId).Order("id desc").Find(&positions).Error
	// 附加当前价和浮动盈亏
	for _, pos := range positions {
		stock, stockErr := GetGameStockById(pos.StockId)
		if stockErr != nil {
			return positions, stockErr
		}
		pos.MarkPrice = stock.LastPrice
		if pos.Side == "long" {
			pos.PnlUsd = (stock.LastPrice - pos.EntryPrice) * pos.Size
		} else {
			pos.PnlUsd = (pos.EntryPrice - stock.LastPrice) * pos.Size
		}
		if pos.MarginUsd > 0 {
			pos.PnlPct = pos.PnlUsd / pos.MarginUsd * 100
		}
	}
	return positions, err
}

func ListFuturesHistory(userId int, limit int) ([]*GameFuturesPosition, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	positions := make([]*GameFuturesPosition, 0)
	err := DB.Where("user_id = ? AND status = 'closed'", userId).Order("id desc").Limit(limit).Find(&positions).Error
	return positions, err
}

func GetUserStockTrades(userId int, limit int) ([]*GameStockTrade, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	trades := make([]*GameStockTrade, 0)
	err := DB.Where("user_id = ?", userId).Order("id desc").Limit(limit).Find(&trades).Error
	return trades, err
}

func GetGameStockQuoteMap() (map[int]*GameStock, error) {
	stocks, err := ListGameStocks()
	if err != nil {
		return nil, err
	}
	m := make(map[int]*GameStock, len(stocks))
	for _, s := range stocks {
		m[s.Id] = s
	}
	return m, nil
}

var _ = fmt.Sprintf // keep fmt when unused in future edits
var _ = gorm.ErrRecordNotFound
