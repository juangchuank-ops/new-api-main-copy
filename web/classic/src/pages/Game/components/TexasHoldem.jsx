import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Typography, Space, Tag, Progress } from '@douyinfe/semi-ui';
import { RedeemPanel } from './GameModal';

const { Text } = Typography;

// ===================== 完整德州扑克 head-to-head（1v1 vs AI）=====================
// 仿真要素：
// - 盲注结构（小盲/大盲，每 6 手翻倍）
// - 四条街：preflop / flop / turn / river，每条街独立下注轮
// - AI 用蒙特卡洛模拟评估手牌胜率，按胜率+底池赔率决策（弃/跟/加/全下）
// - 7 张牌最佳 5 张评估（含 A-5 低顺）
// - 庄家按钮轮转、摊牌展示、筹码不足自动 all-in 边池简化

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

const freshDeck = () => {
  const d = [];
  for (const s of SUITS) for (let i = 0; i < 13; i++) d.push({ suit: s, rank: RANKS[i], v: i + 2 });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
};

const cardText = (c) => (c ? `${c.rank}${c.suit}` : '');
const cardKey = (c) => `${c.rank}:${c.suit}`;

// ---- 手牌评估：7 张选最佳 5 张，返回可比较的分数数组 ----
const C5 = (() => {
  const combos = [];
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 4; b++)
      for (let c = b + 1; c < 5; c++)
        for (let d = c + 1; d < 6; d++)
          for (let e = d + 1; e < 7; e++)
            combos.push([a, b, c, d, e]);
  return combos;
})();

function evalFive(cards) {
  const vs = cards.map((c) => c.v).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const flush = suits.every((s) => s === suits[0]);
  const uniq = [...new Set(vs)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5; // wheel
  }
  const count = {};
  vs.forEach((v) => (count[v] = (count[v] || 0) + 1));
  const groups = Object.entries(count)
    .map(([v, n]) => ({ v: +v, n }))
    .sort((a, b) => b.n - a.n || b.v - a.v);

  if (flush && straightHigh) return [8, straightHigh];
  if (groups[0].n === 4) return [7, groups[0].v, groups[1].v];
  if (groups[0].n === 3 && groups[1].n === 2) return [6, groups[0].v, groups[1].v];
  if (flush) return [5, ...vs];
  if (straightHigh) return [4, straightHigh];
  if (groups[0].n === 3) return [3, groups[0].v, groups[1].v, groups[2].v];
  if (groups[0].n === 2 && groups[1].n === 2)
    return [2, groups[0].v, groups[1].v, groups[2].v];
  if (groups[0].n === 2) return [1, groups[0].v, groups[1].v, groups[2].v, groups[3].v];
  return [0, ...vs];
}

function evalBest7(cards7) {
  let best = null;
  for (const combo of C5) {
    const score = evalFive(combo.map((i) => cards7[i]));
    if (!best || cmpScore(score, best) > 0) best = score;
  }
  return best;
}

function cmpScore(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

const HAND_NAMES = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺'];

// 蒙特卡洛胜率：myCards vs oppRandom，模拟 N 次
function monteCarloWinRate(hole, board, sims = 220) {
  if (board.length >= 5) {
    const mine = evalBest7([...hole, ...board]);
    // 直接对随机对手
    let wins = 0;
    for (let i = 0; i < sims; i++) {
      const known = new Set([...hole, ...board].map(cardKey));
      const deck = freshDeck().filter((c) => !known.has(cardKey(c)));
      const oppHole = [deck.pop(), deck.pop()];
      const rest = board.slice();
      while (rest.length < 5) rest.push(deck.pop());
      const opp = evalBest7([...oppHole, ...rest]);
      const myFinal = evalBest7([...hole, ...rest]);
      if (cmpScore(myFinal, opp) > 0) wins++;
      else if (cmpScore(myFinal, opp) === 0) wins += 0.5;
    }
    return wins / sims;
  }
  let wins = 0;
  for (let i = 0; i < sims; i++) {
    const deck = freshDeck().filter(
      (c) => !hole.includes(c) && !board.includes(c),
    );
    const oppHole = [deck.pop(), deck.pop()];
    const rest = board.slice();
    while (rest.length < 5) rest.push(deck.pop());
    const mine = evalBest7([...hole, ...rest]);
    const opp = evalBest7([...oppHole, ...rest]);
    if (cmpScore(mine, opp) > 0) wins++;
    else if (cmpScore(mine, opp) === 0) wins += 0.5;
  }
  return wins / sims;
}

// 游戏状态机
const STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown'];

const TexasHoldem = ({ t }) => {
  const [game, setGame] = useState(null); // 整局状态
  const [message, setMessage] = useState('');
  const [aiThinking, setAiThinking] = useState(false);
  const [handOver, setHandOver] = useState(false);
  const [handResult, setHandResult] = useState(null);
  const [cumScore, setCumScore] = useState(0);
  const [handsPlayed, setHandsPlayed] = useState(0);
  const [betInput, setBetInput] = useState(0);
  const [log, setLog] = useState([]);
  const deckRef = useRef([]);

  const bigBlind = useMemo(() => 10 * Math.pow(2, Math.floor(handsPlayed / 6)), [handsPlayed]);

  const addLog = (line) => setLog((l) => [line, ...l].slice(0, 8));

  const newHand = useCallback(() => {
    const deck = freshDeck();
    deckRef.current = deck;
    const playerButton = game ? !game.buttonIsPlayer : true; // 轮转庄家
    const pCards = [deck.pop(), deck.pop()];
    const aCards = [deck.pop(), deck.pop()];
    const g = {
      board: [], pot: 0, playerCards: pCards, aiCards: aCards,
      playerChips: game ? game.playerChips : 1000,
      aiChips: game ? game.aiChips : 1000,
      playerBet: 0, aiBet: 0, playerTotal: 0, aiTotal: 0,
      street: 'preflop', buttonIsPlayer: playerButton, toAct: 'player', allIn: false,
    };
    // 单挑规则：按钮位是小盲且翻牌前先行动
    if (playerButton) {
      g.playerChips -= bigBlind / 2; g.playerBet = bigBlind / 2; g.playerTotal = bigBlind / 2;
      g.aiChips -= bigBlind; g.aiBet = bigBlind; g.aiTotal = bigBlind;
    } else {
      g.aiChips -= bigBlind / 2; g.aiBet = bigBlind / 2; g.aiTotal = bigBlind / 2;
      g.playerChips -= bigBlind; g.playerBet = bigBlind; g.playerTotal = bigBlind;
    }
    g.pot = bigBlind * 1.5;
    setGame(g);
    setHandOver(false);
    setHandResult(null);
    setBetInput(bigBlind * 2);
    setMessage(t('盲注 {{bb}}，你的回合', { bb: bigBlind }));
    addLog(`--- ${t('第 {{n}} 手', { n: handsPlayed + 1 })} · BB ${bigBlind} ---`);
    setHandsPlayed((h) => h + 1);
  }, [game, bigBlind, handsPlayed, t]);

  // AI 决策：蒙特卡洛 + 底池赔率
  const aiDecide = useCallback((g) => {
    const winRate = monteCarloWinRate(g.aiCards, g.board, 160);
    const toCall = g.playerBet - g.aiBet;
    const potOdds = toCall > 0 ? toCall / (g.pot + toCall) : 0;
    const aggression = 0.55 + Math.random() * 0.25; // AI 性格波动
    const r = Math.random();

    if (toCall <= 0) {
      // 可以过牌
      if (winRate > 0.62 && r < aggression) {
        const raiseSize = Math.max(bigBlind, Math.round(g.pot * (0.5 + Math.random() * 0.5)));
        return { action: 'raise', amount: Math.min(raiseSize, g.aiChips) };
      }
      return { action: 'check' };
    }
    // 面对下注
    if (winRate > potOdds + 0.22 && r < 0.25 && g.aiChips > toCall * 2.5) {
      const raiseSize = Math.max(toCall * 2, Math.round(g.pot * 0.6));
      return { action: 'raise', amount: Math.min(toCall + raiseSize, g.aiChips) };
    }
    if (winRate > potOdds + 0.02) return { action: 'call' };
    if (winRate > potOdds - 0.06 && r < 0.3) return { action: 'call' }; // 偶尔浮跟
    return { action: 'fold' };
  }, [bigBlind]);

  // 街推进
  const advanceStreet = useCallback((g) => {
    const streets = ['preflop', 'flop', 'turn', 'river'];
    const idx = streets.indexOf(g.street);
    if (idx === streets.length - 1) {
      // 摊牌
      finishShowdown(g);
      return;
    }
    const next = { ...g, street: streets[idx + 1], playerBet: 0, aiBet: 0, toAct: g.buttonIsPlayer ? 'player' : 'ai' };
    if (next.street === 'flop') next.board = [deckRef.current.pop(), deckRef.current.pop(), deckRef.current.pop()];
    else next.board = [...g.board, deckRef.current.pop()];
    setGame(next);
    setBetInput(bigBlind);
    if (next.toAct === 'player') {
      setMessage(t('翻牌阶段结束，你的回合'));
    } else {
      setMessage(t('AI 行动中…'));
      setAiThinking(true);
      setTimeout(() => runAiTurn(next), 900);
    }
  }, [bigBlind, t]);

  const finishShowdown = (g) => {
    const playerScore = evalBest7([...g.playerCards, ...g.board]);
    const aiScore = evalBest7([...g.aiCards, ...g.board]);
    const cmp = cmpScore(playerScore, aiScore);
    const result = {
      playerHandName: HAND_NAMES[playerScore[0]],
      aiHandName: HAND_NAMES[aiScore[0]],
      outcome: cmp > 0 ? 'win' : cmp < 0 ? 'lose' : 'tie',
      pot: g.pot,
    };
    if (cmp > 0) {
      g = { ...g, playerChips: g.playerChips + g.pot };
      addLog(t('摊牌胜利：{{hand}} 赢得 {{pot}}', { hand: result.playerHandName, pot: g.pot }));
      setCumScore((s) => s + Math.floor(g.pot / 2));
    } else if (cmp < 0) {
      g = { ...g, aiChips: g.aiChips + g.pot };
      addLog(t('摊牌失败：AI 以 {{hand}} 获胜', { hand: result.aiHandName }));
    } else {
      g = {
        ...g,
        playerChips: g.playerChips + Math.floor(g.pot / 2),
        aiChips: g.aiChips + Math.floor(g.pot / 2),
      };
      addLog(t('平分底池'));
    }
    g = { ...g, pot: 0, street: 'showdown' };
    setGame(g);
    setHandResult(result);
    setHandOver(true);
    setMessage(
      cmp > 0 ? t('🎉 你赢得底池 {{pot}}！', { pot: result.pot })
        : cmp < 0 ? t('AI 赢得底池 {{pot}}', { pot: result.pot })
        : t('平局，平分底池'),
    );
  };

  const awardPot = (g, winner) => {
    if (winner === 'player') {
      const next = { ...g, playerChips: g.playerChips + g.pot, pot: 0, street: 'showdown' };
      addLog(t('AI 弃牌，你赢得 {{pot}}', { pot: g.pot }));
      setCumScore((s) => s + Math.floor(g.pot / 2));
      setGame(next);
      setHandResult({ outcome: 'win', pot: g.pot, playerHandName: '', aiHandName: '' });
      setMessage(t('AI 弃牌，你赢得底池 {{pot}}！', { pot: g.pot }));
    } else {
      const next = { ...g, aiChips: g.aiChips + g.pot, pot: 0, street: 'showdown' };
      addLog(t('你弃牌，AI 赢得 {{pot}}', { pot: g.pot }));
      setGame(next);
      setHandResult({ outcome: 'lose', pot: g.pot, playerHandName: '', aiHandName: '' });
      setMessage(t('你弃牌，AI 赢得底池 {{pot}}', { pot: g.pot }));
    }
    setHandOver(true);
  };

  const runAiTurn = useCallback((gState) => {
    const decision = aiDecide(gState);
    setAiThinking(false);
    if (decision.action === 'fold') {
      awardPot(gState, 'player');
      return;
    }
    let g = { ...gState };
    if (decision.action === 'check') {
      addLog(t('AI 过牌'));
      // 双方过牌 → 推进街
      if (g.playerBet === g.aiBet) {
        advanceStreet(g);
      } else {
        g.toAct = 'player';
        setGame(g);
        setMessage(t('你的回合'));
      }
      return;
    }
    if (decision.action === 'call') {
      const toCall = g.playerBet - g.aiBet;
      const pay = Math.min(toCall, g.aiChips);
      g.aiChips -= pay; g.aiBet += pay; g.aiTotal += pay; g.pot += pay;
      addLog(t('AI 跟注 {{n}}', { n: pay }));
      if (g.aiChips === 0 || g.playerBet === g.aiBet) {
        if (g.playerChips === 0 || g.aiChips === 0) {
          // all-in 直接连发到河牌摊牌
          dealToRiver(g);
          return;
        }
        advanceStreet(g);
      } else {
        g.toAct = 'player';
        setGame(g);
        setMessage(t('你的回合'));
      }
      return;
    }
    // raise
    const pay = Math.min(decision.amount, g.aiChips);
    g.aiChips -= pay; g.aiBet += pay; g.aiTotal += pay; g.pot += pay;
    addLog(t('AI 加注到 {{n}}', { n: g.aiBet }));
    g.toAct = 'player';
    setGame(g);
    setMessage(t('AI 加注到 {{n}}，你的回合', { n: g.aiBet }));
  }, [aiDecide, advanceStreet, t]);

  const dealToRiver = (g) => {
    // 双方 all-in：自动发完公共牌摊牌
    let next = { ...g };
    while (next.board.length < 5) {
      next.board = [...next.board, deckRef.current.pop()];
    }
    setMessage(t('双方全下，直接摊牌…'));
    setGame(next);
    setTimeout(() => finishShowdown(next), 1200);
  };

  // 玩家行动
  const playerAct = (action) => {
    if (!game || game.toAct !== 'player' || handOver) return;
    let g = { ...game };
    if (action === 'fold') {
      awardPot(g, 'ai');
      return;
    }
    if (action === 'check') {
      const toCall = g.aiBet - g.playerBet;
      if (toCall <= 0) {
        addLog(t('你过牌'));
        if (g.playerBet === g.aiBet) {
          if (g.playerChips === 0 || g.aiChips === 0) {
            dealToRiver(g);
            return;
          }
          advanceStreet(g);
        } else {
          g.toAct = 'ai';
          setGame(g);
          setAiThinking(true);
          setMessage(t('AI 行动中…'));
          setTimeout(() => runAiTurn(g), 900);
        }
      }
      return;
    }
    if (action === 'call') {
      const toCall = g.aiBet - g.playerBet;
      const pay = Math.min(toCall, g.playerChips);
      if (pay <= 0) return;
      g.playerChips -= pay; g.playerBet += pay; g.playerTotal += pay; g.pot += pay;
      addLog(t('你跟注 {{n}}', { n: pay }));
      if (g.playerChips === 0 || g.aiChips === 0) {
        dealToRiver(g);
        return;
      }
      if (g.playerBet === g.aiBet) {
        advanceStreet(g);
      } else {
        g.toAct = 'ai';
        setGame(g);
        setAiThinking(true);
        setMessage(t('AI 行动中…'));
        setTimeout(() => runAiTurn(g), 900);
      }
      return;
    }
    if (action === 'raise') {
      const raiseTo = Math.min(betInput, g.playerChips + g.playerBet);
      const pay = raiseTo - g.playerBet;
      if (pay <= 0) return;
      g.playerChips -= pay; g.playerBet = raiseTo; g.playerTotal += pay; g.pot += pay;
      addLog(t('你加注到 {{n}}', { n: raiseTo }));
      g.toAct = 'ai';
      setGame(g);
      setAiThinking(true);
      setMessage(t('AI 行动中…'));
      setTimeout(() => runAiTurn(g), 900);
      return;
    }
    if (action === 'allin') {
      const pay = g.playerChips;
      g.playerChips = 0; g.playerBet += pay; g.playerTotal += pay; g.pot += pay;
      addLog(t('你全下 {{n}}！', { n: pay }));
      g.toAct = 'ai';
      setGame(g);
      setAiThinking(true);
      setMessage(t('AI 思考是否跟注全下…'));
      setTimeout(() => {
        const d = aiDecide(g);
        setAiThinking(false);
        if (d.action === 'fold') {
          awardPot(g, 'player');
        } else {
          const toCall = g.playerBet - g.aiBet;
          const pay2 = Math.min(toCall, g.aiChips);
          let g2 = { ...g };
          g2.aiChips -= pay2; g2.aiBet += pay2; g2.aiTotal += pay2; g2.pot += pay2;
          addLog(t('AI 跟注全下 {{n}}！', { n: pay2 }));
          setGame(g2);
          setTimeout(() => dealToRiver(g2), 700);
        }
      }, 1400);
      return;
    }
  };

  const toCall = game ? game.aiBet - game.playerBet : 0;
  const canCheck = toCall <= 0;
  const minRaise = game ? game.aiBet + bigBlind : bigBlind;
  const winRateDisplay = useMemo(() => {
    if (!game || !game.playerCards.length || handOver) return null;
    return monteCarloWinRate(game.playerCards, game.board, 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.playerCards, game?.board, handOver]);

  if (!game) {
    return (
      <div>
        <div className='rounded-xl p-8 text-center' style={{ background: '#07402e' }}>
          <Text style={{ color: '#fbbf24' }} strong style={{ fontSize: 22 }}>
            🃏 {t('德州扑克 · 单挑桌')}
          </Text>
          <Text style={{ color: '#d1fae5' }} className='block mt-2'>
            {t('起始各 1000 筹码，每 6 手盲注翻倍。AI 基于蒙特卡洛胜率实时决策。')}
          </Text>
          <Button theme='solid' type='warning' size='large' className='mt-4' onClick={newHand}>
            {t('坐上牌桌')}
          </Button>
        </div>
        <RedeemPanel gameKey='texas' score={cumScore} onRedeemed={() => setCumScore(0)} t={t} />
      </div>
    );
  }

  return (
    <div>
      {/* 牌桌 */}
      <div
        className='rounded-xl p-5 relative'
        style={{ background: 'linear-gradient(160deg, #0d5c3f, #07402e)', border: '6px solid #3f2a1d' }}
      >
        {/* AI 区 */}
        <div className='flex items-center justify-between mb-3'>
          <Space>
            <Tag color='orange'>{t('AI 对手')}</Tag>
            <Text style={{ color: '#fbbf24' }} strong>{t('筹码')}: {game.aiChips}</Text>
            {game.buttonIsPlayer ? null : <Tag size='small' color='yellow'>D</Tag>}
          </Space>
          <Text style={{ color: '#d1fae5' }}>
            {aiThinking ? t('思考中…') : handOver
              ? `${game.aiCards.map(cardText).join(' ')} (${handResult?.aiHandName})`
              : '🂠 🂠'}
          </Text>
        </div>

        {/* 公共牌 + 底池 */}
        <div className='text-center my-5'>
          <div className='flex justify-center gap-2'>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className='flex items-center justify-center rounded font-bold'
                style={{
                  width: 52, height: 72,
                  background: game.board[i] ? '#fff' : '#ffffff22',
                  color: game.board[i]?.suit === '♥' || game.board[i]?.suit === '♦' ? '#dc2626' : '#111',
                  border: '1px solid #ffffff44',
                  fontSize: 20,
                }}
              >
                {game.board[i] ? cardText(game.board[i]) : ''}
              </div>
            ))}
          </div>
          <Text style={{ color: '#fde68a' }} strong className='mt-2 block'>
            {t('底池')}: {game.pot} {game.street !== 'showdown' && `· ${t(STREETS[STREETS.indexOf(game.street)] || '')}`}
          </Text>
        </div>

        {/* 玩家区 */}
        <div className='flex items-center justify-between'>
          <div className='flex gap-2'>
            {game.playerCards.map((c, i) => (
              <div
                key={i}
                className='flex items-center justify-center rounded font-bold'
                style={{
                  width: 52, height: 72, background: '#fff',
                  color: c.suit === '♥' || c.suit === '♦' ? '#dc2626' : '#111',
                  fontSize: 20,
                }}
              >
                {cardText(c)}
              </div>
            ))}
          </div>
          <Space>
            {game.buttonIsPlayer && <Tag size='small' color='yellow'>D</Tag>}
            <Text style={{ color: '#fbbf24' }} strong>{t('你的筹码')}: {game.playerChips}</Text>
          </Space>
        </div>

        {/* 胜率条 */}
        {winRateDisplay !== null && !handOver && (
          <div className='mt-3'>
            <Text style={{ color: '#a7f3d0' }} size='small'>
              {t('你的实时胜率')} ≈ {(winRateDisplay * 100).toFixed(0)}%
            </Text>
            <Progress
              percent={winRateDisplay * 100}
              stroke='#fbbf24'
              showInfo={false}
              style={{ width: 220 }}
            />
          </div>
        )}
      </div>

      {/* 操作区 */}
      <div className='mt-3 flex items-center gap-2 flex-wrap'>
        {handOver ? (
          <Button theme='solid' type='primary' size='large' onClick={newHand}>
            {t('发下一手')}
          </Button>
        ) : game.toAct === 'player' ? (
          <>
            <Button
              size='large'
              onClick={() => playerAct(canCheck ? 'check' : 'fold')}
              type={canCheck ? 'primary' : 'danger'}
            >
              {canCheck ? t('过牌') : `${t('弃牌')}`}
            </Button>
            {!canCheck && (
              <Button size='large' type='primary' onClick={() => playerAct('call')}>
                {t('跟注')} {Math.min(toCall, game.playerChips)}
              </Button>
            )}
            <div className='flex items-center gap-1'>
              <input
                type='range'
                min={minRaise}
                max={game.playerChips + game.playerBet}
                value={Math.min(betInput, game.playerChips + game.playerBet)}
                onChange={(e) => setBetInput(+e.target.value)}
                style={{ width: 140 }}
              />
              <Text strong>{betInput}</Text>
            </div>
            <Button size='large' type='warning' onClick={() => playerAct('raise')}>
              {t('加注到')} {betInput}
            </Button>
            <Button size='large' type='danger' theme='solid' onClick={() => playerAct('allin')}>
              {t('全下')}
            </Button>
          </>
        ) : (
          <Text type='secondary'>{aiThinking ? t('AI 正在计算胜率…') : ''}</Text>
        )}
      </div>

      {message && <Text className='block mt-2' strong>{message}</Text>}

      {/* 牌局日志 */}
      <div className='mt-3 rounded-lg p-2 text-xs' style={{ background: 'var(--semi-color-fill-0)', color: 'var(--semi-color-text-2)' }}>
        {log.map((line, i) => <div key={i}>{line}</div>)}
      </div>

      <Text type='secondary' size='small' className='block mt-2'>
        {t('每赢一池按底池一半记分。盲注每 6 手翻倍，输光筹码即结束。')}
      </Text>
      <RedeemPanel gameKey='texas' score={cumScore} onRedeemed={() => setCumScore(0)} t={t} />
    </div>
  );
};

export default TexasHoldem;
