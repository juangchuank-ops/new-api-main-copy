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
  Activity,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock3,
  RefreshCw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { API } from '../../helpers';
import { showError } from '../../helpers/utils';
import { useTranslation } from 'react-i18next';
import './index.css';

const RANGE_OPTIONS = [
  { value: '1h', hours: 1, label: '最近 1 小时' },
  { value: '6h', hours: 6, label: '最近 6 小时' },
  { value: '24h', hours: 24, label: '最近 24 小时' },
  { value: '7d', hours: 24 * 7, label: '最近 7 天' },
  { value: '30d', hours: 24 * 30, label: '最近 30 天' },
];

const SORT_OPTIONS = [
  { value: 'requests', label: '按请求数降序' },
  { value: 'success_rate', label: '按成功率降序' },
  { value: 'name', label: '按名称升序' },
  { value: 'tokens', label: '按 Token 用量降序' },
];

const previewTimeline = (rates) =>
  Array.from({ length: 24 }, (_, index) => {
    const rate = rates[index % rates.length];
    const requests = index % 9 === 0 ? 0 : 20 + index;
    return {
      hour: Math.floor(Date.now() / 3600000) * 3600 - (23 - index) * 3600,
      requests,
      success: Math.round((requests * rate) / 100),
      failed: requests - Math.round((requests * rate) / 100),
      success_rate: rate,
    };
  });

const PREVIEW_DATA = {
  summary: {
    monitored_models: 4,
    healthy_models: 3,
    overall_success_rate: 90.7,
  },
  models: [
    {
      model_name: 'gpt-5.6-sol',
      success_rate: 98.1,
      total_tokens: 18540820,
      total_requests: 17579,
      success_count: 17239,
      failed_count: 340,
      avg_latency_ms: 9.4,
      timeline: previewTimeline([100, 100, 98, 100, 91, 100, 100, 96]),
    },
    {
      model_name: 'gpt-5.6-luna',
      success_rate: 59,
      total_tokens: 6290120,
      total_requests: 6269,
      success_count: 3698,
      failed_count: 2571,
      avg_latency_ms: 3.8,
      timeline: previewTimeline([88, 40, 100, 65, 20, 100, 72, 55]),
    },
    {
      model_name: 'claude-opus-4-8',
      success_rate: 99.6,
      total_tokens: 4096800,
      total_requests: 4096,
      success_count: 4079,
      failed_count: 17,
      avg_latency_ms: 3.7,
      timeline: previewTimeline([100, 100, 100, 96, 100, 100, 100, 100]),
    },
    {
      model_name: 'claude-fable-5',
      success_rate: 98.6,
      total_tokens: 3685210,
      total_requests: 3685,
      success_count: 3634,
      failed_count: 51,
      avg_latency_ms: 4,
      timeline: previewTimeline([100, 100, 94, 100, 100, 96, 100, 100]),
    },
  ],
};

const getNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatInteger = (value) => getNumber(value).toLocaleString();

const formatTokens = (value) => {
  const tokens = getNumber(value);
  if (tokens >= 1e9) return (tokens / 1e9).toFixed(1) + 'B';
  if (tokens >= 1e6) return (tokens / 1e6).toFixed(1) + 'M';
  if (tokens >= 1e3) return (tokens / 1e3).toFixed(1) + 'K';
  return formatInteger(tokens);
};

const formatLatency = (value) => {
  const seconds = getNumber(value);
  if (seconds <= 0) return '--';
  if (seconds >= 60) return (seconds / 60).toFixed(1) + ' min';
  return seconds.toFixed(1) + ' s';
};

const formatTimestamp = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const pad = (part) => String(part).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    ' ' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds())
  );
};

const getModelStatus = (model) => {
  const requests = getNumber(model.total_requests);
  if (requests === 0) return 'empty';
  return getNumber(model.success_rate) >= 80 ? 'healthy' : 'unhealthy';
};

const getTimelineColor = (point) => {
  if (getNumber(point.requests) === 0) return '#e5e7eb';
  const rate = getNumber(point.success_rate);
  if (rate >= 95) return '#27ae60';
  if (rate >= 80) return '#67c774';
  if (rate >= 60) return '#f39c12';
  return '#e74c3c';
};

// Keep long ranges readable while retaining the whole selected period.
const compactTimeline = (timeline, maxPoints = 48) => {
  if (!Array.isArray(timeline) || timeline.length === 0) return [];
  if (timeline.length <= maxPoints) return timeline;

  const bucketSize = Math.ceil(timeline.length / maxPoints);
  const compacted = [];
  for (let start = 0; start < timeline.length; start += bucketSize) {
    const bucket = timeline.slice(start, start + bucketSize);
    const requests = bucket.reduce(
      (sum, point) => sum + getNumber(point.requests),
      0,
    );
    const success = bucket.reduce(
      (sum, point) => sum + getNumber(point.success),
      0,
    );
    const failed = bucket.reduce(
      (sum, point) => sum + getNumber(point.failed),
      0,
    );
    compacted.push({
      hour: bucket[0]?.hour,
      end_hour: bucket[bucket.length - 1]?.hour,
      requests,
      success,
      failed,
      success_rate: requests > 0 ? (success / requests) * 100 : 0,
    });
  }
  return compacted;
};

const formatTimelineHour = (timestamp) => {
  if (!timestamp) return '--';
  const date = new Date(getNumber(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return '--';
  const pad = (part) => String(part).padStart(2, '0');
  return (
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    ' ' +
    pad(date.getHours()) +
    ':00'
  );
};

const ModelHealthCard = ({ model, t }) => {
  const status = getModelStatus(model);
  const timeline = compactTimeline(model.timeline);
  const successRate = getNumber(model.success_rate);

  return (
    <article className='model-health-card'>
      <div className='model-health-card-header'>
        <div className='model-health-card-title'>
          <h2 title={model.model_name}>{model.model_name}</h2>
          <p>
            {formatInteger(model.total_requests)} {t('总请求')}
          </p>
        </div>
        <span className={'model-health-status model-health-status-' + status}>
          {status === 'healthy' ? (
            <CheckCircle2 aria-hidden='true' size={15} strokeWidth={2.2} />
          ) : status === 'unhealthy' ? (
            <TriangleAlert aria-hidden='true' size={15} strokeWidth={2.2} />
          ) : (
            <Activity aria-hidden='true' size={15} strokeWidth={2.2} />
          )}
          {status === 'healthy'
            ? t('正常')
            : status === 'unhealthy'
              ? t('异常')
              : t('暂无请求')}
        </span>
      </div>

      <div className='model-health-metrics'>
        <div>
          <span>{t('成功率')}</span>
          <strong>{successRate.toFixed(1)}%</strong>
        </div>
        <div>
          <span>{t('成功')}</span>
          <strong className='model-health-success-value'>
            {formatInteger(model.success_count)}
          </strong>
        </div>
        <div>
          <span>{t('错误')}</span>
          <strong className='model-health-error-value'>
            {formatInteger(model.failed_count)}
          </strong>
        </div>
      </div>

      <div className='model-health-timeline'>
        <div
          className='model-health-timeline-bars'
          style={{ '--model-health-bar-count': Math.max(timeline.length, 1) }}
          aria-label={t('模型状态时间线')}
        >
          {timeline.length > 0 ? (
            timeline.map((point, index) => {
              const start = formatTimelineHour(point.hour);
              const end = formatTimelineHour(point.end_hour ?? point.hour);
              const requests = getNumber(point.requests);
              const rate = getNumber(point.success_rate);
              const title =
                requests > 0
                  ? start +
                    ' - ' +
                    end +
                    ' · ' +
                    rate.toFixed(1) +
                    '% · ' +
                    formatInteger(requests) +
                    ' ' +
                    t('请求')
                  : start + ' - ' + end + ' · ' + t('暂无请求');
              return (
                <span
                  className='model-health-timeline-bar'
                  key={String(point.hour) + '-' + index}
                  style={{ backgroundColor: getTimelineColor(point) }}
                  title={title}
                />
              );
            })
          ) : (
            <span
              className='model-health-timeline-bar'
              style={{ backgroundColor: '#e5e7eb' }}
            />
          )}
        </div>
        <div className='model-health-timeline-labels'>
          <span>{t('过去')}</span>
          <span>{t('现在')}</span>
        </div>
      </div>

      <div className='model-health-card-footer'>
        <span>
          <b>{t('近期平均延迟')}:</b> {formatLatency(model.avg_latency_ms)}
        </span>
        <span>
          <b>{t('Token 用量')}:</b> {formatTokens(model.total_tokens)}
        </span>
      </div>
    </article>
  );
};

const ModelHealth = () => {
  const { t } = useTranslation();
  const previewMode =
    new URLSearchParams(window.location.search).get('preview') === '1';
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(previewMode ? PREVIEW_DATA : null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [range, setRange] = useState('24h');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('requests');

  const fetchData = useCallback(async () => {
    if (previewMode) {
      setLastUpdated(Date.now());
      return;
    }
    setLoading(true);
    try {
      const res = await API.get('/api/admin/model-health', {
        params: { range },
        skipErrorHandler: true,
      });
      if (res.data.success) {
        setData(res.data.data);
        setLastUpdated(Date.now());
      } else {
        showError(res.data.message || t('加载失败'));
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        showError(error);
        return;
      }
      showError(t('加载模型健康度数据失败'));
    } finally {
      setLoading(false);
    }
  }, [previewMode, range, t]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const models = useMemo(
    () => (Array.isArray(data?.models) ? data.models : []),
    [data],
  );

  const filteredModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = models.filter((model) =>
      String(model.model_name || '')
        .toLowerCase()
        .includes(query),
    );

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return String(a.model_name || '').localeCompare(
            String(b.model_name || ''),
          );
        case 'success_rate':
          return getNumber(b.success_rate) - getNumber(a.success_rate);
        case 'tokens':
          return getNumber(b.total_tokens) - getNumber(a.total_tokens);
        case 'requests':
        default:
          return getNumber(b.total_requests) - getNumber(a.total_requests);
      }
    });
  }, [models, searchQuery, sortBy]);

  const stats = useMemo(() => {
    const totalRequests = models.reduce(
      (sum, model) => sum + getNumber(model.total_requests),
      0,
    );
    const activeModels = models.filter(
      (model) => getNumber(model.total_requests) > 0,
    );
    const healthyModels =
      data?.summary?.healthy_models ??
      activeModels.filter((model) => getNumber(model.success_rate) >= 80)
        .length;
    const abnormalModels = activeModels.filter(
      (model) => getNumber(model.success_rate) < 80,
    ).length;
    const overallSuccessRate = getNumber(data?.summary?.overall_success_rate);

    return {
      modelCount: models.length || getNumber(data?.summary?.monitored_models),
      totalRequests,
      overallSuccessRate,
      abnormalModels,
      healthyModels,
    };
  }, [data, models]);

  if (loading && !data) {
    return (
      <div className='model-health-page'>
        <div className='model-health-loading' role='status'>
          <RefreshCw
            className='model-health-spin'
            size={22}
            aria-hidden='true'
          />
          <span>{t('加载中...')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className='model-health-page'>
      <main className='model-health-shell'>
        <header className='model-health-header'>
          <div>
            <h1>{t('全站模型状态')}</h1>
            <p className='model-health-updated'>
              <Clock3 size={15} aria-hidden='true' />
              <span>
                {t('最后更新')}: {formatTimestamp(lastUpdated)}
              </span>
            </p>
          </div>

          <div className='model-health-toolbar'>
            <label className='model-health-select'>
              <span className='sr-only'>{t('时间范围')}</span>
              <select
                value={range}
                onChange={(event) => setRange(event.target.value)}
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
              <ChevronDown size={17} aria-hidden='true' />
            </label>
            <label className='model-health-select'>
              <span className='sr-only'>{t('排序方式')}</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
              <ChevronDown size={17} aria-hidden='true' />
            </label>
            <button
              className='model-health-refresh'
              type='button'
              onClick={fetchData}
              disabled={loading}
              aria-label={t('刷新')}
              title={t('自动刷新，每 30 秒')}
            >
              <RefreshCw
                size={17}
                className={loading ? 'model-health-spin' : ''}
                aria-hidden='true'
              />
            </button>
          </div>
        </header>

        <section className='model-health-summary' aria-label={t('模型统计')}>
          <article className='model-health-summary-card'>
            <div>
              <span>{t('模型数量')}</span>
              <strong>{formatInteger(stats.modelCount)}</strong>
            </div>
            <span className='model-health-summary-icon' aria-hidden='true'>
              <BarChart3 size={23} />
            </span>
          </article>
          <article className='model-health-summary-card'>
            <div>
              <span>{t('总请求')}</span>
              <strong>{formatInteger(stats.totalRequests)}</strong>
            </div>
            <span className='model-health-summary-icon' aria-hidden='true'>
              <Activity size={23} />
            </span>
          </article>
          <article className='model-health-summary-card'>
            <div>
              <span>{t('平均成功率')}</span>
              <strong>{stats.overallSuccessRate.toFixed(1)}%</strong>
            </div>
            <span
              className='model-health-summary-icon model-health-summary-icon-success'
              aria-hidden='true'
            >
              <CheckCircle2 size={23} />
            </span>
          </article>
          <article className='model-health-summary-card model-health-summary-card-alert'>
            <div>
              <span>{t('异常模型')}</span>
              <strong>{formatInteger(stats.abnormalModels)}</strong>
              <small>
                {t('正常')} {formatInteger(stats.healthyModels)}
              </small>
            </div>
            <span
              className='model-health-summary-icon model-health-summary-icon-alert'
              aria-hidden='true'
            >
              <TriangleAlert size={23} />
            </span>
          </article>
        </section>

        <div className='model-health-search'>
          <Search size={19} aria-hidden='true' />
          <input
            type='search'
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('搜索模型名称')}
            aria-label={t('搜索模型名称')}
          />
        </div>

        {filteredModels.length === 0 ? (
          <div className='model-health-empty' role='status'>
            <BarChart3 size={28} aria-hidden='true' />
            <p>
              {searchQuery.trim() ? t('没有找到匹配的模型') : t('暂无模型数据')}
            </p>
          </div>
        ) : (
          <section className='model-health-grid' aria-label={t('模型列表')}>
            {filteredModels.map((model) => (
              <ModelHealthCard key={model.model_name} model={model} t={t} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
};

export default ModelHealth;
