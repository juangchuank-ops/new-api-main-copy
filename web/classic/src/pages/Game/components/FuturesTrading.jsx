import React, { useCallback, useEffect, useState } from 'react';
import { Button, InputNumber, Select, Space, Table, Tag, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';

const { Text } = Typography;

const FuturesTrading = ({ t }) => {
  const [stocks, setStocks] = useState([]);
  const [stockId, setStockId] = useState(null);
  const [side, setSide] = useState('long');
  const [leverage, setLeverage] = useState(10);
  const [marginUsd, setMarginUsd] = useState(0.1); // 以美元输入
  const [openPositions, setOpenPositions] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [overviewRes, posRes] = await Promise.all([
        API.get('/api/user/game/stock/overview'),
        API.get('/api/user/game/futures/positions'),
      ]);
      if (overviewRes.data.success) {
        setStocks(overviewRes.data.data.stocks || []);
        if (!stockId && overviewRes.data.data.stocks?.length) {
          setStockId(overviewRes.data.data.stocks[0].id);
        }
      }
      if (posRes.data.success) {
        setOpenPositions(posRes.data.data.open || []);
        setHistory(posRes.data.data.history || []);
      }
    } catch (e) {
      showError(e.message);
    }
  }, [stockId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  // 额度换算：quota_per_unit 默认 500000
  const quotaPerUnit = parseFloat(localStorage.getItem('quota_per_unit')) || 500000;

  const openPosition = async () => {
    if (!stockId) return;
    const marginQuota = Math.round(marginUsd * quotaPerUnit);
    if (marginQuota <= 0) {
      showError(t('保证金必须大于 0'));
      return;
    }
    setBusy(true);
    try {
      const res = await API.post('/api/user/game/futures/open', {
        stock_id: stockId,
        side,
        leverage,
        margin_amount: marginQuota,
      });
      if (res.data.success) {
        showSuccess(t('开仓成功'));
        load();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const closePosition = async (positionId) => {
    setBusy(true);
    try {
      const res = await API.post('/api/user/game/futures/close', {
        position_id: positionId,
      });
      if (res.data.success) {
        const pnl = res.data.data.pnl_usd;
        if (pnl >= 0) {
          showSuccess(t('平仓盈利 ${{pnl}}', { pnl: pnl.toFixed(4) }));
        } else {
          showError(t('平仓亏损 ${{pnl}}', { pnl: pnl.toFixed(4) }));
        }
        load();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const selected = stocks.find((s) => s.id === stockId);

  const openColumns = [
    { title: t('方向'), dataIndex: 'side', render: (v) => <Tag color={v === 'long' ? 'red' : 'green'}>{v === 'long' ? t('做多') : t('做空')}</Tag> },
    { title: t('杠杆'), dataIndex: 'leverage', render: (v) => `${v}x` },
    { title: t('开仓价'), dataIndex: 'entry_price', render: (v) => `$${v.toFixed(2)}` },
    { title: t('标记价'), dataIndex: 'mark_price', render: (v) => (v ? `$${v.toFixed(2)}` : '-') },
    { title: t('仓位'), dataIndex: 'size', render: (v) => v.toFixed(2) },
    { title: t('保证金'), dataIndex: 'margin_usd', render: (v) => `$${v.toFixed(2)}` },
    {
      title: t('浮动盈亏'),
      dataIndex: 'pnl_usd',
      render: (v, r) => (
        <Text type={v >= 0 ? 'success' : 'danger'}>
          ${v.toFixed(4)} ({r.pnl_pct?.toFixed(1)}%)
        </Text>
      ),
    },
    {
      title: t('操作'),
      render: (_, r) => (
        <Button size='small' theme='solid' type='warning' loading={busy} onClick={() => closePosition(r.id)}>
          {t('平仓')}
        </Button>
      ),
    },
  ];

  const historyColumns = [
    { title: t('方向'), dataIndex: 'side', render: (v) => <Tag color={v === 'long' ? 'red' : 'green'}>{v === 'long' ? t('做多') : t('做空')}</Tag> },
    { title: t('杠杆'), dataIndex: 'leverage', render: (v) => `${v}x` },
    { title: t('开仓价'), dataIndex: 'entry_price', render: (v) => `$${v.toFixed(2)}` },
    { title: t('平仓价'), dataIndex: 'close_price', render: (v) => `$${v.toFixed(2)}` },
    {
      title: t('盈亏'),
      dataIndex: 'pnl_usd',
      render: (v) => <Text type={v >= 0 ? 'success' : 'danger'}>${v.toFixed(4)}</Text>,
    },
  ];

  return (
    <div>
      <Text type='secondary' className='block mb-3'>
        {t('用余额做保证金开仓，做多做空均可。亏损达到保证金即强平。盈亏随标记价格实时变动。')}
      </Text>

      {/* 开仓面板 */}
      <div
        className='p-4 rounded-lg mb-4'
        style={{ background: 'var(--semi-color-fill-0)' }}
      >
        <Space wrap>
          <Select
            value={stockId}
            onChange={setStockId}
            optionList={stocks.map((s) => ({ value: s.id, label: `${s.code} · $${s.last_price.toFixed(2)}` }))}
            style={{ width: 180 }}
          />
          <Select
            value={side}
            onChange={setSide}
            optionList={[
              { value: 'long', label: t('做多 📈') },
              { value: 'short', label: t('做空 📉') },
            ]}
            style={{ width: 120 }}
          />
          <Select
            value={leverage}
            onChange={setLeverage}
            optionList={[1, 2, 5, 10, 20, 50, 100].map((v) => ({ value: v, label: `${v}x` }))}
            style={{ width: 90 }}
          />
          <InputNumber
            value={marginUsd}
            min={0.01}
            step={0.1}
            onChange={(v) => setMarginUsd(Number(v) || 0.1)}
            suffix='$'
            style={{ width: 140 }}
            prefix={t('保证金')}
          />
          <Button theme='solid' type='primary' loading={busy} onClick={openPosition}>
            {t('开仓')}
          </Button>
        </Space>
        {selected && (
          <Text type='secondary' size='small' className='block mt-2'>
            {t('仓位规模')}：{((marginUsd * leverage) / (selected?.last_price || 1)).toFixed(2)} {t('股')} = ${marginUsd.toFixed(2)} × {leverage}x ÷ ${selected.last_price.toFixed(2)}
          </Text>
        )}
      </div>

      <div className='mb-4'>
        <Text strong className='block mb-2'>{t('当前持仓')}</Text>
        <Table
          columns={openColumns}
          dataSource={openPositions}
          pagination={false}
          size='small'
          empty={<Text type='secondary'>{t('暂无持仓')}</Text>}
        />
      </div>

      <div>
        <Text strong className='block mb-2'>{t('历史平仓')}</Text>
        <Table
          columns={historyColumns}
          dataSource={history.slice(0, 20)}
          pagination={false}
          size='small'
          empty={<Text type='secondary'>{t('暂无记录')}</Text>}
        />
      </div>
    </div>
  );
};

export default FuturesTrading;
