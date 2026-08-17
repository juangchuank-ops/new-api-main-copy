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
import { Card, Skeleton, Empty, Typography } from '@douyinfe/semi-ui';
import { HeartPulse, Timer, Gauge } from 'lucide-react';
import { API } from '../../helpers';

const { Text } = Typography;

const PERFORMANCE_WINDOW_HOURS = 24;
const TOP_MODEL_LIMIT = 6;

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

const formatUptimePct = (value) => {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(2)}%`;
};

const getSuccessRateColor = (value) => {
  if (!Number.isFinite(value)) return 'var(--semi-color-text-2)';
  if (value >= 100) return 'var(--semi-color-success)';
  if (value >= 90) return 'var(--semi-color-success)';
  if (value >= 70) return 'var(--semi-color-warning)';
  return 'var(--semi-color-danger)';
};

const getSuccessRateDotColor = (value) => {
  if (!Number.isFinite(value)) return 'var(--semi-color-text-2)';
  if (value >= 90) return 'var(--semi-color-success)';
  if (value >= 70) return 'var(--semi-color-warning)';
  return 'var(--semi-color-danger)';
};

const simpleAverage = (rows, metric, isValid) => {
  let total = 0;
  let count = 0;
  for (const row of rows) {
    const value = Number(row[metric]);
    if (!isValid(value)) continue;
    total += value;
    count++;
  }
  return count > 0 ? total / count : Number.NaN;
};

const MetricCell = ({ icon: Icon, label, value, loading, valueColor, t }) => (
  <div
    className='flex flex-col gap-1.5 rounded-xl p-3'
    style={{
      background: 'var(--semi-color-fill-0)',
    }}
  >
    <div className='flex items-center gap-1.5'>
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
    {loading ? (
      <Skeleton.Title style={{ width: 64 }} />
    ) : (
      <div
        className='font-mono text-base font-semibold tabular-nums'
        style={{ color: valueColor || 'var(--semi-color-text-0)' }}
      >
        {value}
      </div>
    )}
  </div>
);

const PerformanceHealthPanel = ({ CARD_PROPS, t }) => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let ignoreResult = false;
    setLoading(true);
    setError(false);

    API.get('/api/perf-metrics/summary', {
      params: { hours: PERFORMANCE_WINDOW_HOURS },
      skipErrorHandler: true,
    })
      .then((response) => {
        if (ignoreResult) return;
        if (!response.data?.success) throw new Error('perf-metrics summary failed');
        const modelList = response.data?.data?.models;
        setModels(Array.isArray(modelList) ? modelList : []);
      })
      .catch(() => {
        if (ignoreResult) return;
        setModels([]);
        setError(true);
      })
      .finally(() => {
        if (!ignoreResult) setLoading(false);
      });

    return () => {
      ignoreResult = true;
    };
  }, [retryCount]);

  const summary = useMemo(() => {
    return {
      avgLatencyMs: Math.round(
        simpleAverage(models, 'avg_latency_ms', (v) => Number.isFinite(v) && v > 0)
      ),
      avgTps: simpleAverage(models, 'avg_tps', (v) => Number.isFinite(v) && v > 0),
      successRate: simpleAverage(models, 'success_rate', Number.isFinite),
    };
  }, [models]);

  const topModels = useMemo(
    () => models.slice(0, TOP_MODEL_LIMIT),
    [models]
  );

  const hasData = models.length > 0;

  return (
    <Card
      {...CARD_PROPS}
      className='!rounded-2xl'
      title={
        <div className='flex items-center gap-2'>
          <HeartPulse
            aria-hidden='true'
            size={16}
            className='shrink-0'
            color='var(--semi-color-success)'
          />
          <Text strong className='text-sm'>
            {t('性能健康')}
          </Text>
        </div>
      }
      headerExtraContent={
        <Text type='tertiary' size='small'>
          {t('最近 24 小时性能指标')}
        </Text>
      }
    >
      <div className='flex flex-col gap-3'>
        {/* 三个指标格子 */}
        <div className='grid grid-cols-3 gap-2'>
          <MetricCell
            icon={HeartPulse}
            label={t('成功率')}
            value={formatUptimePct(summary.successRate)}
            loading={loading}
            valueColor={getSuccessRateColor(summary.successRate)}
            t={t}
          />
          <MetricCell
            icon={Timer}
            label={t('平均延迟')}
            value={formatLatency(summary.avgLatencyMs)}
            loading={loading}
            t={t}
          />
          <MetricCell
            icon={Gauge}
            label={t('吞吐量')}
            value={formatThroughput(summary.avgTps)}
            loading={loading}
            t={t}
          />
        </div>

        {/* 热门模型列表 */}
        {loading ? (
          <div className='flex flex-col gap-2'>
            {[1, 2, 3].map((key) => (
              <Skeleton key={key} className='!h-5 !w-full' />
            ))}
          </div>
        ) : error ? (
          <div
            className='flex items-center justify-center py-4 cursor-pointer'
            onClick={() => setRetryCount((c) => c + 1)}
          >
            <Text type='tertiary' size='small'>
              {t('加载失败，点击重试')}
            </Text>
          </div>
        ) : hasData ? (
          <div>
            <Text
              type='tertiary'
              size='small'
              className='mb-1 block font-medium'
              style={{ fontSize: 11 }}
            >
              {t('热门模型（按流量）')}
            </Text>
            <div className='grid grid-cols-1 gap-x-4 sm:grid-cols-2'>
              {topModels.map((model) => (
                <div
                  key={model.model_name}
                  className='flex items-center justify-between gap-2 rounded px-1.5 py-1'
                >
                  <span
                    className='min-w-0 flex-1 truncate font-mono'
                    style={{ fontSize: 11 }}
                  >
                    {model.model_name}
                  </span>
                  <span className='inline-flex shrink-0 items-center gap-1'>
                    <span
                      className='inline-block rounded-full'
                      style={{
                        width: 6,
                        height: 6,
                        background: getSuccessRateDotColor(
                          model.success_rate
                        ),
                      }}
                      aria-hidden='true'
                    />
                    <span
                      className='font-mono font-semibold tabular-nums'
                      style={{
                        fontSize: 11,
                        color: getSuccessRateColor(model.success_rate),
                      }}
                    >
                      {formatUptimePct(model.success_rate)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className='flex items-center justify-center py-4'>
            <Empty
              description={t('暂无性能数据')}
              style={{ padding: 0 }}
            />
          </div>
        )}
      </div>
    </Card>
  );
};

export default PerformanceHealthPanel;
