import React, { useCallback, useRef, useState } from 'react';
import { Button, Typography, Tag, Space } from '@douyinfe/semi-ui';
import { RedeemPanel } from './GameModal';
import { usePhaserGame } from './usePhaserGame';

const { Text } = Typography;

const N = 4;
const TILE = 96;
const GAP = 10;
const SIZE = N * TILE + (N + 1) * GAP;
const ORIGIN = GAP;

const TILE_COLORS = {
  2: { bg: 0xeee4da, text: '#776e65' },
  4: { bg: 0xede0c8, text: '#776e65' },
  8: { bg: 0xf2b179, text: '#f9f6f2' },
  16: { bg: 0xf59563, text: '#f9f6f2' },
  32: { bg: 0xf67c5f, text: '#f9f6f2' },
  64: { bg: 0xf65e3b, text: '#f9f6f2' },
  128: { bg: 0xedcf72, text: '#f9f6f2' },
  256: { bg: 0xedcc61, text: '#f9f6f2' },
  512: { bg: 0xedc850, text: '#f9f6f2' },
  1024: { bg: 0xedc53f, text: '#f9f6f2' },
  2048: { bg: 0xedc22e, text: '#f9f6f2' },
  4096: { bg: 0x3c3a32, text: '#f9f6f2' },
};

// Phaser 引擎版 1024：滑动补间、合并弹跳、出现缩放、键盘+触摸手势
const Game1024 = ({ t }) => {
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem('g1024-best') || 0));
  const cmdRef = useRef({ cmd: null });
  const hooks = useRef({
    onScore: (s) => {
      setScore(s);
      setBest((b) => {
        const nb = Math.max(b, s);
        localStorage.setItem('g1024-best', String(nb));
        return nb;
      });
    },
    onOver: (o) => setOver(o),
    getCommand: () => {
      const c = cmdRef.current.cmd;
      cmdRef.current.cmd = null;
      return c;
    },
  });

  const send = useCallback((cmd) => { cmdRef.current.cmd = cmd; }, []);

  const { containerRef, error, loading } = usePhaserGame({
    width: SIZE,
    height: SIZE,
    backgroundColor: '#bbada0',
    sceneFactory: (Phaser) => {
      class G1024Scene extends Phaser.Scene {
        constructor() { super('g1024'); }

        create() {
          this.grid = Array.from({ length: N }, () => Array(N).fill(null));
          this.animating = false;
          this.hooks = hooks.current;
          this._score = 0;

          // 背景格
          for (let r = 0; r < N; r++)
            for (let c = 0; c < N; c++) {
              this.add.rectangle(
                ORIGIN + c * (TILE + GAP) + TILE / 2,
                ORIGIN + r * (TILE + GAP) + TILE / 2,
                TILE, TILE, 0xcdc1b4, 0.35,
              );
            }

          // 手势
          this.input.on('pointerdown', (p) => { this.touchStart = { x: p.x, y: p.y }; });
          this.input.on('pointerup', (p) => {
            if (!this.touchStart) return;
            const dx = p.x - this.touchStart.x;
            const dy = p.y - this.touchStart.y;
            if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
            if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 'right' : 'left');
            else this.move(dy > 0 ? 'down' : 'up');
            this.touchStart = null;
          });

          // 键盘：同时监听窗口，避免焦点停留在页面按钮时方向键失效
          const onKeyDown = (e) => {
            const map = {
              ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
              a: 'left', d: 'right', w: 'up', s: 'down',
              A: 'left', D: 'right', W: 'up', S: 'down',
            };
            const dir = map[e.key];
            if (dir) { e.preventDefault(); this.move(dir); }
          };
          this._onWindowKeyDown = onKeyDown;
          window.addEventListener('keydown', onKeyDown);

          this.spawnTile();
          this.spawnTile();
        }

        shutdown() {
          if (this._onWindowKeyDown) window.removeEventListener('keydown', this._onWindowKeyDown);
        }

        pos(r, c) {
          return { x: ORIGIN + c * (TILE + GAP) + TILE / 2, y: ORIGIN + r * (TILE + GAP) + TILE / 2 };
        }

        makeTile(r, c, value) {
          const { x, y } = this.pos(r, c);
          const style = TILE_COLORS[value] || TILE_COLORS[4096];
          const container = this.add.container(x, y);
          const bg = this.add.rectangle(0, 0, TILE, TILE, style.bg).setStrokeStyle(2, 0x00000022);
          const fontSize = value >= 1024 ? 28 : value >= 128 ? 34 : 40;
          const label = this.add.text(0, 0, String(value), {
            fontFamily: 'Arial Black', fontSize: `${fontSize}px`, color: style.text,
          }).setOrigin(0.5);
          container.add([bg, label]);
          container.setScale(0);
          this.tweens.add({ targets: container, scale: 1, duration: 160, ease: 'back.out' });
          this.grid[r][c] = { value, container };
        }

        spawnTile() {
          const empty = [];
          for (let r = 0; r < N; r++)
            for (let c = 0; c < N; c++) if (!this.grid[r][c]) empty.push([r, c]);
          if (!empty.length) return;
          const [r, c] = empty[Math.floor(Math.random() * empty.length)];
          this.makeTile(r, c, Math.random() < 0.9 ? 2 : 4);
        }

        canMove() {
          for (let r = 0; r < N; r++)
            for (let c = 0; c < N; c++) {
              if (!this.grid[r][c]) return true;
              if (c + 1 < N && this.grid[r][c + 1] && this.grid[r][c].value === this.grid[r][c + 1].value) return true;
              if (r + 1 < N && this.grid[r + 1][c] && this.grid[r][c].value === this.grid[r + 1][c].value) return true;
            }
          return false;
        }

        move(dir) {
          if (this.animating || this.over) return;
          const rotate = { left: 0, up: 3, right: 2, down: 1 }[dir] ?? 0;
          let arr = this.grid.map((row) => row.slice());
          for (let i = 0; i < rotate; i++) arr = arr[0].map((_, c) => arr.map((row) => row[c]).reverse());

          let moved = false;
          let gained = 0;
          const merges = [];
          const nextArr = arr.map((row) => {
            const tiles = row.filter(Boolean);
            const result = [];
            let i = 0;
            while (i < tiles.length) {
              if (i + 1 < tiles.length && tiles[i].value === tiles[i + 1].value) {
                const newVal = tiles[i].value * 2;
                gained += newVal;
                merges.push({ tile: tiles[i], absorbed: tiles[i + 1], newVal });
                result.push({ value: newVal, container: tiles[i].container, mergeFrom: tiles[i + 1] });
                i += 2;
              } else {
                result.push(tiles[i]);
                i += 1;
              }
            }
            while (result.length < N) result.push(null);
            return result;
          });
          // 重新判定 moved：对比行序列
          moved = false;
          for (let r = 0; r < N; r++) {
            const before = arr[r].filter(Boolean).map((x) => x.value);
            const after = nextArr[r].filter(Boolean).map((x) => x.value);
            if (before.join(',') !== after.join(',')) moved = true;
          }

          // 反旋转回原方向
          let out = nextArr;
          for (let i = 0; i < (4 - rotate) % 4; i++) out = out[0].map((_, c) => out.map((row) => row[c]).reverse());

          if (!moved) return;
          this.animating = true;

          // 被合并吸收的 tile：滑到目标后销毁
          for (const m of merges) {
            const target = m.tile;
            // 找 target 在 out 里的新位置
            outer: for (let r = 0; r < N; r++)
              for (let c = 0; c < N; c++)
                if (out[r][c] && out[r][c].container === target.container) {
                  const { x, y } = this.pos(r, c);
                  this.tweens.add({
                    targets: m.absorbed.container, x, y, duration: 130, ease: 'quad.in',
                    onComplete: () => m.absorbed.container.destroy(),
                  });
                  break outer;
                }
          }

          // 所有 tile 滑到新位置；合并的做弹跳+换色换字
          for (let r = 0; r < N; r++)
            for (let c = 0; c < N; c++) {
              const cell = out[r][c];
              if (!cell) continue;
              const { x, y } = this.pos(r, c);
              this.tweens.add({ targets: cell.container, x, y, duration: 130, ease: 'quad.out' });
              if (cell.mergeFrom) {
                const newVal = cell.value;
                this.time.delayedCall(130, () => {
                  const style = TILE_COLORS[newVal] || TILE_COLORS[4096];
                  const bg = cell.container.list[0];
                  const label = cell.container.list[1];
                  bg.setFillStyle(style.bg);
                  label.setStyle({
                    color: style.text,
                    fontSize: `${newVal >= 1024 ? 28 : newVal >= 128 ? 34 : 40}px`,
                  });
                  label.setText(String(newVal));
                  this.tweens.add({
                    targets: cell.container, scale: { from: 1, to: 1.18 }, duration: 90, yoyo: true, ease: 'quad.out',
                  });
                });
                delete cell.mergeFrom;
              }
            }

          this.grid = out;
          if (gained > 0) {
            this._score += gained;
            this.hooks.onScore(this._score);
          }

          this.time.delayedCall(180, () => {
            this.spawnTile();
            this.animating = false;
            if (!this.canMove()) {
              this.over = true;
              this.hooks.onOver(true);
              this.cameras.main.shake(300, 0.008);
            }
          });
        }

        restart() {
          for (let r = 0; r < N; r++)
            for (let c = 0; c < N; c++)
              if (this.grid[r][c]) { this.grid[r][c].container.destroy(); this.grid[r][c] = null; }
          this._score = 0;
          this.hooks.onScore(0);
          this.hooks.onOver(false);
          this.over = false;
          this.spawnTile();
          this.spawnTile();
        }

        update() {
          const cmd = this.hooks.getCommand();
          if (cmd === 'restart') this.restart();
        }
      }

      return [new G1024Scene()];
    },
  });

  return (
    <div>
      <div className='flex items-center justify-between mb-2 flex-wrap gap-2'>
        <Space>
          <Tag color='green'>{t('得分')}: {score}</Tag>
          <Tag color='violet'>{t('最高')}: {best}</Tag>
        </Space>
        <Button size='small' theme='solid' type='primary' onClick={() => send('restart')}>
          {t('重新开始')}
        </Button>
      </div>
      {loading && <Text type='secondary' className='block text-center'>{t('正在加载游戏引擎…')}</Text>}
      {error && <Text type='danger' className='block text-center'>{t('游戏引擎加载失败，请刷新重试')}</Text>}
      <div ref={containerRef} style={{ width: '100%', maxWidth: SIZE, margin: '0 auto' }} />
      <Text type='secondary' className='block mt-2 text-center'>
        {t('方向键/WASD 或触摸滑动。合并弹跳动画与手感由 Phaser 引擎补间驱动。')}
      </Text>
      {over && <Text type='danger' strong className='block mt-1 text-center'>{t('无法移动，游戏结束！')}</Text>}
      <RedeemPanel gameKey='g1024' score={score} onRedeemed={() => setScore(0)} t={t} />
    </div>
  );
};

export default Game1024;
