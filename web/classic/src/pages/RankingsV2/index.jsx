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
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { VChart } from '@visactor/react-vchart';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  PieChart,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { API, getLobeHubIcon } from '../../helpers';
import { ensureVChartBrowserEnv } from '../../helpers/vchart-env';
import { useChartTheme } from '../../hooks/useChartTheme';
import VChartErrorBoundary from '../../components/common/VChartErrorBoundary';
import './index.css';

// VChart browser env 必须在首次渲染 VChart 组件前注册
ensureVChartBrowserEnv();

const CHART_OPTIONS = { mode: 'desktop-browser' };

const VALID_PERIODS = new Set(['today', 'week', 'month', 'year']);

const PERIODS = [
  { id: 'today', labelKey: '今日' },
  { id: 'week', labelKey: '本周' },
  { id: 'month', labelKey: '本月' },
  { id: 'year', labelKey: '今年' },
];

const MODEL_PERIOD_DESCRIPTIONS = {
  today: '过去 24 小时内各模型的逐小时 Token 用量',
  week: '过去几周内各模型的每周 Token 用量',
  month: '过去一个月内各模型的每日 Token 用量',
  year: '过去一年内各模型的每周 Token 用量',
};

const SHARE_PERIOD_DESCRIPTIONS = {
  today: '过去 24 小时内各模型供应商的 Token 份额',
  week: '过去几周内各模型供应商的 Token 份额',
  month: '过去一个月内各模型供应商的 Token 份额',
  year: '过去一年内各模型供应商的 Token 份额',
};

const TOOLTIP_MAX_ROWS = 10;

/** Format a token count as `1.2B`, `42M`, `980K`, or `512`. */
function formatTokens(value) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000_000_000)
    return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000)
    return `${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 1 : 2)}B`;
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  if (value >= 1_000)
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return value.toLocaleString();
}

/** Format a 0..1 share as a percentage. */
function formatShare(share) {
  if (!Number.isFinite(share) || share <= 0) return '0%';
  if (share < 0.001) return '<0.1%';
  return `${(share * 100).toFixed(share < 0.01 ? 2 : 1)}%`;
}

/** Stable colour palette for vendors, used in both the share chart and the
 * legend dots. Falls back to a neutral palette for unknown vendors. */
const VENDOR_COLOURS = {
  OpenAI: '#10a37f',
  Anthropic: '#d97757',
  Google: '#4285f4',
  DeepSeek: '#7c5cff',
  Alibaba: '#ff9900',
  xAI: '#1f2937',
  Meta: '#1877f2',
  Moonshot: '#ec4899',
  Zhipu: '#D49A4F',
  Mistral: '#ff7000',
  ByteDance: '#C4612F',
  Tencent: '#22c55e',
  MiniMax: '#A08060',
  Cohere: '#fb923c',
  Baidu: '#ef4444',
  Others: '#94a3b8',
};

const FALLBACK_PALETTE = [
  '#B08050',
  '#7A9E6D',
  '#A08060',
  '#f97316',
  '#7A9E6D',
  '#eab308',
  '#ec4899',
  '#B0A060',
  '#8C8279',
  '#7A9E6D',
  '#f43f5e',
  '#B08050',
  '#A09890',
];

function buildVendorColourMap(names) {
  const result = {};
  let fallbackIdx = 0;
  for (const name of names) {
    if (VENDOR_COLOURS[name]) {
      result[name] = VENDOR_COLOURS[name];
    } else {
      result[name] = FALLBACK_PALETTE[fallbackIdx % FALLBACK_PALETTE.length];
      fallbackIdx += 1;
    }
  }
  return result;
}

const MAX_VENDORS_IN_LIST = 12;

/** 模型名链接：旧版模型广场暂不支持模型深链，统一跳转 /pricing */
function ModelLink({ modelName, className, children }) {
  return (
    <Link to='/pricing' className={`rankings-v2-link ${className || ''}`}>
      {children ?? modelName}
    </Link>
  );
}

function VendorLink({ vendor, className, children }) {
  return (
    <Link to='/pricing' className={`rankings-v2-link ${className || ''}`}>
      {children ?? vendor}
    </Link>
  );
}

function GrowthText({ value, className }) {
  if (!Number.isFinite(value) || value === 0) {
    return (
      <span
        className={`text-semi-color-text-3 font-mono tabular-nums ${className || ''}`}
      >
        0%
      </span>
    );
  }
  const isUp = value > 0;
  return (
    <span
      className={`font-mono tabular-nums ${isUp ? 'text-semi-color-success' : 'text-semi-color-danger'} ${className || ''}`}
    >
      {isUp ? '↑' : '↓'}
      {Math.abs(value).toFixed(Math.abs(value) >= 100 ? 0 : 1)}%
    </span>
  );
}

function ModelList({ rows, variant }) {
  const { t } = useTranslation();
  const compact = variant === 'compact';
  return (
    <ul className='m-0 p-0 list-none'>
      {rows.map((row) => (
        <li
          key={row.model_name}
          className={`flex items-center gap-3 ${compact ? 'py-2' : 'py-2.5'}`}
        >
          <span className='w-6 shrink-0 text-right font-mono text-xs tabular-nums text-semi-color-text-3'>
            {row.rank}.
          </span>
          <span className='shrink-0'>
            {getLobeHubIcon(row.vendor_icon, compact ? 20 : 22)}
          </span>
          <div className='min-w-0 flex-1'>
            <ModelLink
              modelName={row.model_name}
              className={`block truncate font-mono font-medium text-semi-color-text-0 ${compact ? 'text-xs' : 'text-sm'}`}
            >
              {row.model_name}
            </ModelLink>
            <p
              className={`m-0 truncate italic text-semi-color-text-3 ${compact ? 'text-[11px]' : 'text-xs'}`}
            >
              {t('by')}{' '}
              <VendorLink vendor={row.vendor}>
                {row.vendor.toLowerCase()}
              </VendorLink>
            </p>
          </div>
          <div className='shrink-0 text-right'>
            <div className='font-mono font-semibold tabular-nums text-semi-color-text-0'>
              <span className={compact ? 'text-xs' : 'text-sm'}>
                {formatTokens(row.total_tokens)}
              </span>
              {!compact && (
                <span className='font-normal text-semi-color-text-3'>
                  {' '}
                  {t('Tokens')}
                </span>
              )}
            </div>
            <GrowthText
              value={row.growth_pct}
              className={compact ? 'text-[10px]' : 'text-[11px]'}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Two-column model leaderboard list: "rank · model (with vendor below) ·
 * tokens (with growth below)". Splits rows evenly between two columns.
 */
function ModelLeaderboard({ rows, variant = 'default', limit }) {
  const limited = limit ? rows.slice(0, limit) : rows;
  const half = Math.ceil(limited.length / 2);
  const left = limited.slice(0, half);
  const right = limited.slice(half);

  if (limited.length === 0) {
    return null;
  }

  return (
    <div className='grid grid-cols-1 gap-x-8 md:grid-cols-2'>
      <ModelList rows={left} variant={variant} />
      {right.length > 0 && <ModelList rows={right} variant={variant} />}
    </div>
  );
}

function ModelsSection({ history, rows, period }) {
  const { t } = useTranslation();
  const { theme } = useChartTheme();
  const isDark = theme === 'dark';
  const chartTextColor = isDark
    ? 'rgba(255, 255, 255, 0.68)'
    : 'rgba(15, 23, 42, 0.58)';
  const chartGridColor = isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(15, 23, 42, 0.12)';

  const safeHistory = history ?? { points: [], models: [] };

  // Order points so the largest model appears at the bottom of every stack.
  const orderedPoints = useMemo(() => {
    const order = new Map(safeHistory.models.map((m, idx) => [m.name, idx]));
    return [...(safeHistory.points ?? [])].sort((a, b) => {
      const tsCmp = String(a.ts ?? '').localeCompare(String(b.ts ?? ''));
      if (tsCmp !== 0) return tsCmp;
      return (order.get(a.model) ?? 999) - (order.get(b.model) ?? 999);
    });
  }, [safeHistory]);

  const totalTokens = useMemo(
    () => (rows ?? []).reduce((s, r) => s + (r.total_tokens || 0), 0),
    [rows]
  );

  const spec = useMemo(() => {
    if (orderedPoints.length === 0) return null;
    return {
      type: 'bar',
      data: [{ id: 'models-history', values: orderedPoints }],
      xField: 'label',
      yField: 'tokens',
      seriesField: 'model',
      stack: true,
      legends: { visible: false },
      axes: [
        {
          orient: 'bottom',
          label: {
            formatMethod: (val) => String(val),
            style: { fill: chartTextColor, fontSize: 10 },
            autoHide: true,
            autoLimit: true,
          },
          tick: { visible: false },
        },
        {
          orient: 'left',
          label: {
            formatMethod: (val) => formatTokens(Number(val)),
            style: { fill: chartTextColor, fontSize: 10 },
          },
          grid: {
            visible: true,
            style: { lineDash: [3, 3], stroke: chartGridColor },
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => String(datum?.model ?? ''),
              value: (datum) => formatTokens(Number(datum?.tokens) || 0),
            },
          ],
        },
        dimension: {
          title: {
            value: (datum) => String(datum?.label ?? ''),
          },
          content: [
            {
              key: (datum) => String(datum?.model ?? ''),
              value: (datum) => Number(datum?.tokens) || 0,
            },
          ],
          updateContent: (array) => {
            array.sort((a, b) => Number(b.value) - Number(a.value));
            const sum = array.reduce((s, x) => s + (Number(x.value) || 0), 0);
            const visible = array.slice(0, TOOLTIP_MAX_ROWS);
            const overflow = array.slice(TOOLTIP_MAX_ROWS);
            const result = visible.map((item) => ({
              key: item.key,
              value: formatTokens(Number(item.value) || 0),
            }));
            if (overflow.length > 0) {
              const otherSum = overflow.reduce(
                (s, item) => s + (Number(item.value) || 0),
                0
              );
              result.push({
                key: t('还有 {{count}} 个', { count: overflow.length }),
                value: formatTokens(otherSum),
              });
            }
            result.unshift({ key: t('合计：'), value: formatTokens(sum) });
            return result;
          },
        },
      },
      animationAppear: { duration: 500 },
    };
  }, [chartGridColor, chartTextColor, orderedPoints, t]);

  return (
    <section className='overflow-hidden rounded-lg border border-semi-color-border bg-semi-color-bg-0'>
      {/* Chart block */}
      <header className='flex items-start justify-between gap-4 px-5 py-4'>
        <div className='min-w-0 flex-1'>
          <h2 className='m-0 inline-flex items-center gap-2 text-base font-semibold text-semi-color-text-0'>
            <BarChart3 className='h-4 w-4 text-semi-color-primary' />
            {t('热门模型')}
          </h2>
          <p className='m-0 mt-1 text-sm text-semi-color-text-2'>
            {t(MODEL_PERIOD_DESCRIPTIONS[period])}
          </p>
        </div>
        <div className='shrink-0 text-right'>
          <div className='font-mono text-2xl font-semibold tabular-nums text-semi-color-text-0'>
            {formatTokens(totalTokens)}
          </div>
          <div className='text-[10px] font-medium tracking-widest uppercase text-semi-color-text-3'>
            {t('Tokens')}
          </div>
        </div>
      </header>

      <div className='px-5 pb-5'>
        <div className='h-60 sm:h-72'>
          {spec ? (
            <VChartErrorBoundary>
              <VChart
                key={`models-history-${theme}-${period}`}
                spec={{
                  ...spec,
                  theme,
                  background: { fill: 'transparent' },
                }}
                option={CHART_OPTIONS}
              />
            </VChartErrorBoundary>
          ) : (
            <div className='flex h-full items-center justify-center text-xs text-semi-color-text-3'>
              {t('暂无历史数据')}
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard block */}
      <div className='border-t border-semi-color-border'>
        <header className='px-5 pt-4 pb-2'>
          <h3 className='m-0 inline-flex items-center gap-2 text-sm font-semibold text-semi-color-text-0'>
            <Trophy className='h-3.5 w-3.5 text-semi-color-warning' />
            {t('LLM 排行榜')}
          </h3>
          <p className='m-0 mt-0.5 text-xs text-semi-color-text-3'>
            {t('对比平台上最受欢迎的模型')}
          </p>
        </header>
        {rows.length === 0 ? (
          <div className='px-5 py-8 text-center text-sm text-semi-color-text-3'>
            {t('没有符合条件的模型')}
          </div>
        ) : (
          <div className='px-5 pt-1 pb-4'>
            <ModelLeaderboard rows={rows} />
          </div>
        )}
      </div>
    </section>
  );
}

function VendorList({ rows, colourMap }) {
  return (
    <ul className='m-0 p-0 list-none'>
      {rows.map((vendor) => (
        <li key={vendor.vendor} className='flex items-center gap-3 py-2.5'>
          <span className='w-6 shrink-0 text-right font-mono text-xs tabular-nums text-semi-color-text-3'>
            {vendor.rank}.
          </span>
          <span
            aria-hidden
            className='h-2.5 w-2.5 shrink-0 rounded-full'
            style={{
              backgroundColor: colourMap[vendor.vendor] ?? '#94a3b8',
            }}
          />
          <VendorLink
            vendor={vendor.vendor}
            className='min-w-0 flex-1 truncate text-sm font-medium text-semi-color-text-0'
          >
            {vendor.vendor}
          </VendorLink>
          <div className='shrink-0 text-right'>
            <div className='font-mono text-sm font-semibold tabular-nums text-semi-color-text-0'>
              {formatTokens(vendor.total_tokens)}
            </div>
            <div className='font-mono text-[11px] tabular-nums text-semi-color-text-3'>
              {formatShare(vendor.share)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function MarketShareSection({ history, rows, period }) {
  const { t } = useTranslation();
  const { theme } = useChartTheme();
  const isDark = theme === 'dark';
  const chartTextColor = isDark
    ? 'rgba(255, 255, 255, 0.68)'
    : 'rgba(15, 23, 42, 0.58)';
  const chartGridColor = isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(15, 23, 42, 0.12)';

  const safeHistory = history ?? { points: [], vendors: [] };

  const colourMap = useMemo(
    () => buildVendorColourMap(safeHistory.vendors.map((v) => v.name)),
    [safeHistory]
  );

  const orderedPoints = useMemo(() => {
    const order = new Map(safeHistory.vendors.map((v, idx) => [v.name, idx]));
    return [...(safeHistory.points ?? [])].sort((a, b) => {
      const tsCmp = String(a.ts ?? '').localeCompare(String(b.ts ?? ''));
      if (tsCmp !== 0) return tsCmp;
      return (order.get(a.vendor) ?? 999) - (order.get(b.vendor) ?? 999);
    });
  }, [safeHistory]);

  const spec = useMemo(() => {
    if (orderedPoints.length === 0) return null;
    return {
      type: 'bar',
      data: [{ id: 'vendor-share', values: orderedPoints }],
      xField: 'label',
      yField: 'share',
      seriesField: 'vendor',
      stack: true,
      paddingInner: 0.12,
      legends: { visible: false },
      color: { specified: colourMap },
      axes: [
        {
          orient: 'bottom',
          label: {
            formatMethod: (val) => String(val),
            style: { fill: chartTextColor, fontSize: 10 },
            autoHide: true,
            autoLimit: true,
          },
          tick: { visible: false },
        },
        {
          orient: 'left',
          min: 0,
          max: 1,
          label: {
            formatMethod: (val) => `${Math.round(Number(val) * 100)}%`,
            style: { fill: chartTextColor, fontSize: 10 },
          },
          grid: {
            visible: true,
            style: { lineDash: [3, 3], stroke: chartGridColor },
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => String(datum?.vendor ?? ''),
              value: (datum) =>
                `${(Number(datum?.share) * 100).toFixed(1)}% · ${formatTokens(Number(datum?.tokens) || 0)}`,
            },
          ],
        },
        dimension: {
          title: {
            value: (datum) => String(datum?.label ?? ''),
          },
          content: [
            {
              key: (datum) => String(datum?.vendor ?? ''),
              value: (datum) => Number(datum?.share) || 0,
            },
          ],
          updateContent: (array) => {
            return array
              .filter((item) => Number(item.value) > 0.001)
              .sort((a, b) => Number(b.value) - Number(a.value))
              .map((item) => ({
                key: item.key,
                value: `${(Number(item.value) * 100).toFixed(1)}%`,
              }));
          },
        },
      },
      animationAppear: { duration: 500 },
    };
  }, [chartGridColor, chartTextColor, colourMap, orderedPoints]);

  const visible = (rows ?? []).slice(0, MAX_VENDORS_IN_LIST);
  const half = Math.ceil(visible.length / 2);
  const left = visible.slice(0, half);
  const right = visible.slice(half);

  return (
    <section className='overflow-hidden rounded-lg border border-semi-color-border bg-semi-color-bg-0'>
      {/* Chart block */}
      <header className='px-5 py-4'>
        <h2 className='m-0 inline-flex items-center gap-2 text-base font-semibold text-semi-color-text-0'>
          <PieChart className='h-4 w-4 text-semi-color-primary' />
          {t('市场份额')}
        </h2>
        <p className='m-0 mt-1 text-sm text-semi-color-text-2'>
          {t(SHARE_PERIOD_DESCRIPTIONS[period])}
        </p>
      </header>

      <div className='px-5 pb-5'>
        <div className='h-60 sm:h-72'>
          {spec ? (
            <VChartErrorBoundary>
              <VChart
                key={`vendor-share-${theme}-${period}`}
                spec={{
                  ...spec,
                  theme,
                  background: { fill: 'transparent' },
                }}
                option={CHART_OPTIONS}
              />
            </VChartErrorBoundary>
          ) : (
            <div className='flex h-full items-center justify-center text-xs text-semi-color-text-3'>
              {t('暂无历史数据')}
            </div>
          )}
        </div>
      </div>

      {/* Vendor list block */}
      <div className='border-t border-semi-color-border'>
        <header className='px-5 pt-4 pb-2'>
          <h3 className='m-0 text-sm font-semibold text-semi-color-text-0'>
            {t('按模型供应商')}
          </h3>
          <p className='m-0 mt-0.5 text-xs text-semi-color-text-3'>
            {t('按聚合 Token 总量排序的供应商')}
          </p>
        </header>
        {visible.length === 0 ? (
          <div className='px-5 py-8 text-center text-sm text-semi-color-text-3'>
            {t('暂无供应商数据')}
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-x-8 px-5 pt-1 pb-4 md:grid-cols-2'>
            <VendorList rows={left} colourMap={colourMap} />
            {right.length > 0 && (
              <VendorList rows={right} colourMap={colourMap} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function MoverRow({ row, intent }) {
  return (
    <li className='flex items-center gap-3 px-4 py-2'>
      <span className='shrink-0'>{getLobeHubIcon(row.vendor_icon, 20)}</span>
      <div className='min-w-0 flex-1'>
        <ModelLink
          modelName={row.model_name}
          className='block truncate font-mono text-xs font-medium text-semi-color-text-0'
        >
          {row.model_name}
        </ModelLink>
        <p className='m-0 truncate text-[11px] text-semi-color-text-3'>
          #{row.current_rank} ·{' '}
          <VendorLink vendor={row.vendor}>
            {row.vendor.toLowerCase()}
          </VendorLink>
        </p>
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-0.5 font-mono text-xs font-semibold tabular-nums ${intent === 'up' ? 'text-semi-color-success' : 'text-semi-color-danger'}`}
      >
        {intent === 'up' ? (
          <ArrowUpRight className='h-3 w-3' />
        ) : (
          <ArrowDownRight className='h-3 w-3' />
        )}
        {Math.abs(row.rank_delta)}
      </span>
    </li>
  );
}

function PulseCard({ title, description, icon, children }) {
  return (
    <div className='overflow-hidden rounded-lg border border-semi-color-border bg-semi-color-bg-0'>
      <header className='border-b border-semi-color-border px-4 py-3'>
        <h3 className='m-0 inline-flex items-center gap-2 text-sm font-semibold text-semi-color-text-0'>
          {icon}
          {title}
        </h3>
        <p className='m-0 mt-0.5 text-xs text-semi-color-text-3'>
          {description}
        </p>
      </header>
      <div className='py-1'>{children}</div>
    </div>
  );
}

/** Rank movement panel: gainers and losers calculated from the previous period. */
function PulseSection({ movers, droppers }) {
  const { t } = useTranslation();

  return (
    <section className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
      <PulseCard
        title={t('上升趋势')}
        description={t('排名上升的模型')}
        icon={<TrendingUp className='h-4 w-4 text-semi-color-success' />}
      >
        {movers.length === 0 ? (
          <div className='px-4 py-6 text-center text-xs text-semi-color-text-3'>
            {t('暂无显著上升的模型')}
          </div>
        ) : (
          <ul className='m-0 p-0 list-none'>
            {movers.map((row) => (
              <MoverRow key={row.model_name} row={row} intent='up' />
            ))}
          </ul>
        )}
      </PulseCard>

      <PulseCard
        title={t('下降趋势')}
        description={t('排名下降的模型')}
        icon={<TrendingDown className='h-4 w-4 text-semi-color-danger' />}
      >
        {droppers.length === 0 ? (
          <div className='px-4 py-6 text-center text-xs text-semi-color-text-3'>
            {t('暂无显著下降的模型')}
          </div>
        ) : (
          <ul className='m-0 p-0 list-none'>
            {droppers.map((row) => (
              <MoverRow key={row.model_name} row={row} intent='down' />
            ))}
          </ul>
        )}
      </PulseCard>
    </section>
  );
}

function RankingsHero({ period, onPeriodChange }) {
  const { t } = useTranslation();

  return (
    <section className='space-y-5'>
      <div className='space-y-2'>
        <h1 className='m-0 text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.15] tracking-tight text-semi-color-text-0'>
          {t('排行榜')}
        </h1>
        <p className='m-0 max-w-2xl text-sm text-semi-color-text-2'>
          {t('发现平台上最常用的模型和崛起的厂商，数据来自实时用量。')}
        </p>
      </div>

      {/* Underline tabs for period */}
      <div
        role='tablist'
        aria-label={t('时间范围')}
        className='flex items-center border-b border-semi-color-border'
      >
        {PERIODS.map((p) => {
          const isActive = period === p.id;
          return (
            <button
              key={p.id}
              type='button'
              role='tab'
              aria-selected={isActive}
              onClick={() => onPeriodChange(p.id)}
              className={`rankings-v2-tab ${isActive ? 'rankings-v2-tab--active' : ''}`}
            >
              {t(p.labelKey)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RankingsLoading() {
  return (
    <div className='space-y-6'>
      <div className='h-[420px] w-full animate-pulse rounded-xl bg-semi-color-fill-1' />
      <div className='h-[360px] w-full animate-pulse rounded-xl bg-semi-color-fill-1' />
      <div className='h-[180px] w-full animate-pulse rounded-xl bg-semi-color-fill-1' />
    </div>
  );
}

function RankingsError({ message }) {
  const { t } = useTranslation();
  return (
    <div className='rounded-xl border border-dashed border-semi-color-border bg-semi-color-bg-0 px-6 py-12 text-center'>
      <h2 className='m-0 text-base font-semibold text-semi-color-text-0'>
        {t('无法加载排行榜')}
      </h2>
      <p className='mx-auto mt-2 mb-0 max-w-md text-sm text-semi-color-text-2'>
        {message}
      </p>
    </div>
  );
}

const RankingsV2 = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  const periodParam = searchParams.get('period');
  const period = VALID_PERIODS.has(periodParam) ? periodParam : 'week';

  const handlePeriodChange = (next) => {
    setSearchParams(next === 'week' ? {} : { period: next });
  };

  const fetchData = useCallback(async (p) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await API.get(`/api/rankings?period=${p}`);
      const { success, message, data } = res.data;
      if (success) {
        setSnapshot(data);
      } else {
        setErrorMsg(message || '');
      }
    } catch (err) {
      setErrorMsg(err.message || '');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [fetchData, period]);

  let rankingsContent = <RankingsLoading />;
  if (!loading && errorMsg !== null) {
    rankingsContent = (
      <RankingsError message={errorMsg || t('无法加载排行榜数据')} />
    );
  } else if (!loading && snapshot) {
    rankingsContent = (
      <>
        <ModelsSection
          history={snapshot.models_history}
          rows={snapshot.models || []}
          period={period}
        />
        <MarketShareSection
          history={snapshot.vendor_share_history}
          rows={snapshot.vendors || []}
          period={period}
        />
        <PulseSection
          movers={snapshot.top_movers || []}
          droppers={snapshot.top_droppers || []}
        />
      </>
    );
  }

  return (
    <div className='rankings-v2-page mt-16'>
      <div className='relative'>
        <div aria-hidden className='rankings-v2-hero-bg' />
        <div className='relative mx-auto w-full max-w-[1280px] space-y-8 px-3 pt-8 pb-10 sm:px-6 sm:pt-10 sm:pb-12 xl:px-8'>
          <RankingsHero period={period} onPeriodChange={handlePeriodChange} />
          {rankingsContent}
        </div>
      </div>
    </div>
  );
};

export default RankingsV2;
