import React, { useCallback, useRef, useState } from 'react';
import { Button, Typography, Tag, Space } from '@douyinfe/semi-ui';
import { RedeemPanel } from './GameModal';
import { usePhaserGame } from './usePhaserGame';

const { Text } = Typography;

const W = 560;
const H = 420;
const HOOK_X = W / 2;
const HOOK_Y = 64;
const GROUND_Y = 130;

const ITEM_TYPES = [
  { key: 'small', r: 11, value: 50, weight: 1, color: 0xfbbf24, label: '小金' },
  { key: 'mid', r: 16, value: 150, weight: 2, color: 0xf59e0b, label: '中金' },
  { key: 'big', r: 24, value: 500, weight: 4, color: 0xd97706, label: '大金' },
  { key: 'diamond', r: 9, value: 600, weight: 1, color: 0x22d3ee, label: '钻石' },
  { key: 'rock', r: 20, value: 11, weight: 6, color: 0x6b7280, label: '石头' },
  { key: 'bomb', r: 12, value: -100, weight: 1, color: 0xef4444, label: '炸药' },
  { key: 'bag', r: 13, value: 0, weight: 2, color: 0x92400e, label: '幸运袋', mystery: true },
];

// Phaser 引擎版黄金矿工：角速度摆锤物理、绳索绘制、按重量的收线速度、关卡目标
const GoldMiner = ({ t }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [level, setLevel] = useState(1);
  const [target, setTarget] = useState(650);
  const [status, setStatus] = useState('idle'); // idle | running | over | win
  const cmdRef = useRef({ cmd: null });
  const hooks = useRef({
    onScore: (s) => setScore(s),
    onTime: (s) => setTimeLeft(s),
    onLevel: (l, tg) => { setLevel(l); setTarget(tg); },
    onStatus: (s) => setStatus(s),
    getCommand: () => {
      const c = cmdRef.current.cmd;
      cmdRef.current.cmd = null;
      return c;
    },
  });

  const send = useCallback((cmd) => { cmdRef.current.cmd = cmd; }, []);

  const { containerRef, error, loading } = usePhaserGame({
    width: W,
    height: H,
    backgroundColor: '#1e293b',
    sceneFactory: (Phaser) => {
      class MinerScene extends Phaser.Scene {
        constructor() { super('miner'); }

        create() {
          this.hooks = hooks.current;
          this.running = false;
          this._score = 0;
          this.level = 1;

          // 天空与地面
          this.add.rectangle(0, 0, W, GROUND_Y, 0x7dd3fc, 1).setOrigin(0);
          this.add.rectangle(0, GROUND_Y, W, H - GROUND_Y, 0x78350f, 1).setOrigin(0);
          // 地面草线
          this.add.rectangle(0, GROUND_Y - 6, W, 10, 0x4d7c0f, 1).setOrigin(0);
          // 矿工
          this.miner = this.add.text(HOOK_X - 16, HOOK_Y - 42, '⛏️', { fontSize: '30px' });

          // 绳（graphic 每帧重绘）
          this.rope = this.add.graphics();
          this.hook = this.add.circle(HOOK_X, HOOK_Y, 6, 0xe2e8f0);
          this.hook.setStrokeStyle(2, 0x94a3b8);

          // 摆锤状态：角度 + 角速度（真实钟摆物理）
          this.angle = 0;
          this.angVel = 1.6;
          this.ropeLen = 42;
          this.mode = 'swing'; // swing | down | up
          this.caught = null;

          this.input.on('pointerdown', () => {
            if (this.running && this.mode === 'swing') {
              this.mode = 'down';
            }
          });
        }

        genItems() {
          this.items?.forEach((it) => it.obj.destroy());
          this.items = [];
          const count = 8 + this.level;
          for (let i = 0; i < count; i++) {
            const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
            let x, y, ok;
            do {
              x = 30 + Math.random() * (W - 60);
              y = GROUND_Y + 25 + Math.random() * (H - GROUND_Y - 45);
              ok = this.items.every((it) => Phaser.Math.Distance.Between(x, y, it.x, it.y) > 46);
            } while (!ok);
            const obj = this.add.circle(x, y, type.r, type.color);
            obj.setStrokeStyle(2, 0x00000044);
            if (type.key === 'diamond') {
              this.tweens.add({ targets: obj, scaleX: 1.2, scaleY: 1.2, duration: 500, yoyo: true, repeat: -1 });
            }
            this.items.push({ ...type, x, y, obj, taken: false });
          }
        }

        startLevel(level) {
          this.level = level;
          this._score = level === 1 ? 0 : this._score;
          const target = 650 + (level - 1) * 400;
          this.hooks.onLevel(level, target);
          this.target = target;
          this.timeLeft = 60;
          this.hooks.onTime(60);
          this.genItems();
          this.running = true;
          this.mode = 'swing';
          this.caught = null;
          this.ropeLen = 42;
          this.hooks.onStatus('running');
          this.timeEvent = this.time.addEvent({ delay: 1000, repeat: 59, callback: () => {
            this.timeLeft -= 1;
            this.hooks.onTime(this.timeLeft);
            if (this.timeLeft <= 0) this.endLevel();
          } });
        }

        endLevel() {
          this.running = false;
          this.timeEvent?.remove();
          if (this._score >= this.target) {
            this.hooks.onStatus('win');
          } else {
            this.hooks.onStatus('over');
            this.cameras.main.shake(300, 0.01);
          }
        }

        hookTip() {
          const rad = Phaser.Math.DegToRad(this.angle);
          return {
            x: HOOK_X + Math.sin(rad) * this.ropeLen,
            y: HOOK_Y + Math.cos(rad) * this.ropeLen,
          };
        }

        update(time, delta) {
          const dt = Math.min(delta, 50) / 1000;
          const cmd = this.hooks.getCommand();
          if (cmd === 'start') {
            this._score = 0;
            this.hooks.onScore(0);
            this.startLevel(1);
          } else if (cmd === 'next') {
            this.startLevel(this.level + 1);
          }

          if (!this.running) return;

          // 钟摆物理：角度加速度 ∝ -sin(θ)，阻尼极小
          if (this.mode === 'swing') {
            const g = 34; // 等效重力（角加速度系数）
            this.angVel += -g * Math.sin(Phaser.Math.DegToRad(this.angle)) * dt;
            this.angVel *= 0.998;
            this.angle += this.angVel * dt * 60;
            this.angle = Phaser.Math.Clamp(this.angle, -75, 75);
            if (Math.abs(this.angle) >= 75) this.angVel *= -0.4;
          } else if (this.mode === 'down') {
            this.ropeLen += 260 * dt;
          } else if (this.mode === 'up') {
            const speed = this.caught ? Math.max(70, 300 - this.caught.weight * 34) : 300;
            this.ropeLen -= speed * dt;
            if (this.ropeLen <= 42) {
              if (this.caught) {
                let value = this.caught.value;
                if (this.caught.mystery) value = [ -50, 150, 350, 888 ][Math.floor(Math.random() * 4)];
                this._score = Math.max(0, this._score + value);
                this.hooks.onScore(this._score);
                // 收获特效
                const floatText = this.add.text(HOOK_X, HOOK_Y - 30, `${value >= 0 ? '+' : ''}${value}`, {
                  fontFamily: 'Arial', fontSize: '20px', color: value >= 0 ? '#4ade80' : '#f87171', fontStyle: 'bold',
                }).setOrigin(0.5);
                this.tweens.add({ targets: floatText, y: floatText.y - 36, alpha: 0, duration: 800, onComplete: () => floatText.destroy() });
                this.caught.obj.destroy();
                this.caught = null;
              }
              this.mode = 'swing';
            }
          }

          const tip = this.hookTip();

          // 伸钩时碰撞检测
          if (this.mode === 'down') {
            for (const item of this.items) {
              if (item.taken) continue;
              const dist = Phaser.Math.Distance.Between(tip.x, tip.y, item.x, item.y);
              if (dist < item.r + 8) {
                item.taken = true;
                this.caught = item;
                this.mode = 'up';
                break;
              }
            }
            if (tip.y > H || tip.x < 0 || tip.x > W) this.mode = 'up';
          }

          // 挂载物跟随钩子
          if (this.caught) {
            this.caught.obj.setPosition(tip.x, tip.y + this.caught.r + 6);
          }

          // 绘制绳
          this.rope.clear();
          this.rope.lineStyle(2.5, 0xcbd5e1, 1);
          this.rope.beginPath();
          this.rope.moveTo(HOOK_X, HOOK_Y);
          this.rope.lineTo(tip.x, tip.y);
          this.rope.strokePath();
          this.hook.setPosition(tip.x, tip.y);
        }
      }

      return [new MinerScene()];
    },
  });

  return (
    <div>
      <div className='flex items-center justify-between mb-2 flex-wrap gap-2'>
        <Space>
          <Tag color='green'>{t('得分')}: {score}</Tag>
          <Tag color='blue'>{t('时间')}: {timeLeft}s</Tag>
          <Tag color='violet'>{t('第 {{n}} 关', { n: level })} · {t('目标')} {target}</Tag>
        </Space>
        <Space>
          {status === 'win' && (
            <Button size='small' theme='solid' type='primary' onClick={() => send('next')}>
              {t('下一关')}
            </Button>
          )}
          <Button size='small' theme='solid' type='warning' onClick={() => send('start')}>
            {status === 'idle' ? t('开始游戏') : t('重新开始')}
          </Button>
        </Space>
      </div>
      {loading && <Text type='secondary' className='block text-center'>{t('正在加载游戏引擎…')}</Text>}
      {error && <Text type='danger' className='block text-center'>{t('游戏引擎加载失败，请刷新重试')}</Text>}
      <div ref={containerRef} style={{ width: '100%', maxWidth: W, margin: '0 auto' }} />
      <Text type='secondary' className='block mt-2 text-center'>
        {t('点击放钩。钟摆物理摆动，重物收线慢。小金50/中金150/大金500/钻石600/石头11/炸药-100/幸运袋随机。60秒内达标过关，关卡目标递增。')}
      </Text>
      {(status === 'over' || status === 'win') && (
        <Text strong type={status === 'win' ? 'success' : 'danger'} className='block mt-1 text-center'>
          {status === 'win' ? t('🎉 达标！可进入下一关') : t('未达标，游戏结束')}
        </Text>
      )}
      <RedeemPanel gameKey='goldminer' score={score} onRedeemed={() => setScore(0)} t={t} />
    </div>
  );
};

export default GoldMiner;
