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

import React from 'react';
import { Card, Tabs, TabPane } from '@douyinfe/semi-ui';
import { PieChart } from 'lucide-react';
import { VChart } from '@visactor/react-vchart';
import VChartErrorBoundary from '../common/VChartErrorBoundary';
import { ensureVChartBrowserEnv } from '../../helpers/vchart-env';

const ChartsPanel = ({
  activeChartTab,
  setActiveChartTab,
  spec_line,
  spec_model_line,
  spec_pie,
  spec_rank_bar,
  spec_user_rank,
  spec_user_trend,
  isAdminUser,
  CARD_PROPS,
  CHART_CONFIG,
  FLEX_CENTER_GAP2,
  hasApiInfoPanel,
  t,
}) => {
  // VChart browser env 必须在首次渲染 VChart 组件前注册
  ensureVChartBrowserEnv();
  return (
    <Card
      {...CARD_PROPS}
      className={`!rounded-2xl ${hasApiInfoPanel ? 'lg:col-span-3' : ''}`}
      title={
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-3'>
          <div className={FLEX_CENTER_GAP2}>
            <PieChart size={16} />
            {t('模型数据分析')}
          </div>
          <Tabs
            type='slash'
            activeKey={activeChartTab}
            onChange={setActiveChartTab}
          >
            <TabPane tab={<span>{t('消耗分布')}</span>} itemKey='1' />
            <TabPane tab={<span>{t('调用趋势')}</span>} itemKey='2' />
            <TabPane tab={<span>{t('调用次数分布')}</span>} itemKey='3' />
            <TabPane tab={<span>{t('调用次数排行')}</span>} itemKey='4' />
            {isAdminUser && (
              <TabPane tab={<span>{t('用户消耗排行')}</span>} itemKey='5' />
            )}
            {isAdminUser && (
              <TabPane tab={<span>{t('用户消耗趋势')}</span>} itemKey='6' />
            )}
          </Tabs>
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <div className='h-96 p-2'>
        {activeChartTab === '1' && (
          <VChartErrorBoundary><VChart spec={spec_line} option={CHART_CONFIG} /></VChartErrorBoundary>
        )}
        {activeChartTab === '2' && (
          <VChartErrorBoundary><VChart spec={spec_model_line} option={CHART_CONFIG} /></VChartErrorBoundary>
        )}
        {activeChartTab === '3' && (
          <VChartErrorBoundary><VChart spec={spec_pie} option={CHART_CONFIG} /></VChartErrorBoundary>
        )}
        {activeChartTab === '4' && (
          <VChartErrorBoundary><VChart spec={spec_rank_bar} option={CHART_CONFIG} /></VChartErrorBoundary>
        )}
        {activeChartTab === '5' && isAdminUser && (
          <VChartErrorBoundary><VChart spec={spec_user_rank} option={CHART_CONFIG} /></VChartErrorBoundary>
        )}
        {activeChartTab === '6' && isAdminUser && (
          <VChartErrorBoundary><VChart spec={spec_user_trend} option={CHART_CONFIG} /></VChartErrorBoundary>
        )}
      </div>
    </Card>
  );
};

export default ChartsPanel;
