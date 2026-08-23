import React, { useEffect } from 'react';
import { Button, Typography, Space } from '@douyinfe/semi-ui';
import { IconChevronLeft } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
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
import GameHelpButton from './GameHelpButton';

const { Title, Text } = Typography;

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

const GAME_META = {
  texas: '德州扑克', roulette: '恶魔轮盘', snake: '贪吃蛇', longnight: '漫漫长夜',
  g1024: '1024 TOKEN', tetris: '俄罗斯 TOKEN', stock: 'TOKEN股市', futures: 'TOKEN永续合约',
  goldminer: '黄金矿工', mining: 'TOKEN挖矿', roguelike: '肉鸽 NEON-PULSE', match3: '消消乐',
};

// 全屏游戏室：游戏以整页呈现
const GameRoom = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { gameKey } = useParams();
  const GameComponent = GAME_COMPONENTS[gameKey];

  useEffect(() => {
    // 游戏页面滚动到顶
    window.scrollTo(0, 0);
  }, [gameKey]);

  if (!GameComponent) {
    return (
      <div className='mt-[70px] px-4 py-10 text-center'>
        <Title heading={4}>{t('未知游戏')}</Title>
        <Button className='mt-4' onClick={() => navigate('/game')}>{t('返回游戏大厅')}</Button>
      </div>
    );
  }

  return (
    <div className='min-h-screen' style={{ background: 'var(--semi-color-bg-0)' }}>
      {/* 顶部栏：与站点导航留空 */}
      <div className='pt-[70px] px-4 pb-4 max-w-5xl mx-auto'>
        <Space>
          <Button
            icon={<IconChevronLeft />}
            type='tertiary'
            onClick={() => navigate('/game')}
          >
            {t('返回大厅')}
          </Button>
          <div className='inline-flex items-center gap-2'>
            <Title heading={4} className='!m-0'>
              {t(GAME_META[gameKey] || '')}
            </Title>
            <GameHelpButton
              gameKey={gameKey}
              gameName={t(GAME_META[gameKey] || '')}
              t={t}
            />
          </div>
        </Space>
      </div>
      <div className='px-4 pb-16 max-w-5xl mx-auto'>
        <GameComponent t={t} fullScreen />
      </div>
    </div>
  );
};

export default GameRoom;
