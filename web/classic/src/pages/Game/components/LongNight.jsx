import React, { useEffect, useRef, useState } from 'react';
import { Button, Typography, Progress } from '@douyinfe/semi-ui';
import { RedeemPanel } from './GameModal';

const { Text } = Typography;

// 漫漫长夜：守住篝火到天亮。黑夜 120 秒，火把会熄灭，点击添柴；
// 怪物随时间增多，火光弱时掉血。活得越久分越高。
const DURATION = 120; // 秒

const LongNight = ({ t }) => {
  const [fire, setFire] = useState(100);
  const [hp, setHp] = useState(100);
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [woodLeft, setWoodLeft] = useState(12);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setTime((prev) => {
        const next = prev + 1;
        if (next >= DURATION) {
          setRunning(false);
          setOver(true);
          return DURATION;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const decay = setInterval(() => {
      setFire((f) => {
        const w = Math.floor(time / 20) + 1;
        setWave(w);
        return Math.max(0, f - w * 1.5);
      });
    }, 500);
    return () => clearInterval(decay);
  }, [running, time]);

  useEffect(() => {
    if (!running) return;
    const monster = setInterval(() => {
      setHp((h) => {
        if (fire < 30) return Math.max(0, h - 4);
        if (fire < 60) return Math.max(0, h - 1);
        return h;
      });
    }, 1000);
    return () => clearInterval(monster);
  }, [running, fire]);

  useEffect(() => {
    if (running && hp <= 0) {
      setRunning(false);
      setOver(true);
    }
  }, [hp, running]);

  useEffect(() => {
    if (!running && over) {
      // 结算分数：存活秒数×20
      setScore(time * 20 + (hp > 0 && time >= DURATION ? 3000 : 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  const addWood = () => {
    if (!running || woodLeft <= 0) return;
    setWoodLeft((n) => n - 1);
    setFire((f) => Math.min(100, f + 15));
  };

  const start = () => {
    setFire(100);
    setHp(100);
    setTime(0);
    setScore(0);
    setWoodLeft(12);
    setWave(1);
    setOver(false);
    setRunning(true);
  };

  const isDawn = time >= DURATION && over;
  const fireColor = fire > 60 ? '#f59e0b' : fire > 30 ? '#f97316' : '#ef4444';

  return (
    <div>
      <div className='flex items-center justify-between mb-2 flex-wrap gap-2'>
        <Text strong>
          {isDawn ? t('☀️ 天亮了！') : t('黑夜')} {time}/{DURATION}s · {t('第{{w}}波', { w: wave })}
        </Text>
        <Button size='small' onClick={start}>{running ? t('重新开始') : t('开始')}</Button>
      </div>

      <div
        className='rounded-lg flex flex-col items-center justify-center py-10 relative overflow-hidden'
        style={{ background: over ? (isDawn ? '#78350f22' : '#111827') : '#111827' }}
      >
        <div style={{ fontSize: 72, filter: `brightness(${0.4 + fire / 160})` }}>
          {fire > 0 ? '🔥' : '💀'}
        </div>
        <Text style={{ color: '#d1d5db' }} className='mt-2'>
          {over
            ? isDawn ? t('你熬过了漫漫长夜！+3000') : t('你倒在了黑夜中……')
            : fire > 60 ? t('篝火正旺，怪物不敢靠近') : fire > 30 ? t('火光渐弱，怪物蠢蠢欲动') : t('黑暗逼近！怪物在攻击你！')}
        </Text>
        {!over && running && (
            <Button theme='solid' type='warning' size='large' className='mt-4' onClick={addWood} disabled={woodLeft <= 0}>
            {t('添柴 +15 火力')} ({woodLeft})
          </Button>
        )}
      </div>

      <div className='mt-3 space-y-2'>
        <div>
          <Text type='secondary' size='small'>{t('篝火')}</Text>
          <Progress percent={fire} stroke={fireColor} showInfo={false} />
        </div>
        <div>
          <Text type='secondary' size='small'>{t('生命')}</Text>
          <Progress percent={hp} stroke={hp > 50 ? '#22c55e' : '#ef4444'} showInfo={false} />
        </div>
      </div>

      <Text type='secondary' className='block mt-2'>
        {t('熬 120 秒到天亮。火会越烧越快，火弱时怪物伤你。每秒存活 20 分，天亮 +3000。每局最多添柴 12 次。')}
      </Text>
      <RedeemPanel gameKey='longnight' score={score} onRedeemed={() => setScore(0)} t={t} />
    </div>
  );
};

export default LongNight;
