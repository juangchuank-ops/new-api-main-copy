import React, { useEffect, useState } from 'react';
import { Table, Typography, Input } from '@douyinfe/semi-ui';
import { RedeemPanel } from './GameModal';
import { timestamp2string } from '../../../helpers/utils';

const { Text } = Typography;
const GAME_URL = '/games/neon-pulse-1.1.html';
const RECORDS_KEY = 'neon-pulse-local-records';
// 跨局累计的未兑换得分（余额），兑换后清零
const EARNED_KEY = 'neon-pulse-earned-balance';

const readRecords = () => {
  try {
    const records = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
};

const readEarned = () => {
  const earned = Number(localStorage.getItem(EARNED_KEY) || 0);
  return Number.isFinite(earned) && earned > 0 ? Math.floor(earned) : 0;
};

const RoguelikeBoard = ({ t }) => {
  const [score, setScore] = useState(readEarned);
  const [playerName, setPlayerName] = useState('');
  const [records, setRecords] = useState(readRecords);

  useEffect(() => {
    const onMessage = (event) => {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== 'neon-pulse-score'
      )
        return;
      const nextScore = Math.max(0, Math.floor(Number(event.data.score) || 0));
      if (nextScore <= 0) return;
      // 累计到未兑换余额而不是覆盖，避免单局达不到兑换门槛时得分被清掉
      setScore((prev) => {
        const total = prev + nextScore;
        localStorage.setItem(EARNED_KEY, String(total));
        return total;
      });
      const nextRecords = [
        {
          name: playerName.trim() || t('无名挑战者'),
          score: nextScore,
          date: Date.now(),
        },
        ...readRecords(),
      ]
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      localStorage.setItem(RECORDS_KEY, JSON.stringify(nextRecords));
      setRecords(nextRecords);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [playerName, t]);

  const columns = [
    {
      title: t('排名'),
      dataIndex: 'rank',
      width: 60,
      render: (_, __, i) => `#${i + 1}`,
    },
    { title: t('挑战者'), dataIndex: 'name' },
    {
      title: t('得分'),
      dataIndex: 'score',
      render: (value) => <Text strong>{value}</Text>,
    },
    {
      title: t('时间'),
      dataIndex: 'date',
      render: (value) => timestamp2string(Math.floor(value / 1000)),
    },
  ];

  return (
    <div>
      <div className='flex items-center justify-between mb-3 flex-wrap gap-2'>
        <div>
          <Text strong className='block'>
            NEON-PULSE v1.1
          </Text>
          <Text type='secondary'>
            {t('WASD 移动，SPACE 冲刺，鼠标移动并左键冲刺')}
          </Text>
          <Text type='warning' className='block mt-1'>
            {t('价格 Tips：此游戏比例是 100000:1')}
          </Text>
        </div>
        <Input
          value={playerName}
          onChange={setPlayerName}
          placeholder={t('排行榜名称')}
          maxLength={12}
          style={{ width: 180 }}
        />
      </div>
      <div
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          minHeight: 520,
          background: '#050816',
          overflow: 'hidden',
        }}
      >
        <iframe
          title='NEON-PULSE v1.1'
          src={GAME_URL}
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          allow='fullscreen; autoplay; gamepad'
        />
      </div>
      <Text type='secondary' className='block mt-2'>
        {t('游戏结束时得分会累计到可兑换余额，并记录到本机排行榜。')}
      </Text>
      <div className='mt-4'>
        <Text strong className='block mb-2'>
          {t('🏆 本机排行榜')}
        </Text>
        <Table
          columns={columns}
          dataSource={records}
          pagination={false}
          size='small'
          empty={<Text type='secondary'>{t('暂无记录，快去挑战！')}</Text>}
        />
      </div>
      <RedeemPanel
        gameKey='roguelike'
        score={score}
        onRedeemed={() => {
          localStorage.removeItem(EARNED_KEY);
          setScore(0);
        }}
        t={t}
      />
    </div>
  );
};

export default RoguelikeBoard;
