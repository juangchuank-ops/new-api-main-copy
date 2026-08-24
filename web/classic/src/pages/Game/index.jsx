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
import { Button, Card, Input, Select, Space, Spin, Tag, Typography } from '@douyinfe/semi-ui';
import { IconRefresh, IconSave, IconUndo } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { API, showError, showSuccess } from '../../helpers';
import { isRoot } from '../../helpers/utils';
import GameHelpButton from './components/GameHelpButton';
import './game-theme.css';

const { Text, Title } = Typography;

const Game = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [adminMode, setAdminMode] = useState(false);
  // 管理模式下的草稿（标题 + 各游戏状态），保存前只存在本地
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
          Object.fromEntries(data.map((g) => [g.game_key, g.status])),
        );
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const canAdmin = isRoot();

  // 未保存变更检测：标题或任一状态与服务器不一致
  const hasUnsavedChanges = useMemo(() => {
    if (!adminMode) return false;
    if ((games[0]?.page_title || '纸上游乐场') !== draftTitle) return true;
    return games.some((g) => draftStatuses[g.game_key] !== g.status);
  }, [adminMode, games, draftTitle, draftStatuses]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: draftTitle.trim() || '纸上游乐场',
        games: games.map((g) => ({
          game_key: g.game_key,
          name: g.name,
          description: g.description,
          status: draftStatuses[g.game_key] || g.status,
          sort_order: g.sort_order,
        })),
      };
      const res = await API.post('/api/user/game/manage', payload);
      if (res.data.success) {
        showSuccess(t('保存成功'));
        const data = res.data.data || [];
        setGames(data);
        setDraftTitle(data[0]?.page_title || '纸上游乐场');
        setDraftStatuses(
          Object.fromEntries(data.map((g) => [g.game_key, g.status])),
        );
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    }
    setSaving(false);
  };

  const handleDiscard = () => {
    setDraftTitle(games[0]?.page_title || '纸上游乐场');
    setDraftStatuses(
      Object.fromEntries(games.map((g) => [g.game_key, g.status])),
    );
  };

  return (
    <div className='game-page relative mt-[60px] px-2'>
      {/* 未保存横幅：离导航栏留一点空 */}
      {adminMode && hasUnsavedChanges && (
        <div className='sticky top-[60px] z-40 mb-4'>
          <div
            className='flex items-center justify-between rounded-lg border px-4 py-2'
            style={{
              background: 'var(--semi-color-warning-light-default)',
              borderColor: 'var(--semi-color-warning)',
            }}
          >
            <Text strong style={{ color: 'var(--semi-color-warning)' }}>
              {t('有操作未保存')}
            </Text>
            <Space>
              <Button
                size='small'
                icon={<IconUndo />}
                onClick={handleDiscard}
              >
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

      <div className='pb-8'>
        <Card className='game-page__masthead mb-4'>
          <div className='flex items-center justify-between flex-wrap gap-3'>
            <div className='game-page__heading'>
              <Title heading={3} className='!m-0'>
                {adminMode ? (
                  <Input
                    value={draftTitle}
                    onChange={setDraftTitle}
                    style={{ width: 260 }}
                    maxLength={40}
                  />
                ) : (
                  games[0]?.page_title || t('纸上游乐场')
                )}
              </Title>
              <Text type='secondary' className='game-page__motto'>
                {t('𝔚𝔢𝔢𝔭 𝔴𝔦𝔱𝔥 𝔪𝔢, 𝔞𝔫𝔡 𝔴𝔞𝔦𝔩 𝔴𝔦𝔱𝔥 𝔪𝔢')}
              </Text>
              <Text type='secondary' className='game-page__exchange'>
                {t('普通计分游戏 1000 分 = 1 额度 · NEON-PULSE 10000 分 = 1 额度')}
              </Text>
            </div>
            <Space>
              {canAdmin && (
                <Button
                  theme={adminMode ? 'solid' : 'light'}
                  type={adminMode ? 'warning' : 'primary'}
                  onClick={() => setAdminMode((v) => !v)}
                >
                  {adminMode ? t('退出管理模式') : t('进入管理模式')}
                </Button>
              )}
              <Button icon={<IconRefresh />} onClick={loadGames} loading={loading}>
                {t('刷新')}
              </Button>
            </Space>
          </div>
        </Card>

        {loading ? (
          <div className='flex justify-center py-20'>
            <Spin size='large' />
          </div>
        ) : (
          <div className='grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {games.map((game) => {
              const isAvailable = adminMode
                ? true
                : game.status === 'available';
              return (
                <Card
                  key={game.game_key}
                  className='game-card'
                  style={{
                    opacity: isAvailable ? 1 : 0.55,
                    border: '1px solid var(--semi-color-border)',
                  }}
                >
                  <div className='flex items-center justify-between mb-2'>
                    <Text type='tertiary' size='small'>
                      NO. {String(game.sort_order).padStart(2, '0')}
                    </Text>
                    {adminMode ? (
                      <Select
                        size='small'
                        value={draftStatuses[game.game_key]}
                        onChange={(v) =>
                          setDraftStatuses((prev) => ({
                            ...prev,
                            [game.game_key]: v,
                          }))
                        }
                        optionList={[
                          { value: 'available', label: t('已上线') },
                          { value: 'unreleased', label: t('未上线') },
                        ]}
                        style={{ width: 100 }}
                      />
                    ) : (
                      <Tag color={isAvailable ? 'green' : 'grey'} shape='circle'>
                        {isAvailable ? t('已上线') : t('未上线')}
                      </Tag>
                    )}
                  </div>
                  <div className='inline-flex items-center gap-2 mb-1'>
                    <Title heading={5} className='!m-0'>
                      {game.name}
                    </Title>
                    <GameHelpButton
                      gameKey={game.game_key}
                      gameName={game.name}
                      t={t}
                    />
                  </div>
                  <Text type='secondary' size='small' className='block mb-3' style={{ minHeight: 32 }}>
                    {game.description}
                  </Text>
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
      </div>
    </div>
  );
};

export default Game;
