import React, { useEffect, useState } from 'react';
import { SideSheet, Button, Space, Typography, InputNumber } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../helpers';

const { Text, Title } = Typography;

import TexasHoldem from './TexasHoldem';
import Roulette from './Roulette';
import SnakeGame from './SnakeGame';
import LongNight from './LongNight';
import Game1024 from './Game1024';
import TetrisToken from './TetrisToken';
import StockMarket from './StockMarket';
import FuturesTrading from './FuturesTrading';
import GoldMiner from './GoldMiner';
import TokenMining from './TokenMining';
import RoguelikeBoard from './RoguelikeBoard';
import Match3 from './Match3';

const GAME_COMPONENTS = {
  texas: TexasHoldem,
  roulette: Roulette,
  snake: SnakeGame,
  longnight: LongNight,
  g1024: Game1024,
  tetris: TetrisToken,
  stock: StockMarket,
  futures: FuturesTrading,
  goldminer: GoldMiner,
  mining: TokenMining,
  roguelike: RoguelikeBoard,
  match3: Match3,
};

// 兑换面板：普通计分游戏 1000 分 = 1 额度，肉鸽 10000 分 = 1 额度
export const RedeemPanel = ({ gameKey, score, onRedeemed, t }) => {
  const [redeeming, setRedeeming] = useState(false);
  const scorePerUnit = gameKey === 'roguelike' ? 10000 : 1000;
  const usd = (score / scorePerUnit).toFixed(4);

  const redeem = async () => {
    if (score <= 0) return;
    setRedeeming(true);
    try {
      const res = await API.post('/api/user/game/redeem', {
        game_key: gameKey,
        score: Math.floor(score),
      });
      if (res.data.success) {
        showSuccess(
          t('兑换成功：获得 {{usd}} 美元额度', { usd: res.data.data.usd.toFixed(4) }),
        );
        onRedeemed?.();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    }
    setRedeeming(false);
  };

  return (
    <div
      className='flex items-center justify-between rounded-lg px-4 py-3 mt-3'
      style={{ background: 'var(--semi-color-fill-0)' }}
    >
      <div>
        <Text strong>{t('当前得分')}：{Math.floor(score)}</Text>
        <Text type='secondary' className='block'>
          {t('可兑换')} ≈ ${usd}（{scorePerUnit} {t('分')} = 1 {t('额度')}）
        </Text>
      </div>
      <Button
        theme='solid'
        type='primary'
        loading={redeeming}
        disabled={score < scorePerUnit}
        onClick={redeem}
      >
        {score < scorePerUnit
          ? t('满 {{score}} 分可兑换', { score: scorePerUnit })
          : t('兑换为额度')}
      </Button>
    </div>
  );
};

const GameModal = ({ game, onClose, t }) => {
  if (!game) return null;
  const GameComponent = GAME_COMPONENTS[game.game_key];

  return (
    <SideSheet
      title={
        <Space>
          <Title heading={5} className='!m-0'>{game.name}</Title>
        </Space>
      }
      visible={!!game}
      onCancel={onClose}
      placement='right'
      width={720}
      bodyStyle={{ padding: 16, background: 'var(--semi-color-bg-0)' }}
      footer={null}
      headerExtraContent={
        <Button type='tertiary' onClick={onClose}>
          {t('关闭')}
        </Button>
      }
    >
      {GameComponent ? (
        <GameComponent t={t} />
      ) : (
        <Text type='secondary'>{t('游戏加载失败')}</Text>
      )}
    </SideSheet>
  );
};

export default GameModal;
