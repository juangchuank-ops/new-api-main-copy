/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect } from 'react';
import { Button, Typography } from '@douyinfe/semi-ui';
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
import GameHelpButton from './GameHelpButton';
import '../game-paper.css';

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
};

const GAME_META = {
  texas: '德州扑克',
  roulette: '恶魔轮盘',
  snake: '贪吃蛇',
  longnight: '漫漫长夜',
  g1024: '1024 TOKEN',
  tetris: '俄罗斯 TOKEN',
  stock: 'TOKEN股市',
  futures: 'TOKEN永续合约',
  goldminer: '黄金矿工',
  mining: 'TOKEN挖矿',
  roguelike: '肉鸽 NEON-PULSE',
};

const GameRoom = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { gameKey } = useParams();
  const GameComponent = GAME_COMPONENTS[gameKey];
  const gameIndex = Object.keys(GAME_COMPONENTS).indexOf(gameKey) + 1;
  const gameName = t(GAME_META[gameKey] || '');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [gameKey]);

  if (!GameComponent) {
    return (
      <div className='game-paper-page game-room'>
        <main className='game-paper-shell text-center'>
          <Text className='game-eyebrow'>{t('档案不存在')}</Text>
          <Title heading={4}>{t('未知游戏')}</Title>
          <Button className='mt-4' onClick={() => navigate('/game')}>
            {t('返回游戏大厅')}
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className='game-paper-page game-room'>
      <main className='game-paper-shell'>
        <header className='game-room__header'>
          <Button
            className='game-room__back'
            icon={<IconChevronLeft />}
            type='tertiary'
            aria-label={t('返回大厅')}
            onClick={() => navigate('/game')}
          />
          <div className='game-room__title'>
            <Text className='game-room__folio'>
              ARCADE FILE / {String(gameIndex).padStart(2, '0')} / {gameKey}
            </Text>
            <div className='game-room__title-row'>
              <Title heading={4} className='!m-0'>
                {gameName}
              </Title>
              <GameHelpButton gameKey={gameKey} gameName={gameName} t={t} />
            </div>
          </div>
          <Text className='game-room__annotation'>{t('game in progress')}</Text>
        </header>
        <section className='game-room__stage'>
          <GameComponent t={t} fullScreen />
        </section>
      </main>
    </div>
  );
};

export default GameRoom;
