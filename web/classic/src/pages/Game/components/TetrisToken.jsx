import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Typography, Tag, Space } from '@douyinfe/semi-ui';
import { RedeemPanel } from './GameModal';

const { Text } = Typography;
const COLS = 10;
const ROWS = 20;

// 仿真俄罗斯方块：SRS 踢墙简化版、7-bag 随机、幽灵落点、硬降、Next 预览、等级加速、消行计分
const SHAPES = {
  I: { cells: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: '#22d3ee' },
  O: { cells: [[1, 1], [1, 1]], color: '#facc15' },
  T: { cells: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: '#c084fc' },
  S: { cells: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: '#4ade80' },
  Z: { cells: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: '#f87171' },
  J: { cells: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: '#60a5fa' },
  L: { cells: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: '#fb923c' },
};

// 7-bag：每 7 个一组洗牌，保证分布均匀
const makeBag = () => {
  const bag = Object.keys(SHAPES);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
};

const TetrisToken = ({ t }) => {
  const [board, setBoard] = useState(() =>
    Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
  );
  const [piece, setPiece] = useState(null);
  const [nextQueue, setNextQueue] = useState([]);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);

  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  const queueRef = useRef([]);
  boardRef.current = board;
  pieceRef.current = piece;

  const takeNext = useCallback(() => {
    if (queueRef.current.length < 2) {
      queueRef.current.push(...makeBag());
    }
    const key = queueRef.current.shift();
    setNextQueue(queueRef.current.slice(0, 3));
    return {
      key,
      cells: SHAPES[key].cells.map((r) => [...r]),
      x: Math.floor((COLS - SHAPES[key].cells[0].length) / 2),
      y: 0,
    };
  }, []);

  const collides = useCallback((b, p, dx = 0, dy = 0, cells = null) => {
    const cs = cells || p.cells;
    for (let r = 0; r < cs.length; r++)
      for (let c = 0; c < cs[r].length; c++) {
        if (!cs[r][c]) continue;
        const nx = p.x + c + dx;
        const ny = p.y + r + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && b[ny][nx]) return true;
      }
    return false;
  }, []);

  const ghostY = useCallback((b, p) => {
    let dy = 0;
    while (!collides(b, p, 0, dy + 1)) dy++;
    return p.y + dy;
  }, [collides]);

  const lockPiece = useCallback((b, p) => {
    const newBoard = b.map((row) => [...row]);
    p.cells.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v && p.y + r >= 0) newBoard[p.y + r][p.x + c] = SHAPES[p.key].color;
      }),
    );
    // 消行
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (newBoard[r].every((v) => v)) {
        newBoard.splice(r, 1);
        newBoard.unshift(Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    if (cleared > 0) {
      const levelFactor = [0, 100, 300, 500, 800][cleared] * level;
      setScore((s) => s + levelFactor);
      setLines((l) => {
        const nl = l + cleared;
        const newLevel = Math.floor(nl / 10) + 1;
        if (newLevel !== level) setLevel(newLevel);
        return nl;
      });
    }
    const next = takeNext();
    if (collides(newBoard, next)) {
      setBoard(newBoard);
      setOver(true);
      setRunning(false);
      return;
    }
    setBoard(newBoard);
    setPiece(next);
  }, [collides, level, takeNext]);

  const step = useCallback(() => {
    const b = boardRef.current;
    const p = pieceRef.current;
    if (!p) return;
    if (!collides(b, p, 0, 1)) {
      setPiece({ ...p, y: p.y + 1 });
    } else {
      lockPiece(b, p);
    }
  }, [collides, lockPiece]);

  const dropInterval = Math.max(80, 600 - (level - 1) * 55);

  useEffect(() => {
    if (!running || !piece) return;
    const timer = setInterval(step, dropInterval);
    return () => clearInterval(timer);
  }, [running, piece, dropInterval, step]);

  const rotate = useCallback(() => {
    const b = boardRef.current;
    const p = pieceRef.current;
    if (!p) return;
    // 顺时针旋转矩阵
    const rotated = p.cells[0].map((_, c) => p.cells.map((row) => row[c]).reverse());
    // 简化踢墙：右移/左移最多 2 格
    const kicks = [0, 1, -1, 2, -2];
    for (const k of kicks) {
      if (!collides(b, p, k, 0, rotated)) {
        setPiece({ ...p, cells: rotated, x: p.x + k });
        return;
      }
    }
  }, [collides]);

  const hardDrop = useCallback(() => {
    const b = boardRef.current;
    const p = pieceRef.current;
    if (!p) return;
    const gy = ghostY(b, p);
    const dropDist = gy - p.y;
    setScore((s) => s + dropDist * 2); // 硬降奖励
    lockPiece(b, { ...p, y: gy });
  }, [ghostY, lockPiece]);

  useEffect(() => {
    const onKey = (e) => {
      if (!running) return;
      const b = boardRef.current;
      const p = pieceRef.current;
      if (!p) return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (!collides(b, p, -1, 0)) setPiece({ ...p, x: p.x - 1 });
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (!collides(b, p, 1, 0)) setPiece({ ...p, x: p.x + 1 });
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!collides(b, p, 0, 1)) {
            setPiece({ ...p, y: p.y + 1 });
            setScore((s) => s + 1); // 软降加分
          }
          break;
        case 'ArrowUp':
        case 'w':
          e.preventDefault();
          rotate();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, collides, rotate, hardDrop]);

  const start = () => {
    queueRef.current = makeBag();
    setBoard(Array.from({ length: ROWS }, () => Array(COLS).fill(null)));
    setScore(0);
    setLines(0);
    setLevel(1);
    setOver(false);
    setPiece(takeNext());
    setRunning(true);
  };

  // 渲染棋盘（含幽灵）
  const display = board.map((row) => [...row]);
  let ghostCells = [];
  if (piece && running) {
    const gy = ghostY(board, piece);
    piece.cells.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v && gy + r >= 0) ghostCells.push([gy + r, piece.x + c]);
      }),
    );
  }
  if (piece) {
    piece.cells.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v && piece.y + r >= 0 && piece.y + r < ROWS && piece.x + c >= 0 && piece.x + c < COLS) {
          display[piece.y + r][piece.x + c] = SHAPES[piece.key].color;
        }
      }),
    );
  }
  const ghostSet = new Set(ghostCells.map(([r, c]) => `${r},${c}`));

  const nextPiece = nextQueue[0];

  return (
    <div>
      <div className='flex items-center justify-between mb-2 flex-wrap gap-2'>
        <Space>
          <Tag color='green'>{t('得分')}: {score}</Tag>
          <Tag color='blue'>{t('行数')}: {lines}</Tag>
          <Tag color='violet'>Lv.{level}</Tag>
        </Space>
        <Button size='small' onClick={start}>{over || !running ? t('开始') : t('重新开始')}</Button>
      </div>

      <div className='flex gap-4 items-start justify-center'>
        <div
          className='grid gap-px rounded p-1'
          style={{ gridTemplateColumns: `repeat(${COLS}, 22px)`, background: '#111827' }}
        >
          {display.map((row, r) =>
            row.map((color, c) => {
              const isGhost = ghostSet.has(`${r},${c}`) && !color;
              return (
                <div
                  key={`${r}-${c}`}
                  style={{
                    width: 22, height: 22,
                    background: color || (isGhost ? '#ffffff22' : '#1f2937'),
                    borderRadius: color ? 3 : 1,
                    border: isGhost ? '1px dashed #ffffff55' : 'none',
                    boxSizing: 'border-box',
                  }}
                />
              );
            }),
          )}
        </div>

        {/* Next 预览 */}
        <div className='rounded-lg p-3' style={{ background: 'var(--semi-color-fill-0)' }}>
          <Text strong className='block mb-2'>{t('下一个')}</Text>
          {nextPiece ? (
            <div
              className='grid gap-px'
              style={{
                gridTemplateColumns: `repeat(${SHAPES[nextPiece].cells[0].length}, 16px)`,
              }}
            >
              {SHAPES[nextPiece].cells.flat().map((v, i) => (
                <div
                  key={i}
                  style={{
                    width: 16, height: 16,
                    background: v ? SHAPES[nextPiece].color : 'transparent',
                    borderRadius: 2,
                  }}
                />
              ))}
            </div>
          ) : (
            <Text type='secondary'>—</Text>
          )}
          <Text type='secondary' size='small' className='block mt-3'>
            {t('←→ 移动 · ↑ 旋转')}
          </Text>
          <Text type='secondary' size='small'>
            {t('↓ 软降 · 空格硬降')}
          </Text>
        </div>
      </div>

      <Text type='secondary' className='block mt-2 text-center'>
        {t('消行 × 等级：1行100×L / 2行300×L / 3行500×L / 4行800×L，每 10 行升一级加速。')}
      </Text>
      {over && <Text type='danger' strong className='block mt-1 text-center'>{t('游戏结束！')}{t('最终得分')} {score}</Text>}
      <RedeemPanel gameKey='tetris' score={score} onRedeemed={() => setScore(0)} t={t} />
    </div>
  );
};

export default TetrisToken;
