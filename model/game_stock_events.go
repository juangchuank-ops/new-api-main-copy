package model

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// ---------------------------------------------------------------------------
// 事件驱动股市引擎：新闻事件 / 公司行为 / 宏观事件 / 财报 / 停牌 / 退市
// 参照《全球股票市场模拟器：完备事件与状态规范 v1.0》的事件引擎架构，
// 以“事件 → 价格冲击 → 后续事件”的链条驱动行情，而非纯随机游走。
// ---------------------------------------------------------------------------

// GameStockEvent 事件流水。StockId=0 表示市场级（宏观）事件。
type GameStockEvent struct {
	Id          int     `json:"id"`
	StockId     int     `json:"stock_id"`
	StockCode   string  `json:"stock_code" gorm:"type:varchar(16)"`
	Category    string  `json:"category" gorm:"type:varchar(32);index"` // earnings/macro/corporate/accident/legal/manipulation/liquidity/index/halt/delisting
	EventType   string  `json:"event_type" gorm:"type:varchar(64)"`
	Title       string  `json:"title" gorm:"type:varchar(255)"`
	Body        string  `json:"body" gorm:"type:text"`
	ImpactPct   float64 `json:"impact_pct"`                           // 该事件造成的价格冲击（%，正涨负跌）
	Expectation string  `json:"expectation" gorm:"type:varchar(128)"` // 财报事件的预期 vs 实际
	CreatedTime int64   `json:"created_time" gorm:"bigint;index"`
}

// 股票扩展状态（写入 GameStock.HaltUntil / Delisted / NextEarningsTs / ExpectedEps）

// 事件模板：weight 为相对权重；impact 为价格冲击区间（%）
type stockEventTemplate struct {
	Type      string
	Category  string
	TitleFmt  string // %s = 股票名
	BodyFmt   string
	MinImpact float64
	MaxImpact float64
	Weight    int
}

var stockEventPool = []stockEventTemplate{
	// 财报与业绩
	{Type: "earnings_beat", Category: "earnings", TitleFmt: "%s 财报超预期", BodyFmt: "实际 EPS 大幅超出市场预期，机构纷纷上调目标价。", MinImpact: 3, MaxImpact: 9, Weight: 10},
	{Type: "earnings_miss", Category: "earnings", TitleFmt: "%s 财报不及预期", BodyFmt: "营收与利润双双低于预期，盘后遭遇抛售。", MinImpact: -9, MaxImpact: -3, Weight: 10},
	{Type: "guidance_raise", Category: "earnings", TitleFmt: "%s 上调业绩指引", BodyFmt: "管理层对未来季度表达强烈信心。", MinImpact: 2, MaxImpact: 6, Weight: 8},
	{Type: "guidance_cut", Category: "earnings", TitleFmt: "%s 发布盈利预警", BodyFmt: "需求走弱，公司下调全年展望。", MinImpact: -7, MaxImpact: -2, Weight: 8},
	// 公司正面
	{Type: "big_contract", Category: "corporate", TitleFmt: "%s 斩获大额订单", BodyFmt: "与头部客户签署长期供货协议。", MinImpact: 2, MaxImpact: 8, Weight: 8},
	{Type: "buyback", Category: "corporate", TitleFmt: "%s 宣布回购计划", BodyFmt: "董事会批准大额回购，彰显信心。", MinImpact: 1, MaxImpact: 5, Weight: 7},
	{Type: "analyst_upgrade", Category: "corporate", TitleFmt: "%s 获分析师上调评级", BodyFmt: "头部投行将评级升至“买入”。", MinImpact: 1, MaxImpact: 5, Weight: 8},
	{Type: "index_inclusion", Category: "index", TitleFmt: "%s 被纳入核心指数", BodyFmt: "被动资金将随之流入。", MinImpact: 2, MaxImpact: 7, Weight: 5},
	{Type: "institution_buy", Category: "liquidity", TitleFmt: "机构大举买入 %s", BodyFmt: "知名基金建仓，成交量显著放大。", MinImpact: 2, MaxImpact: 6, Weight: 7},
	{Type: "institution_sell", Category: "liquidity", TitleFmt: "机构减持 %s", BodyFmt: "大股东与基金同步减持。", MinImpact: -6, MaxImpact: -2, Weight: 7},
	// 公司负面
	{Type: "ceo_resign", Category: "accident", TitleFmt: "%s CEO 突然辞职", BodyFmt: "高管变动引发不确定性。", MinImpact: -8, MaxImpact: -2, Weight: 6},
	{Type: "product_recall", Category: "accident", TitleFmt: "%s 产品召回", BodyFmt: "核心产品出现质量问题。", MinImpact: -8, MaxImpact: -3, Weight: 5},
	{Type: "data_breach", Category: "accident", TitleFmt: "%s 遭数据泄露", BodyFmt: "网络攻击导致用户数据外泄。", MinImpact: -7, MaxImpact: -2, Weight: 5},
	{Type: "lawsuit", Category: "legal", TitleFmt: "%s 面临集体诉讼", BodyFmt: "投资者指控信息披露违规。", MinImpact: -6, MaxImpact: -2, Weight: 5},
	{Type: "regulatory_probe", Category: "legal", TitleFmt: "监管对 %s 展开调查", BodyFmt: "涉及涉嫌市场操纵的审查。", MinImpact: -9, MaxImpact: -3, Weight: 4},
	{Type: "fraud_allegation", Category: "legal", TitleFmt: "%s 被质疑财务造假", BodyFmt: "做空机构发布沽空报告。", MinImpact: -10, MaxImpact: -4, Weight: 3},
	{Type: "factory_accident", Category: "accident", TitleFmt: "%s 工厂发生事故", BodyFmt: "主要产线被迫停产检修。", MinImpact: -7, MaxImpact: -2, Weight: 4},
	{Type: "short_squeeze", Category: "manipulation", TitleFmt: "%s 遭遇逼空行情", BodyFmt: "空头被迫高位回补，股价急拉。", MinImpact: 5, MaxImpact: 10, Weight: 3},
	{Type: "analyst_downgrade", Category: "corporate", TitleFmt: "%s 遭分析师下调评级", BodyFmt: "估值过高被降至“减持”。", MinImpact: -5, MaxImpact: -1, Weight: 8},
	{Type: "index_removal", Category: "index", TitleFmt: "%s 被移出核心指数", BodyFmt: "被动资金面临撤出压力。", MinImpact: -7, MaxImpact: -2, Weight: 4},
}

// 宏观事件（市场级，影响所有股票）
type macroEventTemplate struct {
	Type      string
	Title     string
	Body      string
	MinImpact float64 // 对每只股票的冲击（%）
	MaxImpact float64
	Weight    int
	// RegimeShift 触发市场情绪切换：bull/bear/crash/bubble
	RegimeShift string
}

var macroEventPool = []macroEventTemplate{
	{Type: "rate_hike", Title: "央行意外加息", Body: "紧缩超预期，风险资产承压。", MinImpact: -4, MaxImpact: -1, Weight: 8, RegimeShift: "bear"},
	{Type: "rate_cut", Title: "央行降息", Body: "流动性宽松，股市走强。", MinImpact: 1, MaxImpact: 4, Weight: 8, RegimeShift: "bull"},
	{Type: "cpi_hot", Title: "通胀数据超预期", Body: "CPI 高企引发紧缩担忧。", MinImpact: -3, MaxImpact: -1, Weight: 7},
	{Type: "cpi_cool", Title: "通胀降温", Body: "物价回落提振市场情绪。", MinImpact: 1, MaxImpact: 3, Weight: 7},
	{Type: "gdp_strong", Title: "GDP 强劲增长", Body: "经济数据亮眼。", MinImpact: 1, MaxImpact: 3, Weight: 6, RegimeShift: "bull"},
	{Type: "recession_fear", Title: "衰退警报拉响", Body: "收益率曲线倒挂，避险情绪升温。", MinImpact: -5, MaxImpact: -2, Weight: 6, RegimeShift: "bear"},
	{Type: "geopolitical", Title: "地缘冲突升级", Body: "国际局势紧张，资金涌入避险资产。", MinImpact: -6, MaxImpact: -2, Weight: 5, RegimeShift: "bear"},
	{Type: "trade_deal", Title: "贸易协定达成", Body: "关税壁垒降低，出口板块受益。", MinImpact: 2, MaxImpact: 5, Weight: 5, RegimeShift: "bull"},
	{Type: "bank_crisis", Title: "银行危机爆发", Body: "系统性风险蔓延，市场恐慌。", MinImpact: -10, MaxImpact: -4, Weight: 2, RegimeShift: "crash"},
	{Type: "euphoria", Title: "市场狂欢情绪蔓延", Body: "散户跑步进场，估值急剧扩张。", MinImpact: 3, MaxImpact: 8, Weight: 3, RegimeShift: "bubble"},
}

// 市场情绪状态
const (
	MarketRegimeBull    = "bull"    // 牛市：整体上偏
	MarketRegimeNeutral = "neutral" // 中性
	MarketRegimeBear    = "bear"    // 熊市：整体下偏
	MarketRegimeCrash   = "crash"   // 崩盘：大幅下偏，高波动
	MarketRegimeBubble  = "bubble"  // 泡沫：大幅上偏，高波动
)

const marketRegimeOptionKey = "game_stock_market_regime"
const marketRegimeSetTimeKey = "game_stock_market_regime_time"
const StockEventImpactLimitPct = 3.0

func GetMarketRegime() string {
	var option Option
	if err := DB.Where(commonKeyCol+" = ?", marketRegimeOptionKey).First(&option).Error; err == nil {
		switch option.Value {
		case MarketRegimeBull, MarketRegimeNeutral, MarketRegimeBear, MarketRegimeCrash, MarketRegimeBubble:
			return option.Value
		}
	}
	return MarketRegimeNeutral
}

func setMarketRegime(regime string) {
	_ = DB.Save(&Option{Key: marketRegimeOptionKey, Value: regime}).Error
	_ = DB.Save(&Option{Key: marketRegimeSetTimeKey, Value: fmt.Sprintf("%d", common.GetTimestamp())}).Error
}

// regimeDrift 每根K线的整体漂移（%）
func regimeDrift(regime string) (drift float64, volatility float64) {
	switch regime {
	case MarketRegimeBull:
		return 0.0012, 0.010
	case MarketRegimeBear:
		return -0.0012, 0.012
	case MarketRegimeCrash:
		return -0.0035, 0.020
	case MarketRegimeBubble:
		return 0.0035, 0.020
	default:
		return 0.0002, 0.010
	}
}

func weightedStockEvent() stockEventTemplate {
	total := 0
	for _, e := range stockEventPool {
		total += e.Weight
	}
	n := rand.Intn(total)
	for _, e := range stockEventPool {
		n -= e.Weight
		if n < 0 {
			return e
		}
	}
	return stockEventPool[0]
}

func weightedMacroEvent() macroEventTemplate {
	total := 0
	for _, e := range macroEventPool {
		total += e.Weight
	}
	n := rand.Intn(total)
	for _, e := range macroEventPool {
		n -= e.Weight
		if n < 0 {
			return e
		}
	}
	return macroEventPool[0]
}

func recordStockEvent(stockId int, stockCode, category, eventType, title, body string, impact float64, expectation string) {
	_ = DB.Create(&GameStockEvent{
		StockId: stockId, StockCode: stockCode, Category: category, EventType: eventType,
		Title: title, Body: body, ImpactPct: impact, Expectation: expectation,
		CreatedTime: common.GetTimestamp(),
	}).Error
}

// applyPriceImpact 以事件冲击更新股价（单次冲击限制在±3%，再带涨跌停约束），返回实际变化后价格。
func applyPriceImpact(stock *GameStock, impactPct float64) float64 {
	if impactPct > StockEventImpactLimitPct {
		impactPct = StockEventImpactLimitPct
	} else if impactPct < -StockEventImpactLimitPct {
		impactPct = -StockEventImpactLimitPct
	}
	target := stock.LastPrice * (1 + impactPct/100)
	return clampPrice(target, stock.PrevClose)
}

// MaybeTriggerStockEvents 每根K线后以小概率触发事件。宏观事件更稀有。
func MaybeTriggerStockEvents(stocks []*GameStock, now time.Time) {
	// 宏观事件：每分钟约 1.5% 概率
	if rand.Float64() < 0.015 {
		triggerMacroEvent(stocks)
	}
	// 个股事件：每只每分钟约 4% 概率
	for _, stock := range stocks {
		if stock.HaltedUntil > now.Unix() || stock.Delisted {
			continue
		}
		if rand.Float64() < 0.04 {
			triggerStockEvent(stock)
		}
	}
}

func triggerMacroEvent(stocks []*GameStock) {
	tpl := weightedMacroEvent()
	impact := tpl.MinImpact + rand.Float64()*(tpl.MaxImpact-tpl.MinImpact)
	recordStockEvent(0, "MARKET", "macro", tpl.Type, tpl.Title, tpl.Body, impact, "")
	if tpl.RegimeShift != "" && rand.Float64() < 0.5 {
		setMarketRegime(tpl.RegimeShift)
	}
	for _, stock := range stocks {
		if stock.Delisted {
			continue
		}
		perStock := impact * (0.6 + rand.Float64()*0.8) // 各股受影响程度不同
		newPrice := applyPriceImpact(stock, perStock)
		updateStockPriceByEvent(stock, newPrice)
	}
}

func triggerStockEvent(stock *GameStock) {
	tpl := weightedStockEvent()
	impact := tpl.MinImpact + rand.Float64()*(tpl.MaxImpact-tpl.MinImpact)
	title := fmt.Sprintf(tpl.TitleFmt, stock.Name)
	body := tpl.BodyFmt
	expectation := ""
	newPrice := applyPriceImpact(stock, impact)

	switch tpl.Type {
	case "earnings_beat":
		expected := 0.5 + rand.Float64()*2
		actual := expected * (1.15 + rand.Float64()*0.35)
		expectation = fmt.Sprintf("预期 EPS %.2f / 实际 %.2f", expected, actual)
	case "earnings_miss":
		expected := 0.5 + rand.Float64()*2
		actual := expected * (0.55 + rand.Float64()*0.3)
		expectation = fmt.Sprintf("预期 EPS %.2f / 实际 %.2f", expected, actual)
	}

	recordStockEvent(stock.Id, stock.Code, tpl.Category, tpl.Type, title, body, impact, expectation)
	updateStockPriceByEvent(stock, newPrice)

	// 重大负面 → 触发临时停牌（极端波动机制）
	if impact <= -7 && rand.Float64() < 0.4 {
		haltUntil := common.GetTimestamp() + 300 // 5 分钟
		_ = DB.Model(&GameStock{}).Where("id = ?", stock.Id).
			Update("halted_until", haltUntil).Error
		stock.HaltedUntil = haltUntil
		recordStockEvent(stock.Id, stock.Code, "halt", "trading_halt",
			fmt.Sprintf("%s 触发临时停牌", stock.Name),
			"股价剧烈波动，交易所宣布临时停牌 5 分钟。", 0, "")
	}
}

// updateStockPriceByEvent 事件后同步股票价格字段（不动K线，K线由 tick 写）。
func updateStockPriceByEvent(stock *GameStock, newPrice float64) {
	if newPrice <= 0 {
		newPrice = stock.LastPrice
	}
	stock.LastPrice = newPrice
	if newPrice > stock.HighPrice || stock.HighPrice == 0 {
		stock.HighPrice = newPrice
	}
	if newPrice < stock.LowPrice || stock.LowPrice == 0 {
		stock.LowPrice = newPrice
	}
	stock.UpdatedTime = common.GetTimestamp()
	_ = DB.Model(stock).Updates(map[string]any{
		"last_price": stock.LastPrice, "high_price": stock.HighPrice,
		"low_price": stock.LowPrice, "updated_time": stock.UpdatedTime,
	}).Error
}

// TriggerCorporateActions 稀有公司行为：分红 / 拆股 / 退市并购。
// 由每日开盘前调用（或每 tick 以极低概率）。
func TriggerCorporateActions(now time.Time) {
	stocks, err := ListGameStocks()
	if err != nil {
		return
	}
	for _, stock := range stocks {
		if stock.Delisted {
			continue
		}
		roll := rand.Float64()
		switch {
		case roll < 0.010: // 现金分红
			divPerShare := stock.LastPrice * (0.005 + rand.Float64()*0.01)
			payDividendToHolders(stock, divPerShare)
			recordStockEvent(stock.Id, stock.Code, "corporate", "dividend",
				fmt.Sprintf("%s 派发现金红利", stock.Name),
				fmt.Sprintf("每股派息 $%.3f，已自动发放至持仓账户。", divPerShare), 0,
				fmt.Sprintf("每股股息 $%.3f", divPerShare))
			// 除息：股价扣除股息
			newPrice := clampPrice(stock.LastPrice-divPerShare, stock.PrevClose)
			updateStockPriceByEvent(stock, newPrice)
		case roll < 0.014: // 股票拆分（2:1 或 3:1）
			ratio := 2
			if rand.Float64() < 0.3 {
				ratio = 3
			}
			applyStockSplit(stock, ratio)
			recordStockEvent(stock.Id, stock.Code, "corporate", "split",
				fmt.Sprintf("%s 实施 %d:1 拆股", stock.Name, ratio),
				fmt.Sprintf("股价与持仓股数已按 %d:1 自动调整。", ratio), 0, "")
		case roll < 0.016: // 要约收购 → 退市，持仓按溢价现金结算
			premium := 1.15 + rand.Float64()*0.35
			acquirePrice := stock.LastPrice * premium
			acquireAndDelist(stock, acquirePrice)
			recordStockEvent(stock.Id, stock.Code, "delisting", "acquisition",
				fmt.Sprintf("%s 被要约收购并退市", stock.Name),
				fmt.Sprintf("收购价 $%.2f（溢价 %.0f%%），持仓已自动现金结算。", acquirePrice, (premium-1)*100), 0, "")
		case roll < 0.017: // 破产退市（极稀有）
			if rand.Float64() < 0.3 {
				acquireAndDelist(stock, 0.01) // 股东最后受偿，几乎归零
				recordStockEvent(stock.Id, stock.Code, "delisting", "bankruptcy",
					fmt.Sprintf("%s 宣布破产清算", stock.Name),
					"资不抵债进入清算程序，股票摘牌，股东受偿归零。", -100, "")
			}
		}
	}
}

// payDividendToHolders 给所有持仓者按每股股息发余额。
func payDividendToHolders(stock *GameStock, divPerShare float64) {
	var positions []GameStockPosition
	if err := DB.Where("stock_id = ? AND shares > 0", stock.Id).Find(&positions).Error; err != nil {
		return
	}
	for _, pos := range positions {
		usd := divPerShare * float64(pos.Shares)
		quota := int(usd * common.QuotaPerUnit)
		if quota > 0 {
			_ = IncreaseUserQuota(pos.UserId, quota, false)
		}
	}
}

// applyStockSplit 拆股：价格除以比例，持仓乘以比例（成本同调）。
func applyStockSplit(stock *GameStock, ratio int) {
	oldPrice := stock.LastPrice
	newPrice := oldPrice / float64(ratio)
	stock.LastPrice = newPrice
	stock.PrevClose = stock.PrevClose / float64(ratio)
	stock.ListingPrice = stock.ListingPrice / float64(ratio)
	stock.HighPrice = newPrice
	stock.LowPrice = newPrice
	stock.UpdatedTime = common.GetTimestamp()
	_ = DB.Model(stock).Updates(map[string]any{
		"last_price": newPrice, "prev_close": stock.PrevClose,
		"listing_price": stock.ListingPrice, "high_price": newPrice,
		"low_price": newPrice, "updated_time": stock.UpdatedTime,
	}).Error
	// 持仓与成本调整
	var positions []GameStockPosition
	if err := DB.Where("stock_id = ?", stock.Id).Find(&positions).Error; err == nil {
		for _, pos := range positions {
			if pos.Shares <= 0 {
				continue
			}
			_ = DB.Model(&GameStockPosition{}).Where("id = ?", pos.Id).
				Updates(map[string]any{
					"shares":     pos.Shares * ratio,
					"cost_total": pos.CostTotal,
				}).Error
		}
	}
	// K线按比例缩放，保持历史连续
	_ = DB.Model(&GameStockKline{}).Where("stock_id = ?", stock.Id).
		Updates(map[string]any{
			"open": newPrice, "high": newPrice, "low": newPrice, "close": newPrice,
		}).Error
}

// acquireAndDelist 退市：持仓按收购价强制现金结算，股票标记退市。
func acquireAndDelist(stock *GameStock, acquirePrice float64) {
	var positions []GameStockPosition
	if err := DB.Where("stock_id = ? AND shares > 0", stock.Id).Find(&positions).Error; err == nil {
		for _, pos := range positions {
			usd := acquirePrice * float64(pos.Shares)
			quota := int(usd * common.QuotaPerUnit)
			if quota > 0 {
				_ = IncreaseUserQuota(pos.UserId, quota, false)
			}
			_ = DB.Model(&GameStockPosition{}).Where("id = ?", pos.Id).
				Updates(map[string]any{"shares": 0, "cost_total": 0}).Error
		}
	}
	stock.Delisted = true
	stock.HaltedUntil = 0
	stock.LastPrice = acquirePrice
	_ = DB.Model(stock).Updates(map[string]any{
		"delisted": true, "halted_until": 0, "last_price": acquirePrice,
	}).Error
}

// ListGameStockEvents 新闻事件流（含市场级）。
func ListGameStockEvents(stockId int, limit int) ([]*GameStockEvent, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	events := make([]*GameStockEvent, 0)
	query := DB.Order("id desc").Limit(limit)
	if stockId > 0 {
		query = query.Where("stock_id = ? OR stock_id = 0", stockId)
	}
	return events, query.Find(&events).Error
}

// BuildOrderBook 生成五档盘口（做市商模型：围绕最新价±点差）。
// 返回按“卖5→卖1、最新价、买1→买5”从上到下排序的档位。
func BuildOrderBook(stock *GameStock) []map[string]any {
	price := stock.LastPrice
	spread := price * 0.002 // 基础点差
	book := make([]map[string]any, 0, 11)
	// 卖盘：卖5(最高) → 卖1(最低)
	for i := 5; i >= 1; i-- {
		askPrice := price + spread*float64(i)*0.5
		askVol := 300 + rand.Intn(2500*i)
		book = append(book, map[string]any{
			"side": "ask", "level": i, "price": askPrice, "volume": askVol,
		})
	}
	// 最新价占位行
	book = append(book, map[string]any{
		"side": "last", "level": 0, "price": price, "volume": 0,
	})
	// 买盘：买1(最高) → 买5(最低)
	for i := 1; i <= 5; i++ {
		bidPrice := price - spread*float64(i)*0.5
		bidVol := 300 + rand.Intn(2500*i)
		book = append(book, map[string]any{
			"side": "bid", "level": i, "price": bidPrice, "volume": bidVol,
		})
	}
	return book
}

var _ = strings.TrimSpace
