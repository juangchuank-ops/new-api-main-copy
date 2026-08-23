import React, { useCallback, useRef, useState } from 'react';
import { Button, Typography, Tag, Space } from '@douyinfe/semi-ui';
import { RedeemPanel } from './GameModal';
import { usePhaserGame } from './usePhaserGame';

const { Text } = Typography;

const CW = 8;
const CH = 8;
const CELL = 46;
const GAP = 4;
const SIZE_W = CW * (CELL + GAP) + GAP;
const SIZE_H = CH * (CELL + GAP) + GAP;

const GEM_COLORS = [0xef4444, 0xf59e0b, 0x22c55e, 0x3b82f6, 0xa855f7, 0xec4899];
const GEM_NAMES = ['红宝石', '琥珀', '翡翠', '蓝宝石', '紫水晶', '粉钻'];

// Phaser 引擎版消消乐：交换补间、消除粒子爆裂、重力下落弹跳、连击加成
const Match3 = ({ t }) => {
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(20);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('match3-best') || 0));
  const cmdRef = useRef({ cmd: null });
  const hooks = useRef({
    onScore: (s) => {
      setScore(s);
      setBest((b) => {
        const nb = Math.max(b, s);
        localStorage.setItem('match3-best', String(nb));
        return nb;
      });
    },
    onMoves: (m) => setMoves(m),
    onCombo: (c) => setCombo(c),
    getCommand: () => {
      const c = cmdRef.current.cmd;
      cmdRef.current.cmd = null;
      return c;
    },
  });

  const send = useCallback((cmd) => { cmdRef.current.cmd = cmd; }, []);

  const { containerRef, error, loading } = usePhaserGame({
    width: SIZE_W,
    height: SIZE_H,
    backgroundColor: '#1e1b4b',
    sceneFactory: (Phaser) => {
      class Match3Scene extends Phaser.Scene {
        constructor() { super('match3'); }

        create() {
          this.hooks = hooks.current;
          this.busy = false;
          this._score = 0;
          this.moves = 20;

          // 粒子
          const g = this.make.graphics({ x: 0, y: 0 }, false);
          g.fillStyle(0xffffff, 1);
          g.fillCircle(4, 4, 4);
          g.generateTexture('dot', 8, 8);
          g.destroy();
          this.particles = this.add.particles(0, 0, 'dot', {
            speed: { min: 60, max: 200 },
            lifespan: 550,
            scale: { start: 1, end: 0 },
            gravityY: 300,
            emitting: false,
            quantity: 10,
          });

          // 棋盘背景
          for (let r = 0; r < CH; r++)
            for (let c = 0; c < CW; c++) {
              this.add.rectangle(
                GAP + c * (CELL + GAP) + CELL / 2, GAP + r * (CELL + GAP) + CELL / 2,
                CELL, CELL, 0x312e81, 0.6,
              );
            }

          this.selected = null;
          this.grid = [];
          this.pointerStart = null;
          this.spawnBoard();
          this.input.on('pointerdown', (pointer) => {
            this.pointerStart = { x: pointer.x, y: pointer.y };
          });
          this.input.on('pointerup', (pointer) => {
            if (!this.pointerStart || this.busy || this.moves <= 0) return;
            const start = this.pointerStart;
            this.pointerStart = null;
            const dx = pointer.x - start.x;
            const dy = pointer.y - start.y;
            const startCol = Math.floor((start.x - GAP) / (CELL + GAP));
            const startRow = Math.floor((start.y - GAP) / (CELL + GAP));
            if (startRow < 0 || startRow >= CH || startCol < 0 || startCol >= CW) return;
            const startGem = this.gems[startRow]?.[startCol];
            if (!startGem) return;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * 0.35) {
              this.onGemClick(startGem);
              return;
            }
            const rowDelta = Math.abs(dx) > Math.abs(dy) ? 0 : (dy > 0 ? 1 : -1);
            const colDelta = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : 0;
            const targetRow = startRow + rowDelta;
            const targetCol = startCol + colDelta;
            const targetGem = this.gems[targetRow]?.[targetCol];
            if (targetGem) this.onGemClick(startGem) || this.onGemClick(targetGem);
          });
        }

        pos(r, c) {
          return { x: GAP + c * (CELL + GAP) + CELL / 2, y: GAP + r * (CELL + GAP) + CELL / 2 };
        }

        makeGem(r, c, colorIdx) {
          const { x, y } = this.pos(r, c);
          const gem = this.add.circle(x, y, CELL / 2 - 4, GEM_COLORS[colorIdx]);
          gem.setStrokeStyle(2, 0xffffff33);
          gem.setData({ r, c, colorIdx });
          gem.setInteractive({ useHandCursor: true });
          return gem;
        }

        genNoMatch() {
          // 生成一个无初始匹配的棋盘
          let grid;
          do {
            grid = Array.from({ length: CH }, () =>
              Array.from({ length: CW }, () => Math.floor(Math.random() * GEM_COLORS.length)),
            );
          } while (this.findMatchesIn(grid).length > 0);
          return grid;
        }

        spawnBoard() {
          this.gems?.flat().forEach((g) => g && g.destroy());
          const colors = this.genNoMatch();
          this.gems = colors.map((row, r) =>
            row.map((ci, c) => this.makeGem(r, c, ci)),
          );
        }

        findMatchesIn(grid) {
          // grid 为 colorIdx 矩阵
          const matched = Array.from({ length: CH }, () => Array(CW).fill(false));
          for (let r = 0; r < CH; r++)
            for (let c = 0; c < CW - 2; c++)
              if (grid[r][c] !== -1 && grid[r][c] === grid[r][c + 1] && grid[r][c] === grid[r][c + 2]) {
                matched[r][c] = matched[r][c + 1] = matched[r][c + 2] = true;
              }
          for (let c = 0; c < CW; c++)
            for (let r = 0; r < CH - 2; r++)
              if (grid[r][c] !== -1 && grid[r][c] === grid[r + 1][c] && grid[r][c] === grid[r + 2][c]) {
                matched[r][c] = matched[r + 1][c] = matched[r + 2][c] = true;
              }
          const cells = [];
          for (let r = 0; r < CH; r++)
            for (let c = 0; c < CW; c++) if (matched[r][c]) cells.push([r, c]);
          return cells;
        }

        colorGrid() {
          return this.gems.map((row) => row.map((g) => (g ? g.getData('colorIdx') : -1)));
        }

        onGemClick(gem) {
          if (this.busy || this.moves <= 0) return;
          if (!this.selected) {
            this.selected = gem;
            this.tweens.add({ targets: gem, scale: 1.15, duration: 120, yoyo: true });
            return;
          }
          if (this.selected === gem) {
            this.selected = null;
            return;
          }
          const a = this.selected.getData();
          const b = gem.getData();
          if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) {
            // 非相邻：重新选择
            this.selected = gem;
            this.tweens.add({ targets: gem, scale: 1.15, duration: 120, yoyo: true });
            return;
          }
          this.selected.setStrokeStyle(2, 0xffffff33);
          this.selected = null;
          this.trySwap(a.r, a.c, b.r, b.c);
        }

        trySwap(r1, c1, r2, c2) {
          const g1 = this.gems[r1][c1];
          const g2 = this.gems[r2][c2];
          // 交换数据与网格
          this.gems[r1][c1] = g2;
          this.gems[r2][c2] = g1;
          g1.setData({ r: r2, c: c2 });
          g2.setData({ r: r1, c: c1 });

          const p1 = this.pos(r1, c1);
          const p2 = this.pos(r2, c2);
          this.tweens.add({ targets: g1, x: p2.x, y: p2.y, duration: 140, ease: 'quad.out' });
          this.tweens.add({ targets: g2, x: p1.x, y: p1.y, duration: 140, ease: 'quad.out' });

          this.time.delayedCall(150, () => {
            const matches = this.findMatchesIn(this.colorGrid());
            if (matches.length === 0) {
              // 无效交换：回弹
              this.gems[r1][c1] = g1;
              this.gems[r2][c2] = g2;
              g1.setData({ r: r1, c: c1 });
              g2.setData({ r: r2, c: c2 });
              const q1 = this.pos(r1, c1);
              const q2 = this.pos(r2, c2);
              this.tweens.add({ targets: g1, x: q1.x, y: q1.y, duration: 140, ease: 'back.out' });
              this.tweens.add({ targets: g2, x: q2.x, y: q2.y, duration: 140, ease: 'back.out' });
              return;
            }
            this.moves -= 1;
            this.hooks.onMoves(this.moves);
            this.resolveMatches(1);
          });
        }

        resolveMatches(comboLevel) {
          this.busy = true;
          const matches = this.findMatchesIn(this.colorGrid());
          if (matches.length === 0) {
            this.busy = false;
            this.hooks.onCombo(0);
            if (this.moves <= 0) {
              this.cameras.main.shake(250, 0.006);
            }
            return;
          }
          this.hooks.onCombo(comboLevel);
          const gain = matches.length * 50 * comboLevel;
          this._score += gain;
          this.hooks.onScore(this._score);
          // 中心飘字
          const cx = SIZE_W / 2;
          const cy = SIZE_H / 2;
          const floatText = this.add.text(cx, cy, `+${gain}${comboLevel > 1 ? ` ×${comboLevel}` : ''}`, {
            fontFamily: 'Arial', fontSize: '28px', color: '#fde047', fontStyle: 'bold',
            stroke: '#7c2d12', strokeThickness: 4,
          }).setOrigin(0.5).setDepth(10);
          this.tweens.add({ targets: floatText, y: cy - 50, alpha: 0, duration: 900, onComplete: () => floatText.destroy() });

          // 消除爆裂
          matches.forEach(([r, c], i) => {
            const gem = this.gems[r][c];
            if (!gem) return;
            this.time.delayedCall(i * 18, () => {
              this.particles.setParticleTint(GEM_COLORS[gem.getData('colorIdx')]);
              this.particles.emitParticleAt(gem.x, gem.y);
              gem.destroy();
              this.gems[r][c] = null;
            });
          });

          this.time.delayedCall(matches.length * 18 + 220, () => this.dropAndFill(comboLevel));
        }

        dropAndFill(comboLevel) {
          // 每列重力下落
          let maxDelay = 0;
          for (let c = 0; c < CW; c++) {
            const column = [];
            for (let r = CH - 1; r >= 0; r--) {
              if (this.gems[r][c]) column.push(this.gems[r][c]);
            }
            let writeRow = CH - 1;
            for (const gem of column) {
              if (gem.getData('r') !== writeRow) {
                const fallDist = writeRow - gem.getData('r');
                gem.setData('r', writeRow);
                const p = this.pos(writeRow, c);
                const delay = 0;
                this.tweens.add({
                  targets: gem, y: p.y, duration: 90 + fallDist * 55, delay,
                  ease: 'bounce.out',
                });
                maxDelay = Math.max(maxDelay, 90 + fallDist * 55);
              }
              this.gems[writeRow][c] = gem;
              writeRow--;
            }
            // 顶部补充新宝石（从上方掉入）
            for (let r = writeRow; r >= 0; r--) {
              const ci = Math.floor(Math.random() * GEM_COLORS.length);
              const gem = this.makeGem(r, c, ci);
              const p = this.pos(r, c);
              gem.setY(p.y - (writeRow - r + 1) * (CELL + GAP) - 40);
              this.gems[r][c] = gem;
              this.tweens.add({
                targets: gem, y: p.y, duration: 300, ease: 'bounce.out',
              });
              maxDelay = Math.max(maxDelay, 300);
            }
          }
          this.time.delayedCall(maxDelay + 120, () => this.resolveMatches(comboLevel + 1));
        }

        restart() {
          this._score = 0;
          this.moves = 20;
          this.hooks.onScore(0);
          this.hooks.onMoves(20);
          this.spawnBoard();
        }

        update() {
          const cmd = this.hooks.getCommand();
          if (cmd === 'restart') this.restart();
        }
      }

      return [new Match3Scene()];
    },
  });

  return (
    <div>
      <div className='flex items-center justify-between mb-2 flex-wrap gap-2'>
        <Space>
          <Tag color='green'>{t('得分')}: {score}</Tag>
          <Tag color='blue'>{t('剩余步数')}: {moves}</Tag>
          {combo > 1 && <Tag color='orange'>{t('连击')} ×{combo}</Tag>}
          <Tag color='violet'>{t('最高')}: {best}</Tag>
        </Space>
        <Button size='small' theme='solid' type='primary' onClick={() => send('restart')}>
          {t('重新开始')}
        </Button>
      </div>
      {loading && <Text type='secondary' className='block text-center'>{t('正在加载游戏引擎…')}</Text>}
      {error && <Text type='danger' className='block text-center'>{t('游戏引擎加载失败，请刷新重试')}</Text>}
      <div ref={containerRef} style={{ width: '100%', maxWidth: SIZE_W, margin: '0 auto' }} />
      <Text type='secondary' className='block mt-2 text-center'>
        {t('点击相邻宝石交换，三连消除。连锁反应有连击倍率（×2 ×3…），粒子爆裂与重力弹跳由引擎驱动。共 20 步。')}
      </Text>
      {moves <= 0 && (
        <Text strong type='danger' className='block mt-1 text-center'>
          {t('步数用完！最终得分')} {score}
        </Text>
      )}
      <RedeemPanel gameKey='match3' score={score} onRedeemed={() => setScore(0)} t={t} />
    </div>
  );
};

export default Match3;
