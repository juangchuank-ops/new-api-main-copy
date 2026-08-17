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

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Skeleton,
  Empty,
  Tooltip,
  Progress,
  Typography,
} from '@douyinfe/semi-ui';
import { ListChecks, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';

const { Text } = Typography;

const TASK_LIMIT = 20;
const ACTIVE_POLL_INTERVAL_MS = 8000;
const IDLE_POLL_INTERVAL_MS = 30000;

const TYPE_LABELS = {
  log_cleanup: '日志清理',
  channel_test: '批量渠道测试',
  model_update: '批量上游模型更新',
  midjourney_poll: '绘图任务轮询',
  async_task_poll: '异步任务轮询',
};

const STATUS_COLORS = {
  pending: 'orange',
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
};

const isActiveStatus = (status) =>
  status === 'pending' || status === 'running';

const getProgress = (task) => {
  const progress =
    task?.state && typeof task.state === 'object'
      ? task.state.progress
      : undefined;
  if (typeof progress !== 'number' || Number.isNaN(progress)) return null;
  return Math.min(100, Math.max(0, progress));
};

const formatRelative = (ts) => {
  if (!ts) return '-';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const formatTimestamp = (ts) => {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString();
};

const SystemTasksPanel = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const pollRef = useRef(null);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);

    try {
      const res = await API.get('/api/system-task/list', {
        params: { limit: TASK_LIMIT },
        skipErrorHandler: true,
      });
      if (!res.data?.success) throw new Error(res.data?.message);
      setTasks(res.data?.data ?? []);
    } catch (err) {
      setError(true);
      if (!isRefresh) setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const hasActiveTasks = tasks.some((task) => isActiveStatus(task.status));

  useEffect(() => {
    fetchData();
    const interval = hasActiveTasks
      ? ACTIVE_POLL_INTERVAL_MS
      : IDLE_POLL_INTERVAL_MS;
    pollRef.current = setInterval(() => fetchData(true), interval);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasActiveTasks]);

  const activeTasks = useMemo(
    () => tasks.filter((task) => isActiveStatus(task.status)),
    [tasks]
  );
  const historyTasks = useMemo(
    () => tasks.filter((task) => !isActiveStatus(task.status)),
    [tasks]
  );

  const columns = useMemo(
    () => [
      {
        title: t('类型'),
        dataIndex: 'type',
        width: 200,
        render: (text, record) => (
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>
              {t(TYPE_LABELS[text] || text)}
            </div>
            <div
              className='font-mono'
              style={{ fontSize: 11, color: 'var(--semi-color-text-2)' }}
            >
              {text}
            </div>
          </div>
        ),
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        width: 110,
        render: (status) => (
          <Tag color={STATUS_COLORS[status] || 'grey'} size='small'>
            {t(status)}
          </Tag>
        ),
      },
      {
        title: t('进度'),
        dataIndex: 'progress',
        width: 160,
        render: (_, record) => {
          const progress = getProgress(record);
          return (
            <div className='flex items-center gap-2'>
              <Progress
                percent={progress ?? 0}
                size='small'
                style={{ width: 100 }}
                aria-label={t('进度')}
              />
              <span
                className='font-mono tabular-nums'
                style={{
                  fontSize: 11,
                  color: 'var(--semi-color-text-2)',
                  width: 36,
                  textAlign: 'right',
                }}
              >
                {progress === null ? '-' : `${progress}%`}
              </span>
            </div>
          );
        },
      },
      {
        title: t('执行者'),
        dataIndex: 'locked_by',
        width: 180,
        render: (text) => (
          <span
            className='font-mono truncate'
            style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}
          >
            {text || '-'}
          </span>
        ),
      },
      {
        title: t('更新时间'),
        dataIndex: 'updated_at',
        width: 150,
        render: (ts) => (
          <Tooltip content={formatTimestamp(ts)}>
            <span
              style={{
                fontSize: 12,
                color: 'var(--semi-color-text-2)',
                whiteSpace: 'nowrap',
              }}
            >
              {formatRelative(ts)}
            </span>
          </Tooltip>
        ),
      },
      {
        title: t('详情'),
        dataIndex: 'error',
        width: 200,
        render: (text) => (
          <Tooltip content={text || undefined}>
            <span
              className='truncate'
              style={{
                fontSize: 12,
                color: text
                  ? 'var(--semi-color-danger)'
                  : 'var(--semi-color-text-2)',
                display: 'block',
                maxWidth: 180,
              }}
            >
              {text || '-'}
            </span>
          </Tooltip>
        ),
      },
    ],
    [t]
  );

  const renderTaskSection = (title, subtitle, taskList, count) => (
    <div>
      <div className='flex items-center justify-between mb-2'>
        <div>
          <Text strong style={{ fontSize: 13 }}>
            {title}
          </Text>
          <Text
            type='tertiary'
            size='small'
            style={{ marginLeft: 8 }}
          >
            {subtitle}
          </Text>
        </div>
        <Tag size='small' color='grey'>
          {count}
        </Tag>
      </div>
      {taskList.length > 0 ? (
        <Table
          columns={columns}
          dataSource={taskList}
          rowKey='task_id'
          pagination={false}
          size='small'
          scroll={{ x: 900 }}
        />
      ) : (
        <div
          style={{
            border: '1px dashed var(--semi-color-border)',
            borderRadius: 6,
            padding: '24px 16px',
            textAlign: 'center',
          }}
        >
          <Text type='tertiary' size='small'>
            {t('暂无数据')}
          </Text>
        </div>
      )}
    </div>
  );

  return (
    <Card
      bordered
      headerLine
      title={
        <div className='flex items-center gap-2'>
          <ListChecks size={16} color='var(--semi-color-primary)' />
          <Text strong style={{ fontSize: 14 }}>
            {t('系统任务')}
          </Text>
        </div>
      }
      headerExtraContent={
        <div className='flex items-center gap-3'>
          <span
            className='inline-flex items-center gap-1.5'
            style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}
          >
            <span
              className='inline-block rounded-full'
              style={{
                width: 6,
                height: 6,
                background: hasActiveTasks
                  ? 'var(--semi-color-success)'
                  : 'var(--semi-color-text-2)',
                opacity: hasActiveTasks ? 1 : 0.4,
              }}
              aria-hidden='true'
            />
            {hasActiveTasks
              ? t('每 {{seconds}} 秒自动刷新', {
                  seconds: ACTIVE_POLL_INTERVAL_MS / 1000,
                })
              : t('无活跃任务时暂停刷新')}
          </span>
          <Button
            icon={<RefreshCw size={14} />}
            size='small'
            theme='borderless'
            loading={refreshing}
            onClick={() => fetchData(true)}
          >
            {t('刷新')}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className='flex flex-col gap-2'>
          {[1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className='!h-9 !w-full' />
          ))}
        </div>
      ) : error ? (
        <div
          className='flex items-center justify-center py-8 cursor-pointer'
          onClick={() => fetchData()}
        >
          <Text type='tertiary' size='small'>
            {t('加载失败，点击重试')}
          </Text>
        </div>
      ) : tasks.length === 0 ? (
        <div className='flex items-center justify-center py-8'>
          <Empty description={t('暂无系统任务')} style={{ padding: 0 }} />
        </div>
      ) : (
        <div className='flex flex-col gap-4'>
          {renderTaskSection(
            t('活跃任务'),
            t('当前正在等待或运行的任务'),
            activeTasks,
            activeTasks.length
          )}
          {renderTaskSection(
            t('历史任务'),
            t('最近完成或失败的任务'),
            historyTasks,
            historyTasks.length
          )}
        </div>
      )}
    </Card>
  );
};

export default SystemTasksPanel;
