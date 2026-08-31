import React, { useEffect, useRef, useState } from 'react';
import { Button, Modal, Typography, Progress } from '@douyinfe/semi-ui';
import { RedeemPanel } from './GameModal';
import { API, showError } from '../../../helpers';

const { Text } = Typography;

// TOKEN 挖矿：点击挖矿累积进度，矿脉越深产量越高，但镐子会磨损（冷却）。
// 分数达到 100 万上限时自动强制结算为额度，矿工最多雇佣 350 个。
const TOKEN_MINING_GAME_KEY = 'mining';
const MAX_SESSION_SCORE = 1000000;
const MAX_MINERS = 350;

const TokenMining = ({ t }) => {
  const [depth, setDepth] = useState(0); // 深度（米）
  const [progress, setProgress] = useState(0);
  const [pickDurability, setPickDurability] = useState(100);
  const [score, setScore] = useState(0);
  const [autoMiners, setAutoMiners] = useState(0); // 雇佣矿工
  const [log, setLog] = useState([]);
  const [clicks, setClicks] = useState(0);
  // 强制结算只触发一次；失败时保持闩锁关闭，改用手动兑换
  const forceSettleLatchRef = useRef(false);

  // 每层深度需要更多进度
  const depthNeed = () => 100 + depth * 20;

  const dig = () => {
    if (pickDurability <= 0) {
      setLog((l) => [t('镐子坏了！用 50 分修理'), ...l].slice(0, 5));
      return;
    }
    const gain = 10 + Math.floor(depth / 2) * 2;
    setProgress((p) => {
      const next = p + gain;
      if (next >= depthNeed()) {
        setDepth((d) => d + 1);
        setScore((s) => Math.min(MAX_SESSION_SCORE, s + 100 + depth * 10));
        setLog((l) => [t('挖穿第 {{d}} 层！+{{n}} 分', { d: depth + 1, n: 100 + depth * 10 }), ...l].slice(0, 5));
        return next - depthNeed();
      }
      return next;
    });
    setPickDurability((d) => Math.max(0, d - 2));
    setClicks((c) => c + 1);
    setScore((s) => Math.min(MAX_SESSION_SCORE, s + 5));
  };

  // 自动矿工
  useEffect(() => {
    if (autoMiners <= 0) return;
    const timer = setInterval(() => {
      setProgress((p) => {
        const gain = autoMiners * 6;
        const next = p + gain;
        if (next >= depthNeed()) {
          setDepth((d) => d + 1);
          setScore((s) => Math.min(MAX_SESSION_SCORE, s + 100 + depth * 10));
          return next - depthNeed();
        }
        return next;
      });
      setScore((s) => Math.min(MAX_SESSION_SCORE, s + autoMiners * 2));
    }, 1000);
    return () => clearInterval(timer);
  }, [autoMiners, depth]);

  // 分数达到 100 万上限：强制结算为额度并弹窗提示
  useEffect(() => {
    // 分数降回上限以下（手动兑换/重置）时重新武装强制结算
    if (score < MAX_SESSION_SCORE) {
      forceSettleLatchRef.current = false;
      return;
    }
    if (forceSettleLatchRef.current) return;
    forceSettleLatchRef.current = true;
    let settled = false;
    (async () => {
      try {
        const res = await API.post('/api/user/game/redeem', {
          game_key: TOKEN_MINING_GAME_KEY,
          score: MAX_SESSION_SCORE,
        });
        if (res.data.success) {
          settled = true;
          setScore(0);
          Modal.info({
            title: t('分数达到上限'),
            content: t(
              '分数达到 100 万上限，已强制结算为 {{usd}} 美元额度，可继续挖矿。',
              { usd: res.data.data?.usd?.toFixed(2) ?? '1000.00' },
            ),
          });
        } else {
          // 结算失败（如兑换频率超限）：分数保留在上限，可手动兑换或稍后重试
          showError(res.data.message);
        }
      } catch (e) {
        showError(e.response?.data?.message || e.message);
      } finally {
        // 失败时保持闩锁关闭，避免分数停留在上限时形成重试风暴；
        // score 降回上限以下后 effect 会自动重新武装
        if (settled) {
          forceSettleLatchRef.current = false;
        }
      }
    })();
  }, [score, t]);

  const repair = () => {
    if (score < 50) return;
    setScore((s) => s - 50);
    setPickDurability(100);
    setLog((l) => [t('镐子修好了'), ...l].slice(0, 5));
  };

  const hire = () => {
    if (autoMiners >= MAX_MINERS) return;
    const cost = 200 * (autoMiners + 1);
    if (score < cost) return;
    setScore((s) => s - cost);
    setAutoMiners((m) => m + 1);
    setLog((l) => [t('雇佣了一名矿工（消耗 {{n}} 分）', { n: cost }), ...l].slice(0, 5));
  };

  const reset = () => {
    setDepth(0);
    setProgress(0);
    setPickDurability(100);
    setScore(0);
    setAutoMiners(0);
    setClicks(0);
    setLog([]);
  };

  const minersFull = autoMiners >= MAX_MINERS;

  return (
    <div>
      <div className='flex items-center justify-between mb-2 flex-wrap gap-2'>
        <Text strong>{t('深度')}: {depth}m · {t('得分')}: {score} · {t('矿工')}: {autoMiners}/{MAX_MINERS}</Text>
        <Button size='small' onClick={reset}>{t('重新开始')}</Button>
      </div>

      <div
        className='rounded-lg flex flex-col items-center justify-center py-8 cursor-pointer select-none'
        style={{ background: 'var(--semi-color-fill-0)' }}
        onClick={dig}
      >
        <div style={{ fontSize: 60 }}>⛏️</div>
        <Text strong className='mt-2'>{t('点击挖矿！')}</Text>
        <Text type='secondary' size='small'>
          {t('当前层进度')} {Math.floor(progress)}/{depthNeed()} · {t('共点击')} {clicks} {t('次')}
        </Text>
        <div style={{ width: '80%' }} className='mt-3'>
          <Progress percent={(progress / depthNeed()) * 100} showInfo={false} stroke='#f59e0b' />
        </div>
      </div>

      <div className='mt-3'>
        <Text type='secondary' size='small'>{t('镐子耐久')}</Text>
        <Progress percent={pickDurability} showInfo={false} stroke={pickDurability > 30 ? '#22c55e' : '#ef4444'} />
      </div>

      <div className='flex gap-2 mt-3'>
        <Button onClick={repair} disabled={score < 50 || pickDurability >= 100}>
          {t('修理镐子（50分）')}
        </Button>
        <Button
          theme='solid'
          type='primary'
          onClick={hire}
          disabled={minersFull || score < 200 * (autoMiners + 1)}
        >
          {minersFull
            ? t('矿工已满（{{n}}）', { n: MAX_MINERS })
            : t('雇佣矿工（{{n}}分）', { n: 200 * (autoMiners + 1) })}
        </Button>
      </div>

      {log.length > 0 && (
        <div className='mt-3 text-xs' style={{ color: 'var(--semi-color-text-2)' }}>
          {log.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}

      <Text type='secondary' className='block mt-2'>
        {t('每层产出 100+深度×10 分，每次点击 +5 分。镐子会磨损，矿工自动帮你挖（上限 350 个）。分数达到 100 万将自动强制结算。')}
      </Text>
      <RedeemPanel gameKey='mining' score={score} onRedeemed={() => setScore(0)} t={t} />
    </div>
  );
};

export default TokenMining;
