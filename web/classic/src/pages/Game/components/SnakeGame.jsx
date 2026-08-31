import React, { useCallback, useRef, useState } from 'react';
import { Button, Typography, Tag, Space } from '@douyinfe/semi-ui';
import { RedeemPanel } from './GameModal';
import { usePhaserGame } from './usePhaserGame';

const { Text } = Typography;

const GRID = 21;
const CELL = 24;
const VIEW = GRID * CELL;

// Phaser 引擎版贪吃蛇：补间平滑移动、粒子吞食特效、震屏死亡、金色食物
const SnakeGame = ({ t }) => {
  const [score, setScore] = useState(0);
  const [speedLevel, setSpeedLevel] = useState(1);
  const [status, setStatus] = useState('idle'); // idle | running | paused | over
  const [golden, setGolden] = useState(false);
  const scoreRef = useRef(0);
  const gameCmdRef = useRef({ cmd: null });

  const hooks = useRef({
    onScore: (n) => { scoreRef.current = n; setScore(n); },
    onSpeed: (lv) => setSpeedLevel(lv),
    onStatus: (s) => setStatus(s),
    onGolden: (g) => setGolden(g),
    getCommand: () => {
      const c = gameCmdRef.current.cmd;
      gameCmdRef.current.cmd = null;
      return c;
    },
  });

  const send = useCallback((cmd) => { gameCmdRef.current.cmd = cmd; }, []);

  const { containerRef, error, loading } = usePhaserGame({
    width: VIEW,
    height: VIEW,
    backgroundColor: '#a2d149',
    sceneFactory: (Phaser) => {
      class SnakeScene extends Phaser.Scene {
        constructor() { super('snake'); }

        create() {
          this.tickMs = 150;
          this.acc = 0;
          this.dir = { x: 1, y: 0 };
          this.queue = [];
          this.cells = [];
          this.rects = [];
          this.alive = false;
          this.eaten = 0;
          this.foodObj = null;
          this.golden = false;
          this.goldenTimer = null;
          this.hooks = hooks.current;

          // 棋盘
          for (let y = 0; y < GRID; y++)
            for (let x = 0; x < GRID; x++) {
              this.add.rectangle(
                x * CELL + CELL / 2, y * CELL + CELL / 2, CELL, CELL,
                (x + y) % 2 === 0 ? 0xaad751 : 0xa2d149,
              );
            }

          // 粒子贴图
          const g = this.make.graphics({ x: 0, y: 0 }, false);
          g.fillStyle(0xffffff, 1);
          g.fillCircle(4, 4, 4);
          g.generateTexture('dot', 8, 8);
          g.destroy();

          this.particles = this.add.particles(0, 0, 'dot', {
            speed: { min: 60, max: 180 },
            lifespan: 500,
            scale: { start: 1, end: 0 },
            emitting: false,
            quantity: 14,
          });

          // 键盘同时监听窗口，避免 Phaser 画布未获焦点时无法操作
          const onKeyDown = (e) => {
            const map = {
              ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
              ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
            };
            if (e.key === ' ') {
              e.preventDefault();
              if (this.alive) this.togglePause();
              return;
            }
            const nd = map[e.key];
            if (!nd || !this.alive || this.paused) return;
            e.preventDefault();
            const cur = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
            if ((nd.x !== -cur.x || nd.y !== -cur.y) && (nd.x !== cur.x || nd.y !== cur.y)) {
              if (this.queue.length < 3) this.queue.push(nd);
            }
          };
          this._onWindowKeyDown = onKeyDown;
          window.addEventListener('keydown', onKeyDown);
        }

        shutdown() {
          if (this._onWindowKeyDown) window.removeEventListener('keydown', this._onWindowKeyDown);
        }

        togglePause() {
          this.paused = !this.paused;
          this.hooks.onStatus(this.paused ? 'paused' : 'running');
        }

        start() {
          this.rects?.forEach((r) => r.destroy());
          if (this.foodObj) { this.foodObj.destroy(); this.foodObj = null; }
          const cx = Math.floor(GRID / 2);
          this.cells = [];
          for (let i = 0; i < 3; i++) this.cells.push({ x: cx - i, y: cx });
          this.rects = this.cells.map((c) => {
            const rect = this.add.rectangle(
              c.x * CELL + CELL / 2, c.y * CELL + CELL / 2, CELL - 3, CELL - 3, 0x487fb4,
            );
            return rect;
          });
          this.dir = { x: 1, y: 0 };
          this.queue = [];
          this.tickMs = 150;
          this.eaten = 0;
          this._score = 0;
          this.acc = 0;
          this.alive = true;
          this.paused = false;
          this.hooks.onScore(0);
          this.hooks.onSpeed(1);
          this.hooks.onStatus('running');
          this.spawnFood();
        }

        spawnFood() {
          if (this.goldenTimer) { this.goldenTimer.remove(); this.goldenTimer = null; }
          const occupied = new Set((this.cells || []).map((s) => `${s.x},${s.y}`));
          let fx, fy;
          do {
            fx = Math.floor(Math.random() * GRID);
            fy = Math.floor(Math.random() * GRID);
          } while (occupied.has(`${fx},${fy}`));
          this.golden = Math.random() < 0.15;
          if (this.foodObj) this.foodObj.destroy();
          const color = this.golden ? 0xfbbf24 : 0xe7471d;
          const food = this.add.circle(fx * CELL + CELL / 2, fy * CELL + CELL / 2, CELL * 0.42, color);
          if (this.golden) food.setStrokeStyle(3, 0xfff7ed);
          this.tweens.add({
            targets: food, scale: { from: 1, to: 1.15 }, duration: 350, yoyo: true, repeat: -1, ease: 'sine.inout',
          });
          this.food = { x: fx, y: fy };
          this.foodObj = food;
          this.hooks.onGolden(this.golden);
          if (this.golden) {
            this.goldenTimer = this.time.delayedCall(6000, () => {
              if (this.foodObj) {
                this.tweens.add({ targets: this.foodObj, alpha: 0, duration: 250, onComplete: () => this.spawnFood() });
              }
            });
          }
        }

        die() {
          this.alive = false;
          if (this.goldenTimer) {
            this.goldenTimer.remove();
            this.goldenTimer = null;
          }
          this.hooks.onGolden(false);
          this.hooks.onStatus('over');
          this.cameras.main.shake(250, 0.01);
          this.rects.forEach((r, i) => {
            this.time.delayedCall(i * 30, () => {
              r.setFillStyle(0x7f1d1d);
              this.tweens.add({ targets: r, scale: 0.4, alpha: 0.3, duration: 220 });
            });
          });
        }

        update(time, delta) {
          // 处理 React 侧命令
          const cmd = this.hooks.getCommand();
          if (cmd === 'start') this.start();
          else if (cmd === 'pause' && this.alive) this.togglePause();

          if (!this.alive || this.paused) return;
          this.acc += delta;
          if (this.acc < this.tickMs) return;
          this.acc -= this.tickMs;

          if (this.queue.length) this.dir = this.queue.shift();

          const head = this.cells[0];
          const nx = head.x + this.dir.x;
          const ny = head.y + this.dir.y;

          // 撞墙/自撞（尾巴移走后原尾格可进，简化为包含尾格）
          const ate = this.food && nx === this.food.x && ny === this.food.y;
          const hitSelf = this.cells.some((c, i) => c.x === nx && c.y === ny && (ate || i < this.cells.length - 1));
          if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID || hitSelf) {
            this.die();
            return;
          }

          // 位置前移
          this.cells.unshift({ x: nx, y: ny });
          if (ate) {
            const rect = this.add.rectangle(
              this.cells[this.cells.length - 1].x * CELL + CELL / 2,
              this.cells[this.cells.length - 1].y * CELL + CELL / 2,
              CELL - 3, CELL - 3, 0x487fb4,
            );
            this.rects.push(rect);
          } else {
            this.cells.pop();
          }

          // 蛇未进食时复用全部蛇节图形，避免每移动一步就丢失一节。
          // 每个图形跟随同索引的蛇节移动，保持补间动画连续。
          this.rects.forEach((r, i) => {
            this.tweens.killTweensOf(r);
            r.setFillStyle(i === 0 ? 0x4a7ba6 : 0x487fb4);
            r.setStrokeStyle(i === 0 ? 2 : 1, i === 0 ? 0x1e3a5f : 0x2b577e);
            r.isStroked = true;
            this.tweens.add({
              targets: r,
              x: this.cells[i].x * CELL + CELL / 2,
              y: this.cells[i].y * CELL + CELL / 2,
              duration: this.tickMs,
              ease: 'linear',
            });
          });

          if (ate) {
            const gain = this.golden ? 500 : 100;
            this._score = (this._score || 0) + gain;
            this.hooks.onScore(this._score);
            this.particles.setParticleTint(this.golden ? 0xfbbf24 : 0xe7471d);
            this.particles.emitParticleAt(nx * CELL + CELL / 2, ny * CELL + CELL / 2);
            this.eaten += 1;
            if (this.eaten % 5 === 0 && this.tickMs > 70) {
              this.tickMs = Math.max(70, this.tickMs - 12);
              this.hooks.onSpeed(Math.floor((150 - this.tickMs) / 12) + 1);
            }
            this.spawnFood();
          }
        }
      }

      return [new SnakeScene()];
    },
  });

  return (
    <div>
      <div className='flex items-center justify-between mb-2 flex-wrap gap-2'>
        <Space>
          <Tag color='green'>{t('得分')}: {score}</Tag>
          <Tag color='blue'>{t('速度档')}: {speedLevel}</Tag>
          {golden && <Tag color='orange'>✨ {t('金色食物')}</Tag>}
        </Space>
        <Space>
          {status === 'running' || status === 'paused' ? (
            <Button size='small' onClick={() => send('pause')}>
              {status === 'paused' ? t('继续') : t('暂停')}
            </Button>
          ) : null}
          <Button size='small' theme='solid' type='primary' onClick={() => send('start')}>
            {status === 'idle' ? t('开始游戏') : t('重新开始')}
          </Button>
        </Space>
      </div>
      {loading && <Text type='secondary' className='block text-center'>{t('正在加载游戏引擎…')}</Text>}
      {error && <Text type='danger' className='block text-center'>{t('游戏引擎加载失败，请刷新重试')}</Text>}
      <div ref={containerRef} style={{ width: '100%', maxWidth: VIEW, margin: '0 auto' }} />
      <Text type='secondary' className='block mt-2 text-center'>
        {t('方向键控制 · 空格暂停 · 普通食物 +100 · 金色 +500（限时 6 秒）· 引擎驱动物理与特效')}
      </Text>
      <RedeemPanel gameKey='snake' score={score} onRedeemed={() => { setScore(0); }} t={t} />
    </div>
  );
};

export default SnakeGame;
