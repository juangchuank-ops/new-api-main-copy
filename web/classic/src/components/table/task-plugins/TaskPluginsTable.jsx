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

import React, { useEffect, useState } from 'react';
import { Button, Empty, Space, Switch, Tag } from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { Eye, Trash2, Upload } from 'lucide-react';
import CardTable from '../../common/ui/CardTable';
import { API, timestamp2string } from '../../../helpers';

const ICON_URL = (key) => `/api/plugin/task/${encodeURIComponent(key)}/icon`;

const iconCache = new Map();

/**
 * 任务插件图标：图标接口是 RootAuth 保护的，<img src> 无法携带鉴权头，
 * 因此这里用 axios 取回二进制再转成 object URL 渲染。
 * 仅通过 <img> 绘制，浏览器图片模式不会执行 SVG 内的脚本。
 */
export const TaskPluginIcon = ({ pluginKey, hasIcon, size = 22 }) => {
  const [src, setSrc] = useState(() => iconCache.get(pluginKey) || '');

  useEffect(() => {
    if (!hasIcon || !pluginKey) {
      setSrc('');
      return undefined;
    }
    const cached = iconCache.get(pluginKey);
    if (cached) {
      setSrc(cached);
      return undefined;
    }
    let active = true;
    API.get(ICON_URL(pluginKey), {
      responseType: 'blob',
      skipErrorHandler: true,
    })
      .then((res) => {
        if (!active) return;
        const blob = res?.data;
        if (
          blob &&
          typeof blob.type === 'string' &&
          blob.type.startsWith('image/')
        ) {
          const objectUrl = URL.createObjectURL(blob);
          iconCache.set(pluginKey, objectUrl);
          setSrc(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pluginKey, hasIcon]);

  const label = String(pluginKey || '?')
    .slice(0, 1)
    .toUpperCase();
  const style = { width: size, height: size };

  if (src) {
    return (
      <span
        className='inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md'
        style={{
          ...style,
          backgroundColor: 'var(--semi-color-fill-0)',
        }}
      >
        <img
          src={src}
          alt=''
          width={size}
          height={size}
          draggable={false}
          className='h-full w-full object-contain'
        />
      </span>
    );
  }

  return (
    <span
      className='inline-flex shrink-0 items-center justify-center rounded-md font-semibold select-none'
      style={{
        ...style,
        backgroundColor: 'var(--semi-color-primary-light-default)',
        color: 'var(--semi-color-primary)',
        fontSize: Math.max(9, Math.floor(size * 0.45)),
      }}
    >
      {label}
    </span>
  );
};

const renderSourceTag = (record, t) => {
  if (record.source === 'factory') {
    return <Tag color='grey'>{t('内置')}</Tag>;
  }
  if (record.source === 'override_over_factory') {
    return (
      <Tag color='blue'>
        {t('自定义（覆盖内置 {{version}}）', {
          version: record.factory_meta?.version || '',
        })}
      </Tag>
    );
  }
  return <Tag color='blue'>{t('第三方')}</Tag>;
};

const renderRuntimeTag = (record, t) => {
  const status = record.runtime_status;
  if (status === 'registered') {
    return <Tag color='green'>{t('已注册')}</Tag>;
  }
  if (status === 'compile_failed') {
    return (
      <Tag color='red' title={record.runtime_error}>
        {t('编译失败')}
      </Tag>
    );
  }
  if (status === 'disabled') {
    return <Tag color='grey'>{t('已停用')}</Tag>;
  }
  if (status === 'disabled_fallback') {
    return (
      <Tag color='grey'>
        {record.factory_meta
          ? t('已停用，回退到内置')
          : t('已停用，平台不可用')}
      </Tag>
    );
  }
  return <Tag color='grey'>{t('未注册')}</Tag>;
};

const TaskPluginsTable = (props) => {
  const {
    pagedPlugins,
    loading,
    openDetail,
    openUpload,
    requestStatusChange,
    deleteVersion,
    t,
  } = props;

  const columns = [
    {
      title: t('插件'),
      dataIndex: 'plugin',
      key: 'plugin',
      width: 260,
      render: (_, record) => {
        const meta = record.meta || {};
        return (
          <div className='flex items-center gap-2 min-w-0'>
            <TaskPluginIcon
              pluginKey={meta.key}
              hasIcon={record.has_icon}
              size={22}
            />
            <div className='min-w-0'>
              <div className='truncate font-medium'>{meta.name || '-'}</div>
              <div
                className='truncate'
                style={{
                  fontFamily: 'var(--semi-font-family-mono)',
                  fontSize: 12,
                  color: 'var(--semi-color-text-2)',
                }}
              >
                {meta.key || '-'}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: t('当前版本'),
      dataIndex: 'version',
      key: 'version',
      width: 110,
      render: (_, record) => record.meta?.version || '-',
    },
    {
      title: t('来源'),
      dataIndex: 'source',
      key: 'source',
      width: 170,
      render: (_, record) => renderSourceTag(record, t),
    },
    {
      title: t('运行时状态'),
      dataIndex: 'runtime',
      key: 'runtime',
      width: 130,
      render: (_, record) => renderRuntimeTag(record, t),
    },
    {
      title: t('作者'),
      dataIndex: 'author',
      key: 'author',
      width: 130,
      render: (_, record) => record.meta?.author?.name || '-',
    },
    {
      title: t('模型数'),
      dataIndex: 'models',
      key: 'models',
      width: 80,
      render: (_, record) => record.meta?.models?.length ?? 0,
    },
    {
      title: t('路由数'),
      dataIndex: 'routes',
      key: 'routes',
      width: 80,
      render: (_, record) => record.meta?.routes?.length ?? 0,
    },
    {
      title: t('启用'),
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (_, record) => (
        <Switch
          size='small'
          checked={record.enabled}
          aria-label={t('启用插件 {{key}}', { key: record.meta?.key || '' })}
          onChange={(checked) => requestStatusChange(record, checked)}
        />
      ),
    },
    {
      title: t('更新时间'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 170,
      render: (_, record) => {
        const timestamp = record.updated_at || record.created_at;
        return timestamp ? timestamp2string(timestamp) : '-';
      },
    },
    {
      title: t('操作'),
      dataIndex: 'actions',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button
            size='small'
            theme='borderless'
            type='primary'
            icon={<Eye size={14} />}
            onClick={() => openDetail(record)}
          >
            {t('详情')}
          </Button>
          <Button
            size='small'
            theme='borderless'
            icon={<Upload size={14} />}
            onClick={() => openUpload(record.meta?.key)}
          >
            {t('上传新版本')}
          </Button>
          <Button
            size='small'
            theme='borderless'
            type='danger'
            icon={<Trash2 size={14} />}
            disabled={record.source === 'factory'}
            onClick={() =>
              deleteVersion(record.meta?.key, record.meta?.version)
            }
          >
            {t('删除')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <CardTable
      columns={columns}
      dataSource={pagedPlugins}
      rowKey={(record) => record.meta?.key || record.source_hash}
      loading={loading}
      scroll={{ x: 'max-content' }}
      className='rounded-xl overflow-hidden'
      size='small'
      empty={
        <Empty
          image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
          darkModeImage={
            <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
          }
          description={t('暂无任务插件')}
          style={{ padding: 30 }}
        />
      }
      hidePagination={true}
    />
  );
};

export default TaskPluginsTable;
