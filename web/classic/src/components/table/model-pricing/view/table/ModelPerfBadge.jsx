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
import { Tooltip } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

const formatCompactLatency = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return '-';
  if (ms >= 1000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms)}ms`;
};

const formatCompactThroughput = (tps) => {
  if (!Number.isFinite(tps) || tps <= 0) return '-';
  if (tps >= 1000) return `${(tps / 1000).toFixed(1)}K`;
  return tps > 1 ? String(Math.round(tps)) : tps.toFixed(1);
};

const getSuccessRateDotColor = (rate) => {
  if (!Number.isFinite(rate)) return 'var(--semi-color-text-2)';
  if (rate >= 90) return 'var(--semi-color-success)';
  if (rate >= 70) return 'var(--semi-color-warning)';
  return 'var(--semi-color-danger)';
};

const getSuccessRateTextColor = (rate) => {
  if (!Number.isFinite(rate)) return 'var(--semi-color-text-2)';
  if (rate >= 90) return 'var(--semi-color-success)';
  if (rate >= 70) return 'var(--semi-color-warning)';
  return 'var(--semi-color-danger)';
};

const StatusBars = ({ rate, recentRates }) => {
  const rates =
    Array.isArray(recentRates) && recentRates.length > 0
      ? recentRates.filter((r) => Number.isFinite(r)).slice(-3)
      : [rate];

  const bars = [
    ...Array(Math.max(0, 3 - rates.length)).fill(null),
    ...rates,
  ].slice(-3);

  return (
    <div className='inline-flex items-end gap-0.5' style={{ height: 12 }}>
      {bars.map((r, i) => (
        <span
          key={`${i}-${r ?? 'empty'}`}
          className='inline-block rounded-full'
          style={{
            width: 3,
            height: r == null ? 4 : i === 0 ? 8 : i === 1 ? 10 : 12,
            background:
              r == null
                ? 'var(--semi-color-fill-2)'
                : getSuccessRateDotColor(r),
          }}
        />
      ))}
    </div>
  );
};

const ModelPerfBadge = ({ perf }) => {
  const { t } = useTranslation();

  if (!perf) return null;

  const { avg_latency_ms, avg_tps, success_rate, recent_success_rates } = perf;

  return (
    <Tooltip
      content={
        <div className='flex flex-col gap-1 text-xs'>
          <span>
            {t('平均延迟')}: {formatCompactLatency(avg_latency_ms)}
          </span>
          <span>
            {t('吞吐量')}: {formatCompactThroughput(avg_tps)} t/s
          </span>
          <span>
            {t('成功率')}: {Number.isFinite(success_rate) ? success_rate.toFixed(1) : '-'}%
          </span>
        </div>
      }
    >
      <div className='inline-flex items-center gap-2 font-mono tabular-nums'>
        <span
          className='text-xs'
          style={{ color: 'var(--semi-color-text-2)' }}
        >
          {formatCompactLatency(avg_latency_ms)}
        </span>
        <span
          className='text-xs'
          style={{ color: 'var(--semi-color-text-2)' }}
        >
          {formatCompactThroughput(avg_tps)}
        </span>
        <StatusBars rate={success_rate} recentRates={recent_success_rates} />
      </div>
    </Tooltip>
  );
};

export default ModelPerfBadge;
