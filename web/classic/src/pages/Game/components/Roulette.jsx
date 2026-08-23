import React, { useCallback, useEffect, useState } from 'react';
import { Button, Typography, Space, Tag, Progress } from '@douyinfe/semi-ui';
import { RedeemPanel } from './GameModal';

const { Text } = Typography;

// 仿真恶魔轮盘（Buckshot Roulette 风格）：
// - 已知弹巢里实弹/空包数量（但不知道顺序）
// - 放大镜：查看当前一发是实弹还是空包
// - 啤酒： eject 当前一发（喝掉跳过）
// - 打自己吃空包 = 免费再行动；打对手(AI)造成伤害
// - 实弹伤害 1，HP 先归零者输
const Roulette = ({ t }) => {
  const [chamber, setChamber] = useState([]); // boolean: 实弹 true
  const [known, setKnown] = useState(null); // 放大镜得知的当前发
  const [hp, setHp] = useState(3);
  const [aiHp, setAiHp] = useState(3);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [lastResult, setLastResult] = useState(null);
  const [turn, setTurn] = useState('player');
  const [magnifiers, setMagnifiers] = useState(2);
  const [beers, setBeers] = useState(2);
  const [busy, setBusy] = useState(false);
  const [gameOver, setGameOver] = useState(null); // 'win' | 'lose'
  const [combo, setCombo] = useState(0);

  const loadRound = useCallback((r) => {
    const total = 6;
    let live = Math.min(2 + Math.floor(r / 2), 4);
    const shells = Array(total)
      .fill(false)
      .map((_, i) => i < live);
    for (let i = shells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shells[i], shells[j]] = [shells[j], shells[i]];
    }
    setChamber(shells);
    setKnown(null);
    setMagnifiers((m) => m + 1);
    setBeers((b) => b + 1);
    setLastResult(null);
  }, []);

  useEffect(() => {
    loadRound(round);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const liveCount = chamber.filter(Boolean).length;
  const blankCount = chamber.length - liveCount;

  const nextRoundOrEnd = (myHp, enemyHp) => {
    if (enemyHp <= 0) {
      setGameOver('win');
      setScore((s) => s + 2000);
      return true;
    }
    if (myHp <= 0) {
      setGameOver('lose');
      return true;
    }
    if (chamber.length === 0) {
      setTimeout(() => setRound((r) => r + 1), 1000);
    }
    return false;
  };

  // 玩家开枪
  const fire = (target) => {
    if (busy || chamber.length === 0 || gameOver) return;
    setBusy(true);
    const isLive = chamber[0];
    setTimeout(() => {
      const rest = chamber.slice(1);
      setChamber(rest);
      setKnown(null);
      if (isLive) {
        setLastResult('live');
        if (target === 'self') {
          const nhp = hp - 1;
          setHp(nhp);
          setCombo(0);
          if (nextRoundOrEnd(nhp, aiHp)) {
            setBusy(false);
            return;
          }
          setTurn('ai');
        } else {
          const nAiHp = aiHp - 1;
          setAiHp(nAiHp);
          setCombo((c) => c + 1);
          setScore((s) => s + 300 + combo * 100);
          if (nextRoundOrEnd(hp, nAiHp)) {
            setBusy(false);
            return;
          }
          setTurn('ai');
        }
      } else {
        setLastResult('blank');
        if (target === 'self') {
          setScore((s) => s + 50); // 空包打自己 = 免费行动奖励
          setTurn('player');
        } else {
          setTurn('ai');
        }
        if (rest.length === 0) setTimeout(() => setRound((r) => r + 1), 1000);
      }
      setBusy(false);
    }, 700);
  };

  // 放大镜
  const useMagnifier = () => {
    if (magnifiers <= 0 || chamber.length === 0 || busy) return;
    setMagnifiers((m) => m - 1);
    setKnown(chamber[0]);
  };

  // 啤酒：弹出当前一发
  const useBeer = () => {
    if (beers <= 0 || chamber.length === 0 || busy) return;
    setBeers((b) => b - 1);
    const ejected = chamber[0];
    const rest = chamber.slice(1);
    setChamber(rest);
    setKnown(null);
    setLastResult(ejected ? 'eject_live' : 'eject_blank');
    setScore((s) => s + 30);
    if (rest.length === 0) setTimeout(() => setRound((r) => r + 1), 1000);
  };

  // AI 回合：简单策略——若空包多且不知情则赌自己，实弹概率高则打玩家
  useEffect(() => {
    if (turn !== 'ai' || gameOver || busy) return;
    const timer = setTimeout(() => {
      const isLive = chamber[0];
      const liveRatio = liveCount / chamber.length;
      const target = liveRatio > 0.5 ? 'player' : isLive ? 'player' : 'self';
      // AI 简单决策：实弹占比过半直接打玩家
      const rest = chamber.slice(1);
      setChamber(rest);
      if (isLive) {
        setLastResult('ai_live');
        if (target === 'self') {
          const nhp = hp - 0; // AI 打自己（失误）
          // AI 打自己实弹扣 AI 血
          setAiHp((h) => h - 1);
          if (aiHp - 1 <= 0) {
            setGameOver('win');
            setScore((s) => s + 2000);
            return;
          }
        } else {
          const nhp = hp - 1;
          setHp(nhp);
          if (nhp <= 0) {
            setGameOver('lose');
            return;
          }
        }
        setTurn('player');
      } else {
        setLastResult('ai_blank');
        if (target === 'self') {
          // 空包打自己保留行动权，AI 继续抽下一发。
          setTurn('ai');
        } else {
          setTurn('player');
        }
      }
      if (rest.length === 0) setTimeout(() => setRound((r) => r + 1), 1000);
    }, 1100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, busy, gameOver]);

  const restart = () => {
    setHp(3);
    setAiHp(3);
    setScore(0);
    setRound(1);
    setTurn('player');
    setGameOver(null);
    setCombo(0);
    setMagnifiers(2);
    setBeers(2);
    setChamber([]);
    loadRound(1);
  };

  const statusText = () => {
    if (gameOver === 'win') return t('🎉 AI 倒下了！你赢了！');
    if (gameOver === 'lose') return t('💀 你倒下了……');
    if (busy) return t('……');
    switch (lastResult) {
      case 'live': return t('💥 实弹！你被打中！');
      case 'blank': return t('💨 空包弹，虚惊一场，你继续行动');
      case 'eject_live': return t('🍺 弹出一发实弹！');
      case 'eject_blank': return t('🍺 弹出一发空包');
      case 'ai_live': return t('💥 AI 开枪命中！');
      case 'ai_blank': return t('💨 AI 打出空包弹');
      default: return turn === 'player' ? t('你的回合') : t('AI 回合……');
    }
  };

  return (
    <div>
      <div className='flex items-center justify-between mb-2 flex-wrap gap-2'>
        <Space>
          <Tag color='red'>{t('你的生命')}</Tag>
          <Tag color='orange'>{t('AI 生命')}</Tag>
          <Tag color='grey'>{t('第 {{r}} 轮', { r: round })}</Tag>
        </Space>
        <Button size='small' onClick={restart}>{t('重新开始')}</Button>
      </div>

      {/* 生命条 */}
      <div className='grid grid-cols-2 gap-4 mb-3'>
        <div>
          <Text type='secondary' size='small'>{t('你')}</Text>
          <Progress percent={(hp / 3) * 100} stroke='#22c55e' showInfo={false} />
        </div>
        <div>
          <Text type='secondary' size='small'>{t('AI')}</Text>
          <Progress percent={(aiHp / 3) * 100} stroke='#ef4444' showInfo={false} />
        </div>
      </div>

      <div
        className='rounded-xl flex flex-col items-center justify-center py-8'
        style={{ background: 'linear-gradient(160deg,#1c1917,#292524)' }}
      >
        <div style={{ fontSize: 60 }}>
          {busy ? '🎯' : lastResult === 'live' || lastResult === 'ai_live' ? '💥' : lastResult === 'blank' || lastResult === 'ai_blank' ? '💨' : '🔫'}
        </div>
        <Text style={{ color: '#e7e5e4' }} strong className='mt-2'>
          {statusText()}
        </Text>
        {known !== null && !busy && (
          <Tag color={known ? 'red' : 'blue'} className='mt-2'>
            {t('放大镜：当前是')} {known ? t('实弹') : t('空包')}
          </Tag>
        )}
        <Space className='mt-3'>
          <Tag color='red'>{t('实弹')} × {liveCount}</Tag>
          <Tag color='blue'>{t('空包')} × {blankCount}</Tag>
          <Tag color='grey'>{t('剩余')} {chamber.length}/6</Tag>
        </Space>
        {combo > 0 && <Tag color='orange' className='mt-2'>{t('连击')} ×{combo}</Tag>}
      </div>

      {/* 操作 */}
      {!gameOver && (
        <div className='flex gap-2 mt-3 flex-wrap'>
          <Button
            theme='solid' type='danger' size='large'
            disabled={busy || turn !== 'player' || chamber.length === 0}
            onClick={() => fire('self')}
          >
            {t('对自己开枪')} {t('(空包=再行动)')}
          </Button>
          <Button
            theme='solid' type='warning' size='large'
            disabled={busy || turn !== 'player' || chamber.length === 0}
            onClick={() => fire('ai')}
          >
            {t('射击 AI')}
          </Button>
          <Button
            disabled={magnifiers <= 0 || turn !== 'player' || busy || chamber.length === 0}
            onClick={useMagnifier}
          >
            🔍 {t('放大镜')} ×{magnifiers}
          </Button>
          <Button
            disabled={beers <= 0 || turn !== 'player' || busy || chamber.length === 0}
            onClick={useBeer}
          >
            🍺 {t('啤酒')} ×{beers}
          </Button>
        </div>
      )}

      <Text type='secondary' className='block mt-2'>
        {t('弹巢随机装填实弹与空包（数量已知顺序未知）。空包打自己=免费再行动；实弹伤害 1 点，3 血先归零者输。放大镜看当前发，啤酒弹出当前发。命中 AI +300 起连击加成，获胜 +2000。')}
      </Text>
      <RedeemPanel gameKey='roulette' score={score} onRedeemed={() => setScore(0)} t={t} />
    </div>
  );
};

export default Roulette;
