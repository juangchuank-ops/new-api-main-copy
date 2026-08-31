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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconRefresh, IconSave, IconUndo } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Blocks,
  ChartCandlestick,
  CircleDot,
  Flame,
  Gamepad2,
  Gem,
  Grid3X3,
  Pickaxe,
  ScanLine,
  Spade,
  TrendingUp,
  Worm,
} from 'lucide-react';
import { API, showError, showSuccess } from '../../helpers';
import { isRoot } from '../../helpers/utils';
import GameHelpButton from './components/GameHelpButton';
import './game-paper.css';

const { Text, Title } = Typography;

const GAME_ICONS = {
  texas: Spade,
  roulette: CircleDot,
  snake: Worm,
  longnight: Flame,
  g1024: Grid3X3,
  tetris: Blocks,
  stock: ChartCandlestick,
  futures: TrendingUp,
  goldminer: Gem,
  mining: Pickaxe,
  roguelike: ScanLine,
};

const getExchangeLabel = (gameKey, t) => {
  if (gameKey === 'stock' || gameKey === 'futures') return t('真实额度交易');
  if (gameKey === 'roguelike') return t('100000 分 = 1 额度');
  return t('1000 分 = 1 额度');
};

const Game = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [adminMode, setAdminMode] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftStatuses, setDraftStatuses] = useState({});
  const [saving, setSaving] = useState(false);

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/user/game/list');
      if (res.data.success) {
        const data = res.data.data || [];
        setGames(data);
        setDraftTitle(data[0]?.page_title || '纸上游乐场');
        setDraftStatuses(
          Object.fromEntries(data.map((game) => [game.game_key, game.status])),
        );
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(error.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const canAdmin = isRoot();
  const availableCount = games.filter(
    (game) => game.status === 'available',
  ).length;

  const hasUnsavedChanges = useMemo(() => {
    if (!adminMode) return false;
    if ((games[0]?.page_title || '纸上游乐场') !== draftTitle) return true;
    return games.some((game) => draftStatuses[game.game_key] !== game.status);
  }, [adminMode, games, draftTitle, draftStatuses]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: draftTitle.trim() || '纸上游乐场',
        games: games.map((game) => ({
          game_key: game.game_key,
          name: game.name,
          description: game.description,
          status: draftStatuses[game.game_key] || game.status,
          sort_order: game.sort_order,
        })),
      };
      const res = await API.post('/api/user/game/manage', payload);
      if (res.data.success) {
        showSuccess(t('保存成功'));
        const data = res.data.data || [];
        setGames(data);
        setDraftTitle(data[0]?.page_title || '纸上游乐场');
        setDraftStatuses(
          Object.fromEntries(data.map((game) => [game.game_key, game.status])),
        );
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(error.message);
    }
    setSaving(false);
  };

  const handleDiscard = () => {
    setDraftTitle(games[0]?.page_title || '纸上游乐场');
    setDraftStatuses(
      Object.fromEntries(games.map((game) => [game.game_key, game.status])),
    );
  };

  return (
    <div className='game-paper-page game-lobby relative mt-[60px]'>
      {adminMode && hasUnsavedChanges && (
        <div className='game-unsaved-wrap sticky top-[60px] z-40'>
          <div className='game-unsaved-banner flex items-center justify-between gap-3'>
            <Text strong>{t('有操作未保存')}</Text>
            <Space>
              <Button size='small' icon={<IconUndo />} onClick={handleDiscard}>
                {t('取消')}
              </Button>
              <Button
                size='small'
                theme='solid'
                type='warning'
                icon={<IconSave />}
                loading={saving}
                onClick={handleSave}
              >
                {t('保存')}
              </Button>
            </Space>
          </div>
        </div>
      )}

      <main className='game-paper-shell'>
        <section className='game-masthead'>
          <div className='game-masthead__copy'>
            <Text className='game-eyebrow'>{t('游戏档案 · ARCADE INDEX')}</Text>
            <div className='game-masthead__title-row'>
              <Title heading={3} className='!m-0'>
                {adminMode ? (
                  <Input
                    value={draftTitle}
                    onChange={setDraftTitle}
                    className='game-title-input'
                    maxLength={40}
                  />
                ) : (
                  games[0]?.page_title || t('纸上游乐场')
                )}
              </Title>
              <Text className='game-handnote'>
                {t('play, collect, redeem')}
              </Text>
            </div>
            <Text type='secondary' className='game-masthead__description'>
              {t(
                '普通计分游戏 1000 分 = 1 额度 · NEON-PULSE 100000 分 = 1 额度',
              )}
            </Text>
          </div>
          <div className='game-masthead__tools'>
            <div className='game-summary' aria-label={t('游戏概览')}>
              <div className='game-summary__item'>
                <span>{t('收录')}</span>
                <strong>{String(games.length).padStart(2, '0')}</strong>
              </div>
              <div className='game-summary__item'>
                <span>{t('上线')}</span>
                <strong>{String(availableCount).padStart(2, '0')}</strong>
              </div>
            </div>
            <Space className='game-toolbar'>
              {canAdmin && (
                <Button
                  theme={adminMode ? 'solid' : 'light'}
                  type={adminMode ? 'warning' : 'primary'}
                  onClick={() => setAdminMode((value) => !value)}
                >
                  {adminMode ? t('退出管理模式') : t('进入管理模式')}
                </Button>
              )}
              <Button
                icon={<IconRefresh />}
                onClick={loadGames}
                loading={loading}
              >
                {t('刷新')}
              </Button>
            </Space>
          </div>
        </section>

        <div className='game-section-heading'>
          <Text className='game-eyebrow'>{t('可用游戏')}</Text>
          <span />
          <Text type='tertiary' className='game-section-heading__count'>
            {availableCount} / {games.length}
          </Text>
        </div>

        {loading ? (
          <div className='game-loading flex justify-center py-20'>
            <Spin size='large' />
          </div>
        ) : (
          <div className='game-paper-grid'>
            {games.map((game, index) => {
              const isAvailable = adminMode
                ? true
                : game.status === 'available';
              const GameIcon = GAME_ICONS[game.game_key] || Gamepad2;
              return (
                <Card
                  key={game.game_key}
                  className={`game-paper-card game-paper-card--tilt-${(index % 3) + 1}`}
                  style={{ opacity: isAvailable ? 1 : 0.58 }}
                >
                  <div className='game-card__folio flex items-center justify-between'>
                    <Text type='tertiary' size='small' className='game-mono'>
                      NO. {String(game.sort_order).padStart(2, '0')}
                    </Text>
                    {adminMode ? (
                      <Select
                        size='small'
                        value={draftStatuses[game.game_key]}
                        onChange={(value) =>
                          setDraftStatuses((previous) => ({
                            ...previous,
                            [game.game_key]: value,
                          }))
                        }
                        optionList={[
                          { value: 'available', label: t('已上线') },
                          { value: 'unreleased', label: t('未上线') },
                        ]}
                        style={{ width: 100 }}
                      />
                    ) : (
                      <Tag
                        color={isAvailable ? 'green' : 'grey'}
                        shape='circle'
                      >
                        {isAvailable ? t('已上线') : t('未上线')}
                      </Tag>
                    )}
                  </div>
                  <div className='game-card__identity'>
                    <div className='game-card__icon' aria-hidden='true'>
                      <GameIcon size={23} strokeWidth={1.6} />
                    </div>
                    <div className='game-card__title'>
                      <div className='inline-flex items-center gap-2'>
                        <Title heading={5} className='!m-0'>
                          {game.name}
                        </Title>
                        <GameHelpButton
                          gameKey={game.game_key}
                          gameName={game.name}
                          t={t}
                        />
                      </div>
                      <Text className='game-card__key game-mono'>
                        {game.game_key}
                      </Text>
                    </div>
                  </div>
                  <Text
                    type='secondary'
                    size='small'
                    className='game-card__description'
                  >
                    {game.description}
                  </Text>
                  <div className='game-card__meta'>
                    <span>{t('兑换')}</span>
                    <strong>{getExchangeLabel(game.game_key, t)}</strong>
                  </div>
                  <Button
                    theme='solid'
                    type='primary'
                    disabled={!isAvailable}
                    block
                    onClick={() => navigate(`/game/${game.game_key}`)}
                  >
                    {isAvailable ? t('开始游戏') : t('暂未开放')}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Game;
