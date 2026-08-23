import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, InputNumber, Select, Space, Table, Tag, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';

const { Text } = Typography;

const PHASE_LABELS = {
  pre_open: { text: '开盘前', color: 'grey' },
  open: { text: '交易中', color: 'green' },
  lunch: { text: '午间休市', color: 'orange' },
  closed: { text: '已收盘', color: 'red' },
};

const REGIME_LABELS = {
  bull: { text: '牛市 🐂', color: 'red' },
  neutral: { text: '震荡市', color: 'grey' },
  bear: { text: '熊市 🐻', color: 'green' },
  crash: { text: '崩盘 ⚠️', color: 'red' },
  bubble: { text: '泡沫 🔥', color: 'orange' },
};

const IMPACT_COLORS = {
  earnings: 'violet',
  macro: 'blue',
  corporate: 'cyan',
  accident: 'red',
  legal: 'orange',
  manipulation: 'pink',
  liquidity: 'teal',
  index: 'purple',
  halt: 'grey',
  delisting: 'red',
};

// 自绘K线图（蜡烛图）
const KlineChart = ({ klines }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || klines.length === 0) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const padding = { top: 10, right: 50, bottom: 20, left: 10 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const highs = klines.map((k) => k.high || k.High);
    const lows = klines.map((k) => k.low || k.Low);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const range = max - min || 1;
    const y = (v) => padding.top + chartH - ((v - min) / range) * chartH;
    const cw = chartW / klines.length;

    // 网格与价格轴
    ctx.strokeStyle = '#1e293b';
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    for (let i = 0; i <= 5; i++) {
      const price = min + (range * i) / 5;
      const yy = y(price);
      ctx.beginPath();
      ctx.moveTo(padding.left, yy);
      ctx.lineTo(padding.left + chartW, yy);
      ctx.stroke();
      ctx.fillText(price.toFixed(2), padding.left + chartW + 4, yy + 3);
    }

    // 蜡烛
    klines.forEach((k, i) => {
      const open = k.open ?? k.Open;
      const close = k.close ?? k.Close;
      const high = k.high ?? k.High;
      const low = k.low ?? k.Low;
      const x = padding.left + i * cw + cw / 2;
      const up = close >= open;
      ctx.strokeStyle = up ? '#22c55e' : '#ef4444';
      ctx.fillStyle = up ? '#22c55e' : '#ef4444';
      // 影线
      ctx.beginPath();
      ctx.moveTo(x, y(high));
      ctx.lineTo(x, y(low));
      ctx.stroke();
      // 实体
      const bodyTop = y(Math.max(open, close));
      const bodyH = Math.max(1, Math.abs(y(open) - y(close)));
      const bodyW = Math.max(1, cw * 0.6);
      ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyH);
    });
  }, [klines]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={280}
      className='w-full rounded'
      style={{ background: '#0f172a' }}
    />
  );
};

const StockMarket = ({ t }) => {
  const [phase, setPhase] = useState('closed');
  const [regime, setRegime] = useState('neutral');
  const [stocks, setStocks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [klines, setKlines] = useState([]);
  const [news, setNews] = useState([]);
  const [orderBook, setOrderBook] = useState([]);
  const [shares, setShares] = useState(1);
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const res = await API.get('/api/user/game/stock/overview');
      if (res.data.success) {
        setPhase(res.data.data.phase);
        setRegime(res.data.data.regime);
        setStocks(res.data.data.stocks || []);
        if (!selectedId && res.data.data.stocks?.length) {
          setSelectedId(res.data.data.stocks[0].id);
        }
      }
    } catch (e) {
      showError(e.message);
    }
  }, [selectedId]);

  const loadNews = useCallback(async (id) => {
    try {
      const url = id ? `/api/user/game/stock/news?stock_id=${id}&limit=50` : '/api/user/game/stock/news?limit=50';
      const res = await API.get(url);
      if (res.data.success) {
        setNews(res.data.data || []);
      }
    } catch (e) {
      // 静默
    }
  }, []);

  const loadOrderBook = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await API.get(`/api/user/game/stock/orderbook/${id}`);
      if (res.data.success) {
        setOrderBook(res.data.data.book || []);
      }
    } catch (e) {
      // 静默
    }
  }, []);

  const loadKlines = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await API.get(`/api/user/game/stock/klines/${id}?limit=120`);
      if (res.data.success) {
        // 兼容首字母大小写两种字段
        setKlines(res.data.data || []);
      }
    } catch (e) {
      showError(e.message);
    }
  }, []);

  const loadPositions = useCallback(async () => {
    try {
      const res = await API.get('/api/user/game/stock/positions');
      if (res.data.success) {
        setPositions(res.data.data.positions || []);
        setTrades(res.data.data.trades || []);
      }
    } catch (e) {
      // 静默
    }
  }, []);

  useEffect(() => {
    loadOverview();
    loadPositions();
    loadNews(null);
  }, [loadOverview, loadPositions, loadNews]);

  useEffect(() => {
    loadKlines(selectedId);
    loadNews(selectedId);
    loadOrderBook(selectedId);
  }, [selectedId, loadKlines, loadNews, loadOrderBook]);

  // 交易时段每 30 秒刷新行情与K线
  useEffect(() => {
    const timer = setInterval(() => {
      loadOverview();
      loadKlines(selectedId);
      loadNews(selectedId);
      loadOrderBook(selectedId);
    }, 30000);
    return () => clearInterval(timer);
  }, [loadOverview, loadKlines, loadNews, loadOrderBook, selectedId]);

  const selectedStock = stocks.find((s) => s.id === selectedId);

  const trade = async (side) => {
    if (!selectedId || shares <= 0) return;
    setBusy(true);
    try {
      const res = await API.post('/api/user/game/stock/trade', {
        stock_id: selectedId,
        side,
        shares: Math.floor(shares),
      });
      if (res.data.success) {
        showSuccess(
          side === 'buy'
            ? t('买入成功：{{n}} 股 × ${{p}}', { n: res.data.data.shares, p: res.data.data.price.toFixed(2) })
            : t('卖出成功：{{n}} 股 × ${{p}}', { n: res.data.data.shares, p: res.data.data.price.toFixed(2) }),
        );
        loadPositions();
        loadOverview();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const phaseInfo = PHASE_LABELS[phase] || PHASE_LABELS.closed;
  const regimeInfo = REGIME_LABELS[regime] || REGIME_LABELS.neutral;

  const posColumns = [
    { title: t('代码'), dataIndex: 'stock_code' },
    { title: t('名称'), dataIndex: 'stock_name' },
    { title: t('持股'), dataIndex: 'shares' },
    { title: t('成本均价'), dataIndex: 'cost_avg', render: (v) => `$${v.toFixed(2)}` },
    { title: t('现价'), dataIndex: 'last_price', render: (v) => `$${v.toFixed(2)}` },
    { title: t('市值'), dataIndex: 'market_value', render: (v) => `$${v.toFixed(2)}` },
    {
      title: t('浮动盈亏'),
      dataIndex: 'pnl',
      render: (v, r) => (
        <Text type={v >= 0 ? 'success' : 'danger'}>
          ${v.toFixed(2)} ({r.pnl_pct.toFixed(1)}%)
        </Text>
      ),
    },
  ];

  return (
    <div>
      <div className='flex items-center justify-between mb-3 flex-wrap gap-2'>
        <Space>
          <Tag color={phaseInfo.color}>{t(phaseInfo.text)}</Tag>
          <Tag color={regimeInfo.color} type='solid'>{t(regimeInfo.text)}</Tag>
          <Text type='secondary' size='small'>
            {t('交易时间：工作日 9:30-11:30 / 13:00-15:00，涨跌幅 ±10%')}
          </Text>
        </Space>
        <Button size='small' onClick={() => { loadOverview(); loadKlines(selectedId); loadPositions(); loadNews(selectedId); loadOrderBook(selectedId); }}>
          {t('刷新')}
        </Button>
      </div>

      {/* 股票列表 */}
      <div className='grid gap-2 mb-3' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {stocks.map((s) => {
          const pct = s.prev_close > 0 ? ((s.last_price - s.prev_close) / s.prev_close) * 100 : 0;
          return (
            <div
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className='rounded-lg p-2 cursor-pointer'
              style={{
                border: `2px solid ${selectedId === s.id ? 'var(--semi-color-primary)' : 'var(--semi-color-border)'}`,
                background: selectedId === s.id ? 'var(--semi-color-primary-light-default)' : 'transparent',
                opacity: s.delisted ? 0.5 : 1,
              }}
            >
              <Text strong>{s.code}</Text>
              {s.delisted && <Tag color='red' size='small'>{t('退市')}</Tag>}
              {!s.delisted && s.halted && <Tag color='grey' size='small'>{t('停牌')}</Tag>}
              <Text type='secondary' className='block' size='small'>{s.name}</Text>
              <Text strong style={{ color: pct >= 0 ? '#ef4444' : '#22c55e' }}>
                ${s.last_price.toFixed(2)}
              </Text>
              <Text size='small' style={{ color: pct >= 0 ? '#ef4444' : '#22c55e' }}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
              </Text>
            </div>
          );
        })}
      </div>

      {/* K线 + 盘口并排 */}
      <div className='grid gap-3' style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(200px, 1fr)' }}>
        <KlineChart klines={klines} />

        {/* 五档盘口 */}
        <div className='rounded-lg p-2' style={{ background: 'var(--semi-color-fill-0)' }}>
          <Text strong className='block mb-1'>{t('五档盘口')}</Text>
          {orderBook.map((row, i) => (
            <div key={i} className='flex justify-between text-xs leading-6'>
              <span style={{ color: row.side === 'ask' ? '#ef4444' : row.side === 'bid' ? '#22c55e' : 'var(--semi-color-text)' }}>
                {row.side === 'ask' ? t('卖') + row.level : row.side === 'bid' ? t('买') + row.level : t('最新')}
              </span>
              <span style={{ color: row.side === 'ask' ? '#ef4444' : row.side === 'bid' ? '#22c55e' : 'var(--semi-color-text)' }}>
                ${Number(row.price).toFixed(2)}
              </span>
              <span style={{ color: 'var(--semi-color-text-2)' }}>{row.volume || ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 新闻事件流 */}
      <div className='mt-4'>
        <Text strong className='block mb-2'>{t('📰 市场快讯')}</Text>
        <div className='rounded-lg p-3 max-h-56 overflow-y-auto' style={{ background: 'var(--semi-color-fill-0)' }}>
          {news.length === 0 && <Text type='secondary'>{t('暂无快讯，开盘后事件将实时推送')}</Text>}
          {news.map((e) => (
            <div key={e.id} className='mb-2 pb-2' style={{ borderBottom: '1px solid var(--semi-color-border)' }}>
              <div className='flex items-center gap-2 flex-wrap'>
                <Tag size='small' color={IMPACT_COLORS[e.category] || 'grey'}>{t(e.title.split(' ')[0] === '央行' || e.stock_code === 'MARKET' ? '宏观' : e.category)}</Tag>
                <Text strong size='small'>{e.title}</Text>
                {e.impact_pct !== 0 && (
                  <Text size='small' type={e.impact_pct > 0 ? 'success' : 'danger'}>
                    {e.impact_pct > 0 ? '+' : ''}{e.impact_pct.toFixed(1)}%
                  </Text>
                )}
              </div>
              <Text type='secondary' size='small' className='block'>
                {e.body}{e.expectation ? ` · ${e.expectation}` : ''}
              </Text>
            </div>
          ))}
        </div>
      </div>

      {/* 交易面板 */}
      <div
        className='flex items-center justify-between gap-3 mt-3 p-3 rounded-lg flex-wrap'
        style={{ background: 'var(--semi-color-fill-0)' }}
      >
        <Space>
          <Text strong>
            {selectedStock ? `${selectedStock.code} · ${selectedStock.name} · $${selectedStock.last_price.toFixed(2)}` : ''}
          </Text>
          {selectedStock?.delisted && <Tag color='red'>{t('已退市')}</Tag>}
          {selectedStock?.halted && <Tag color='grey'>{t('停牌中')}</Tag>}
        </Space>
        <Space>
          <InputNumber
            value={shares}
            min={1}
            onChange={(v) => setShares(Math.max(1, Math.floor(v || 1)))}
            style={{ width: 120 }}
            suffix={t('股')}
          />
          <Button
            theme='solid'
            type='danger'
            loading={busy}
            disabled={phase !== 'open' || selectedStock?.halted || selectedStock?.delisted}
            onClick={() => trade('buy')}
          >
            {t('买入')}
          </Button>
          <Button
            theme='solid'
            type='success'
            loading={busy}
            disabled={phase !== 'open' || selectedStock?.halted || selectedStock?.delisted}
            onClick={() => trade('sell')}
          >
            {t('卖出')}
          </Button>
        </Space>
      </div>

      {/* 持仓 */}
      <div className='mt-4'>
        <Text strong className='block mb-2'>{t('我的持仓')}</Text>
        <Table
          columns={posColumns}
          dataSource={positions}
          pagination={false}
          size='small'
          empty={<Text type='secondary'>{t('暂无持仓')}</Text>}
        />
      </div>

      {/* 成交记录 */}
      <div className='mt-4'>
        <Text strong className='block mb-2'>{t('成交记录')}</Text>
        <Table
          columns={[
            { title: t('代码'), dataIndex: 'stock_code' },
            { title: t('方向'), dataIndex: 'side', render: (v) => <Tag color={v === 'buy' ? 'red' : 'green'}>{v === 'buy' ? t('买入') : t('卖出')}</Tag> },
            { title: t('价格'), dataIndex: 'price', render: (v) => `$${v.toFixed(2)}` },
            { title: t('股数'), dataIndex: 'shares' },
          ]}
          dataSource={trades.slice(0, 10)}
          pagination={false}
          size='small'
          empty={<Text type='secondary'>{t('暂无成交')}</Text>}
        />
      </div>
    </div>
  );
};

export default StockMarket;
