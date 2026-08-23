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

import React, { useEffect, useMemo, useState } from 'react';
import { Input, Layout, TabPane, Tabs, Typography } from '@douyinfe/semi-ui';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Calculator,
  Gauge,
  Shapes,
  Cog,
  MoreHorizontal,
  LayoutDashboard,
  MessageSquare,
  Palette,
  CreditCard,
  Server,
  Activity,
  Search,
} from 'lucide-react';

const { Text } = Typography;

const SETTING_SEARCH_ITEMS = [
  { tab: 'operation', group: '运营设置', label: '通用设置', keywords: '站点 运营 通用' },
  { tab: 'operation', group: '运营设置', label: '额度设置', keywords: '额度 余额 credit' },
  { tab: 'operation', group: '运营设置', label: '日志设置', keywords: '日志 log' },
  { tab: 'operation', group: '运营设置', label: '监控设置', keywords: '监控 monitoring' },
  { tab: 'operation', group: '运营设置', label: '屏蔽词过滤设置', keywords: '敏感词 屏蔽词 过滤' },
  { tab: 'operation', group: '运营设置', label: '签到设置', keywords: '签到 checkin' },
  { tab: 'operation', group: '运营设置', label: '渠道亲和性', keywords: '渠道 亲和' },
  { tab: 'operation', group: '运营设置', label: 'Auto Sync 自动同步', keywords: '同步 autosync' },
  { tab: 'dashboard', group: '仪表盘设置', label: '数据看板设置', keywords: '仪表盘 数据 看板' },
  { tab: 'dashboard', group: '仪表盘设置', label: '公告设置', keywords: '公告 announcement' },
  { tab: 'dashboard', group: '仪表盘设置', label: '常见问题设置', keywords: 'FAQ 常见问题' },
  { tab: 'dashboard', group: '仪表盘设置', label: 'API 信息设置', keywords: 'API 信息' },
  { tab: 'chats', group: '聊天设置', label: '聊天设置', keywords: '聊天 chat' },
  { tab: 'drawing', group: '绘图设置', label: '绘图设置', keywords: '绘图 drawing' },
  { tab: 'payment', group: '支付设置', label: '支付方式设置', keywords: '支付 充值 网关' },
  { tab: 'payment', group: '支付设置', label: 'Stripe 支付设置', keywords: '支付 Stripe' },
  { tab: 'payment', group: '支付设置', label: 'Creem 支付设置', keywords: '支付 Creem' },
  { tab: 'ratio', group: '分组与模型定价设置', label: '分组相关设置', keywords: '分组 分组管理 自动分组 分组倍率 可用分组' },
  { tab: 'ratio', group: '分组与模型定价设置', label: '模型定价设置', keywords: '模型 定价 倍率 价格' },
  { tab: 'ratio', group: '分组与模型定价设置', label: '工具调用定价设置', keywords: '工具 定价' },
  { tab: 'ratelimit', group: '速率限制设置', label: '模型请求速率限制', keywords: '速率 限流 请求 RPM' },
  { tab: 'models', group: '模型相关设置', label: '全局设置', keywords: '模型 全局' },
  { tab: 'models', group: '模型相关设置', label: 'Claude 设置', keywords: '模型 Claude' },
  { tab: 'models', group: '模型相关设置', label: 'Gemini 设置', keywords: '模型 Gemini 思考' },
  { tab: 'models', group: '模型相关设置', label: 'Grok 设置', keywords: '模型 Grok' },
  { tab: 'model-deployment', group: '模型部署设置', label: '模型部署设置', keywords: '模型 部署' },
  { tab: 'performance', group: '性能设置', label: '磁盘缓存设置（磁盘换内存）', keywords: '性能 缓存 磁盘 内存' },
  { tab: 'performance', group: '性能设置', label: '系统性能监控', keywords: '性能 监控 系统' },
  { tab: 'performance', group: '性能设置', label: '服务器日志管理', keywords: '服务器 日志' },
  { tab: 'system', group: '系统设置', label: '通用设置', keywords: '系统 通用' },
  { tab: 'system', group: '系统设置', label: '代理设置', keywords: '系统 代理 proxy' },
  { tab: 'system', group: '系统设置', label: 'SSRF 防护设置', keywords: '系统 SSRF 防护' },
  { tab: 'system', group: '系统设置', label: '配置登录注册', keywords: '登录 注册' },
  { tab: 'system', group: '系统设置', label: '配置 Passkey', keywords: '登录 Passkey' },
  { tab: 'system', group: '系统设置', label: '配置邮箱域名白名单', keywords: '邮箱 域名 白名单' },
  { tab: 'system', group: '系统设置', label: '配置 SMTP', keywords: '邮箱 SMTP' },
  { tab: 'system', group: '系统设置', label: '配置 OIDC', keywords: '登录 OIDC OAuth' },
  { tab: 'system', group: '系统设置', label: '配置 GitHub OAuth App', keywords: '登录 GitHub OAuth' },
  { tab: 'system', group: '系统设置', label: '配置 Discord OAuth', keywords: '登录 Discord OAuth' },
  { tab: 'system', group: '系统设置', label: '配置 Linux DO OAuth', keywords: '登录 LinuxDO OAuth' },
  { tab: 'system', group: '系统设置', label: '配置 WeChat Server', keywords: '登录 微信 WeChat' },
  { tab: 'system', group: '系统设置', label: '配置 Telegram 登录', keywords: '登录 Telegram' },
  { tab: 'system', group: '系统设置', label: '配置 Turnstile', keywords: '验证 Turnstile' },
  { tab: 'other', group: '其他设置', label: '系统信息', keywords: '其他 系统 信息' },
  { tab: 'other', group: '其他设置', label: '个性化设置', keywords: '其他 个性化' },
];

import SystemSetting from '../../components/settings/SystemSetting';
import { isRoot } from '../../helpers';
import OtherSetting from '../../components/settings/OtherSetting';
import OperationSetting from '../../components/settings/OperationSetting';
import RateLimitSetting from '../../components/settings/RateLimitSetting';
import ModelSetting from '../../components/settings/ModelSetting';
import DashboardSetting from '../../components/settings/DashboardSetting';
import RatioSetting from '../../components/settings/RatioSetting';
import ChatsSetting from '../../components/settings/ChatsSetting';
import DrawingSetting from '../../components/settings/DrawingSetting';
import PaymentSetting from '../../components/settings/PaymentSetting';
import ModelDeploymentSetting from '../../components/settings/ModelDeploymentSetting';
import PerformanceSetting from '../../components/settings/PerformanceSetting';

const Setting = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [tabActiveKey, setTabActiveKey] = useState('1');
  const [settingSearch, setSettingSearch] = useState('');
  let panes = [];

  if (isRoot()) {
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Settings size={18} />
          {t('运营设置')}
        </span>
      ),
      content: <OperationSetting />,
      itemKey: 'operation',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <LayoutDashboard size={18} />
          {t('仪表盘设置')}
        </span>
      ),
      content: <DashboardSetting />,
      itemKey: 'dashboard',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <MessageSquare size={18} />
          {t('聊天设置')}
        </span>
      ),
      content: <ChatsSetting />,
      itemKey: 'chats',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Palette size={18} />
          {t('绘图设置')}
        </span>
      ),
      content: <DrawingSetting />,
      itemKey: 'drawing',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <CreditCard size={18} />
          {t('支付设置')}
        </span>
      ),
      content: <PaymentSetting />,
      itemKey: 'payment',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Calculator size={18} />
          {t('分组与模型定价设置')}
        </span>
      ),
      content: <RatioSetting />,
      itemKey: 'ratio',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Gauge size={18} />
          {t('速率限制设置')}
        </span>
      ),
      content: <RateLimitSetting />,
      itemKey: 'ratelimit',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Shapes size={18} />
          {t('模型相关设置')}
        </span>
      ),
      content: <ModelSetting />,
      itemKey: 'models',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Server size={18} />
          {t('模型部署设置')}
        </span>
      ),
      content: <ModelDeploymentSetting />,
      itemKey: 'model-deployment',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Activity size={18} />
          {t('性能设置')}
        </span>
      ),
      content: <PerformanceSetting />,
      itemKey: 'performance',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Cog size={18} />
          {t('系统设置')}
        </span>
      ),
      content: <SystemSetting />,
      itemKey: 'system',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <MoreHorizontal size={18} />
          {t('其他设置')}
        </span>
      ),
      content: <OtherSetting />,
      itemKey: 'other',
    });
  }
  const onChangeTab = (key) => {
    setTabActiveKey(key);
    navigate(`?tab=${key}`);
  };
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tab = searchParams.get('tab');
    if (tab) {
      setTabActiveKey(tab);
    } else {
      onChangeTab('operation');
    }
  }, [location.search]);
  const normalizedSearch = settingSearch.trim().toLocaleLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];
    return SETTING_SEARCH_ITEMS.filter((item) =>
      `${item.group} ${item.label} ${item.keywords}`.toLocaleLowerCase().includes(normalizedSearch),
    ).slice(0, 8);
  }, [normalizedSearch]);

  const onSelectSearchResult = (item) => {
    onChangeTab(item.tab);
    setSettingSearch('');
  };

  return (
    <div className='mt-[60px] px-2'>
      <div style={{ marginBottom: 18, position: 'relative', zIndex: 20 }}>
        <Input
          prefix={(
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 42,
                height: 40,
                marginTop: -1,
                marginBottom: -1,
                marginLeft: -12,
                marginRight: 10,
                lineHeight: 0,
                borderRight: '1px solid var(--semi-color-border)',
                boxSizing: 'border-box',
              }}
            >
              <Search size={18} />
            </span>
          )}
          value={settingSearch}
          onChange={setSettingSearch}
          placeholder={t('搜索系统设置功能')}
          showClear
          size='large'
          aria-label={t('搜索系统设置功能')}
          style={{ width: '100%' }}
        />
        {normalizedSearch && (
          <div
            style={{
              border: '1px solid var(--semi-color-border)',
              borderTop: 0,
              background: 'var(--semi-color-bg-0)',
              padding: '10px 12px 8px',
            }}
          >
            <Text type='secondary' size='small' className='block mb-2'>
              {t('搜索')}: {settingSearch.trim()}
            </Text>
            <div style={{ border: '1px solid var(--semi-color-border)' }}>
              {searchResults.map((item, index) => (
                <button
                  type='button'
                  key={`${item.tab}-${item.label}`}
                  onClick={() => onSelectSearchResult(item)}
                  style={{
                    width: '100%',
                    minHeight: 46,
                    padding: '8px 12px',
                    border: 0,
                    borderBottom: index < searchResults.length - 1 ? '1px solid var(--semi-color-border)' : 0,
                    background: index % 2 === 0 ? 'var(--semi-color-fill-0)' : 'var(--semi-color-bg-0)',
                    color: 'var(--semi-color-text-0)',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <Text type='secondary' size='small' className='block'>{t(item.group)}</Text>
                  <Text>{t(item.label)}</Text>
                </button>
              ))}
              {searchResults.length === 0 && (
                <div style={{ minHeight: 46, padding: '12px', background: 'var(--semi-color-fill-0)' }}>
                  <Text type='secondary'>{t('未搜索到匹配的设置功能')}</Text>
                </div>
              )}
            </div>
            <Text type='tertiary' size='small' className='block mt-2'>
              {t('暂未搜索到更多')}
            </Text>
          </div>
        )}
      </div>
      <Layout>
        <Layout.Content>
          <Tabs
            type='card'
            collapsible
            activeKey={tabActiveKey}
            onChange={(key) => onChangeTab(key)}
          >
            {panes.map((pane) => (
              <TabPane itemKey={pane.itemKey} tab={pane.tab} key={pane.itemKey}>
                {tabActiveKey === pane.itemKey && pane.content}
              </TabPane>
            ))}
          </Tabs>
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default Setting;
