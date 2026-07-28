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

import React, { useEffect, useMemo } from 'react';
import { Empty, Typography } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { initVChartSemiTheme } from '@visactor/vchart-semi-theme';
import { HeartPulse, Timer } from 'lucide-react';

import VChartErrorBoundary from '../../../../common/VChartErrorBoundary';
import { CHART_CONFIG } from '../../../../../constants/dashboard.constants';
import { ensureVChartBrowserEnv } from '../../../../../helpers/vchart-env';

const { Text } = Typography;

const formatLatency = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
};

const TrendChart = ({ title, description, icon: Icon, spec, emptyText }) => (
  <section
    className='overflow-hidden rounded-lg border'
    style={{
      borderColor: 'var(--semi-color-border)',
      background: 'var(--semi-color-bg-0)',
    }}
  >
    <div className='flex items-start gap-2 px-4 pt-4'>
      <Icon
        aria-hidden='true'
        size={16}
        className='mt-0.5 shrink-0'
        color='var(--semi-color-text-2)'
      />
      <div className='min-w-0'>
        <Text strong className='block text-sm'>
          {title}
        </Text>
        <Text type='tertiary' size='small' className='block mt-1'>
          {description}
        </Text>
      </div>
    </div>
    <div className='h-64 sm:h-72 px-2 pb-2 pt-1'>
      {spec ? (
        <VChartErrorBoundary
          fallback={
            <div className='flex h-full items-center justify-center'>
              <Empty description={emptyText} />
            </div>
          }
        >
          <VChart spec={spec} option={CHART_CONFIG} />
        </VChartErrorBoundary>
      ) : (
        <div className='flex h-full items-center justify-center'>
          <Empty description={emptyText} />
        </div>
      )}
    </div>
  </section>
);

const ModelPerformanceCharts = ({ latencySeries, availabilitySeries, t }) => {
  ensureVChartBrowserEnv();

  useEffect(() => {
    initVChartSemiTheme({ isWatchingThemeSwitch: true });
  }, []);

  const latencySpec = useMemo(() => {
    if (latencySeries.length === 0) return null;

    return {
      type: 'line',
      data: [{ id: 'latency', values: latencySeries }],
      xField: 'time',
      yField: 'value',
      color: '#5b7cfa',
      padding: { top: 16, right: 16, bottom: 8, left: 8 },
      line: { style: { lineWidth: 2 } },
      point: {
        visible: true,
        style: { size: 5, lineWidth: 1.5, stroke: '#ffffff' },
      },
      legends: { visible: false },
      axes: [
        {
          orient: 'bottom',
          label: { visible: true, space: 8 },
          tick: { visible: false },
        },
        {
          orient: 'left',
          label: {
            visible: true,
            formatMethod: (value) => `${Math.round(value)} ms`,
          },
          grid: {
            visible: true,
            style: { lineDash: [3, 3], strokeOpacity: 0.45 },
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum.time,
              value: (datum) => formatLatency(datum.value),
            },
          ],
        },
      },
    };
  }, [latencySeries]);

  const availabilitySpec = useMemo(() => {
    if (availabilitySeries.length === 0) return null;

    return {
      type: 'line',
      data: [{ id: 'availability', values: availabilitySeries }],
      xField: 'time',
      yField: 'value',
      color: '#10b981',
      padding: { top: 16, right: 16, bottom: 8, left: 8 },
      line: { style: { lineWidth: 2 } },
      point: {
        visible: true,
        style: { size: 5, lineWidth: 1.5, stroke: '#ffffff' },
      },
      legends: { visible: false },
      axes: [
        {
          orient: 'bottom',
          label: { visible: true, space: 8 },
          tick: { visible: false },
        },
        {
          orient: 'left',
          min: 0,
          max: 100,
          label: {
            visible: true,
            formatMethod: (value) => `${Math.round(value)}%`,
          },
          grid: {
            visible: true,
            style: { lineDash: [3, 3], strokeOpacity: 0.45 },
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum.time,
              value: (datum) => `${datum.value.toFixed(2)}%`,
            },
          ],
        },
      },
    };
  }, [availabilitySeries]);

  return (
    <div className='flex flex-col gap-4'>
      <TrendChart
        title={t('延迟趋势（最近 24 小时）')}
        description={t('平均首 Token 延迟')}
        icon={Timer}
        spec={latencySpec}
        emptyText={t('暂无数据')}
      />
      <TrendChart
        title={t('可用性（最近 24 小时）')}
        description={t('最近 24 小时请求成功率采样')}
        icon={HeartPulse}
        spec={availabilitySpec}
        emptyText={t('暂无数据')}
      />
    </div>
  );
};

export default ModelPerformanceCharts;
