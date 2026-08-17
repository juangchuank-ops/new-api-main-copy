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
  Typography,
} from '@douyinfe/semi-ui';
import { ServerCog, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, showError } from '../../helpers';

const { Text } = Typography;

const POLL_INTERVAL_MS = 30000;

const formatPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${value.toFixed(1)}%`;
};

const formatBytes = (bytes) => {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '-';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatTimestamp = (ts) => {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  return d.toLocaleString();
};

const formatRelative = (ts) => {
  if (!ts) return '-';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const getStatusColor = (status) => {
  switch (status) {
    case 'online':
      return 'green';
    case 'stale':
      return 'orange';
    default:
      return 'grey';
  }
};

const getRoleLabel = (instance) => {
  if (instance?.info?.role?.is_master) return 'master';
  return 'worker';
};

const getRuntimeLabel = (instance) => {
  const runtime = instance?.info?.runtime;
  if (!runtime) return '-';
  const parts = [];
  if (runtime.goos) parts.push(runtime.goos);
  if (runtime.goarch) parts.push(runtime.goarch);
  return parts.join('/') || '-';
};

const getNodeName = (instance) => {
  return instance?.info?.node?.name || instance?.node_name || '-';
};

const RingProgress = ({ percent, size = 22 }) => {
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const validPercent =
    typeof percent === 'number' && !Number.isNaN(percent)
      ? Math.max(0, Math.min(100, percent))
      : null;
  const offset =
    validPercent === null
      ? circumference
      : circumference - (validPercent / 100) * circumference;

  const color =
    validPercent === null
      ? 'var(--semi-color-text-2)'
      : validPercent >= 90
        ? 'var(--semi-color-danger)'
        : validPercent >= 70
          ? 'var(--semi-color-warning)'
          : 'var(--semi-color-success)';

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)' }}
      aria-hidden='true'
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill='none'
        strokeWidth={stroke}
        stroke='var(--semi-color-fill-2)'
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill='none'
        strokeWidth={stroke}
        strokeLinecap='round'
        stroke={color}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.5s' }}
      />
    </svg>
  );
};

const ResourceCell = ({ value, tooltipContent }) => {
  const content = (
    <div className='flex items-center gap-2'>
      <RingProgress percent={value} />
      <span
        className='font-mono tabular-nums'
        style={{ fontSize: 11, color: 'var(--semi-color-text-1)' }}
      >
        {formatPercent(value)}
      </span>
    </div>
  );

  if (!tooltipContent) return content;

  return (
    <Tooltip content={tooltipContent}>
      <span style={{ cursor: 'help' }}>{content}</span>
    </Tooltip>
  );
};

const SystemInstancesPanel = () => {
  const { t } = useTranslation();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const pollRef = useRef(null);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);

    try {
      const res = await API.get('/api/system-info/instances', {
        skipErrorHandler: true,
      });
      if (!res.data?.success) throw new Error(res.data?.message);
      setInstances(res.data?.data ?? []);
    } catch (err) {
      setError(true);
      if (!isRefresh) setInstances([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const columns = useMemo(
    () => [
      {
        title: t('实例'),
        dataIndex: 'node_name',
        width: 220,
        render: (text, record) => {
          const nodeName = getNodeName(record);
          const hostname = record?.info?.host?.hostname || '-';
          return (
            <div className='flex items-center gap-2'>
              <span
                className='inline-block rounded-full shrink-0'
                style={{
                  width: 8,
                  height: 8,
                  background:
                    record.status === 'online'
                      ? 'var(--semi-color-success)'
                      : 'var(--semi-color-warning)',
                }}
                aria-hidden='true'
              />
              <div className='min-w-0'>
                <div
                  className='truncate font-medium'
                  style={{ fontSize: 13 }}
                >
                  {nodeName}
                </div>
                <div
                  className='truncate font-mono'
                  style={{
                    fontSize: 11,
                    color: 'var(--semi-color-text-2)',
                  }}
                >
                  {hostname}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        width: 100,
        render: (status) => (
          <Tag color={getStatusColor(status)} size='small'>
            {t(status)}
          </Tag>
        ),
      },
      {
        title: t('角色'),
        dataIndex: 'role',
        width: 90,
        render: (_, record) => (
          <Tag size='small' color='blue'>
            {getRoleLabel(record)}
          </Tag>
        ),
      },
      {
        title: 'CPU',
        dataIndex: 'cpu',
        width: 90,
        render: (_, record) => {
          const cpu = record?.info?.resources?.cpu?.usage_percent;
          return <ResourceCell value={cpu} />;
        },
      },
      {
        title: t('内存'),
        dataIndex: 'memory',
        width: 90,
        render: (_, record) => {
          const mem = record?.info?.resources?.memory?.usage_percent;
          return <ResourceCell value={mem} />;
        },
      },
      {
        title: t('存储'),
        dataIndex: 'storage',
        width: 100,
        render: (_, record) => {
          const storage = record?.info?.resources?.storage;
          const usedPercent = storage?.used_percent;
          const tooltip =
            storage && (storage.used_bytes || storage.total_bytes) ? (
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                <div>
                  {t('已用')}: {formatBytes(storage.used_bytes)}
                </div>
                <div>
                  {t('可用')}: {formatBytes(storage.free_bytes)}
                </div>
                <div>
                  {t('总计')}: {formatBytes(storage.total_bytes)}
                </div>
              </div>
            ) : undefined;
          return <ResourceCell value={usedPercent} tooltipContent={tooltip} />;
        },
      },
      {
        title: t('版本'),
        dataIndex: 'version',
        width: 90,
        render: (_, record) => (
          <span
            className='font-mono truncate'
            style={{ fontSize: 12, color: 'var(--semi-color-text-1)' }}
          >
            {record?.info?.runtime?.version || '-'}
          </span>
        ),
      },
      {
        title: t('运行时'),
        dataIndex: 'runtime',
        width: 120,
        render: (_, record) => (
          <span
            className='font-mono'
            style={{ fontSize: 12, color: 'var(--semi-color-text-1)' }}
          >
            {getRuntimeLabel(record)}
          </span>
        ),
      },
      {
        title: t('启动时间'),
        dataIndex: 'started_at',
        width: 160,
        render: (ts) => (
          <span
            style={{
              fontSize: 12,
              color: 'var(--semi-color-text-2)',
              whiteSpace: 'nowrap',
            }}
          >
            {formatTimestamp(ts)}
          </span>
        ),
      },
      {
        title: t('最后心跳'),
        dataIndex: 'last_seen_at',
        width: 130,
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
    ],
    [t]
  );

  return (
    <Card
      bordered
      headerLine
      title={
        <div className='flex items-center gap-2'>
          <ServerCog size={16} color='var(--semi-color-primary)' />
          <Text strong style={{ fontSize: 14 }}>
            {t('实例')}
          </Text>
        </div>
      }
      headerExtraContent={
        <div className='flex items-center gap-3'>
          <Text type='tertiary' size='small'>
            {t('每 {{seconds}} 秒自动刷新', { seconds: POLL_INTERVAL_MS / 1000 })}
          </Text>
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
          {[1, 2, 3].map((key) => (
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
      ) : instances.length === 0 ? (
        <div className='flex items-center justify-center py-8'>
          <Empty description={t('暂无实例')} style={{ padding: 0 }} />
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={instances}
          rowKey='node_name'
          pagination={false}
          size='small'
          scroll={{ x: 1200 }}
        />
      )}
    </Card>
  );
};

export default SystemInstancesPanel;
