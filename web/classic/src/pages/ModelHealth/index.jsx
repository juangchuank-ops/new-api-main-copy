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

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

const HEALTH_RANGE = '24h';

const SORT_OPTIONS = [
  { value: 'requests', label: '按请求数降序' },
  { value: 'success_rate', label: '按成功率降序' },
  { value: 'name', label: '按名称升序' },
  { value: 'tokens', label: '按 Token 用量降序' },
];

const getNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatInteger = (value) => getNumber(value).toLocaleString();

const formatTTFT = (value) => {
  if (value === null || value === undefined) return '--';
  const milliseconds = getNumber(value);
  if (milliseconds <= 0) return '--';
  if (milliseconds >= 1000) return (milliseconds / 1000).toFixed(1) + ' s';
  return formatInteger(milliseconds) + ' ms';
};

const formatTPS = (value) => {
  if (value === null || value === undefined) return '--';
  const tokensPerSecond = getNumber(value);
  if (tokensPerSecond <= 0) return '--';
  return tokensPerSecond.toFixed(1).replace(/\.0$/, '') + ' t/s';
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
    ':' +
    pad(date.getMinutes())
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
          <p className='model-health-card-meta'>
            <span>
              {t('分组')}: {model.group || '--'}
            </span>
            <span>
              {t('模型')}: {model.model_name}
            </span>
          </p>
          <p className='model-health-card-requests'>
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
          role='img'
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
                  aria-hidden='true'
                />
              );
            })
          ) : (
            <span
              className='model-health-timeline-bar'
              style={{ backgroundColor: '#e5e7eb' }}
              aria-hidden='true'
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
          <b>{t('近期平均首字延迟')}:</b> {formatTTFT(model.avg_ttft_ms)}
        </span>
        <span>
          <b>{t('近期平均输出速度')}:</b> {formatTPS(model.avg_tps)}
        </span>
      </div>
    </article>
  );
};

const ModelHealth = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [groups, setGroups] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [group, setGroup] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('requests');
  const latestRequestRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    try {
      const res = await API.get('/api/admin/model-health', {
        params: {
          range: HEALTH_RANGE,
          ...(group ? { group } : {}),
        },
        skipErrorHandler: true,
      });
      if (res.data.success) {
        if (requestId !== latestRequestRef.current) return;
        setData(res.data.data);
        if (Array.isArray(res.data.data?.groups)) {
          setGroups(res.data.data.groups);
        }
        setLastUpdated(Date.now());
      } else {
        showError(res.data.message || t('加载失败'));
      }
    } catch (error) {
      if (requestId !== latestRequestRef.current) return;
      if (error?.response?.status === 401) {
        showError(error);
        return;
      }
      showError(t('加载模型健康度数据失败'));
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false);
      }
    }
  }, [group, t]);

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
              <span className='sr-only'>{t('分组')}</span>
              <select
                value={group}
                onChange={(event) => setGroup(event.target.value)}
              >
                <option value=''>{t('全部分组')}</option>
                {groups.map((groupName) => (
                  <option key={groupName} value={groupName}>
                    {groupName}
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
              <ModelHealthCard
                key={(model.group || '') + ':' + model.model_name}
                model={model}
                t={t}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
};

export default ModelHealth;
