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
import { Button, Empty, Spin, Table, Tag, Typography } from '@douyinfe/semi-ui';
import { Activity, Clock3, Gauge, HeartPulse, Timer } from 'lucide-react';

import { API } from '../../../../../helpers';
import ModelPerformanceCharts from './ModelPerformanceCharts';

const { Text } = Typography;

const formatThroughput = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K t/s`;
  return `${value.toFixed(value < 10 ? 2 : 1)} t/s`;
};

const formatLatency = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
};

const formatSuccessRate = (value) => {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(2)}%`;
};

const averageValues = (groups, field, includeZero = false) => {
  const values = groups
    .map((group) => Number(group[field]))
    .filter((value) => Number.isFinite(value) && (includeZero || value > 0));
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const aggregateSeries = (groups, field, includeZero = false) => {
  const valuesByTimestamp = new Map();

  groups.forEach((group) => {
    const series = Array.isArray(group.series) ? group.series : [];
    series.forEach((point) => {
      const timestamp = Number(point.ts);
      const value = Number(point[field]);
      if (
        !Number.isFinite(timestamp) ||
        !Number.isFinite(value) ||
        (!includeZero && value <= 0)
      ) {
        return;
      }

      const timestampValues = valuesByTimestamp.get(timestamp) || [];
      timestampValues.push(value);
      valuesByTimestamp.set(timestamp, timestampValues);
    });
  });

  return Array.from(valuesByTimestamp.entries())
    .sort(([left], [right]) => left - right)
    .map(([timestamp, values]) => ({
      time: new Date(timestamp * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: values.reduce((sum, value) => sum + value, 0) / values.length,
    }));
};

const getSuccessRateColor = (value) => {
  if (!Number.isFinite(value)) return 'var(--semi-color-text-2)';
  if (value >= 90) return 'var(--semi-color-success)';
  if (value >= 70) return 'var(--semi-color-warning)';
  return 'var(--semi-color-danger)';
};

const StatCard = ({ icon: Icon, label, value, hint, valueColor }) => (
  <div
    className='flex min-h-32 min-w-0 flex-col rounded-lg border p-3'
    style={{
      borderColor: 'var(--semi-color-border)',
      background: 'var(--semi-color-bg-0)',
    }}
  >
    <div className='flex min-w-0 items-center gap-1.5'>
      <Icon
        aria-hidden='true'
        size={14}
        className='shrink-0'
        color='var(--semi-color-text-2)'
      />
      <Text type='tertiary' size='small' className='truncate font-medium'>
        {label}
      </Text>
    </div>
    <div
      className='mt-2 break-words font-mono text-2xl font-semibold tabular-nums'
      style={{ color: valueColor || 'var(--semi-color-text-0)' }}
    >
      {value}
    </div>
    {hint && (
      <Text type='tertiary' size='small' className='mt-auto pt-2 leading-5'>
        {hint}
      </Text>
    )}
  </div>
);

const ModelPerformance = ({ modelData, isActive, t }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const modelName = modelData?.model_name || modelData?.modelName || '';

  useEffect(() => {
    if (!isActive || !modelName) return undefined;

    let ignoreResult = false;

    setLoading(true);
    setLoadError(false);

    API.get('/api/perf-metrics', {
      params: { model: modelName, hours: 24 },
      skipErrorHandler: true,
    })
      .then((response) => {
        if (ignoreResult) return;
        if (!response.data?.success) throw new Error('perf-metrics failed');
        const nextGroups = response.data?.data?.groups;
        setGroups(Array.isArray(nextGroups) ? nextGroups : []);
      })
      .catch((error) => {
        if (ignoreResult) return;
        setGroups([]);
        setLoadError(true);
      })
      .finally(() => {
        if (!ignoreResult) setLoading(false);
      });

    return () => {
      ignoreResult = true;
    };
  }, [isActive, modelName, retryCount]);

  const metrics = useMemo(
    () => ({
      tps: averageValues(groups, 'avg_tps'),
      ttft: averageValues(groups, 'avg_ttft_ms'),
      latency: averageValues(groups, 'avg_latency_ms'),
      successRate: averageValues(groups, 'success_rate', true),
    }),
    [groups],
  );

  const latencySeries = useMemo(
    () => aggregateSeries(groups, 'avg_ttft_ms'),
    [groups],
  );
  const availabilitySeries = useMemo(
    () => aggregateSeries(groups, 'success_rate', true),
    [groups],
  );

  const columns = useMemo(
    () => [
      {
        title: t('分组'),
        dataIndex: 'group',
        width: 130,
        render: (group) => (
          <Tag color='blue' shape='circle' size='small'>
            {group}
          </Tag>
        ),
      },
      {
        title: 'TPS',
        dataIndex: 'avg_tps',
        align: 'right',
        width: 115,
        render: (value) => (
          <span className='font-mono tabular-nums'>
            {formatThroughput(Number(value))}
          </span>
        ),
      },
      {
        title: t('平均首 Token 延迟'),
        dataIndex: 'avg_ttft_ms',
        align: 'right',
        width: 150,
        render: (value) => (
          <span className='font-mono tabular-nums'>
            {formatLatency(Number(value))}
          </span>
        ),
      },
      {
        title: t('平均延迟'),
        dataIndex: 'avg_latency_ms',
        align: 'right',
        width: 125,
        render: (value) => (
          <span className='font-mono tabular-nums'>
            {formatLatency(Number(value))}
          </span>
        ),
      },
      {
        title: t('成功率'),
        dataIndex: 'success_rate',
        align: 'right',
        width: 115,
        render: (value) => {
          const numericValue = Number(value);
          return (
            <span
              className='font-mono font-semibold tabular-nums'
              style={{ color: getSuccessRateColor(numericValue) }}
            >
              {formatSuccessRate(numericValue)}
            </span>
          );
        },
      },
    ],
    [t],
  );

  if (loading) {
    return (
      <div className='flex min-h-80 items-center justify-center'>
        <Spin size='large' />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className='flex min-h-80 flex-col items-center justify-center gap-4'>
        <Empty description={t('加载性能数据失败')} />
        <Button
          theme='solid'
          onClick={() => setRetryCount((count) => count + 1)}
        >
          {t('重试')}
        </Button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className='flex min-h-80 items-center justify-center'>
        <Empty description={t('暂无性能数据')} />
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4 pb-2'>
      <div
        className='grid gap-3'
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
      >
        <StatCard
          icon={Gauge}
          label='TPS'
          value={formatThroughput(metrics.tps)}
          hint={t('持续每秒 Token 数')}
        />
        <StatCard
          icon={Timer}
          label={t('平均首 Token 延迟')}
          value={formatLatency(metrics.ttft)}
        />
        <StatCard
          icon={Clock3}
          label={t('平均延迟')}
          value={formatLatency(metrics.latency)}
        />
        <StatCard
          icon={HeartPulse}
          label={t('成功率')}
          value={formatSuccessRate(metrics.successRate)}
          hint={t('最近 24 小时请求成功率采样')}
          valueColor={getSuccessRateColor(metrics.successRate)}
        />
      </div>

      <section
        className='overflow-hidden rounded-lg border'
        style={{
          borderColor: 'var(--semi-color-border)',
          background: 'var(--semi-color-bg-0)',
        }}
      >
        <div className='flex items-start gap-2 px-4 pb-3 pt-4'>
          <Activity
            aria-hidden='true'
            size={16}
            className='mt-0.5 shrink-0'
            color='var(--semi-color-text-2)'
          />
          <div className='min-w-0'>
            <Text strong className='block text-sm'>
              {t('各分组性能')}
            </Text>
            <Text type='tertiary' size='small' className='block mt-1'>
              {t('平均延迟、首 Token 延迟、TPS 和成功率')}
            </Text>
          </div>
        </div>
        <Table
          columns={columns}
          dataSource={groups}
          pagination={false}
          rowKey='group'
          size='small'
          scroll={{ x: 635 }}
        />
      </section>

      <ModelPerformanceCharts
        latencySeries={latencySeries}
        availabilitySeries={availabilitySeries}
        t={t}
      />
    </div>
  );
};

export default ModelPerformance;
