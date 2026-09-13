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
import {
  Banner,
  Button,
  Descriptions,
  Empty,
  SideSheet,
  Space,
  Spin,
  Table,
  Tabs,
  TabPane,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconClose } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { TaskPluginIcon } from './TaskPluginsTable';

const { Text, Title } = Typography;

const resolveLocalizedText = (value, language) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const base = String(language || '').toLowerCase();
    const candidates = [base, base.split('-')[0], 'zh', 'zh-cn', 'en'];
    for (const key of candidates) {
      if (key && typeof value[key] === 'string' && value[key]) {
        return value[key];
      }
    }
    const first = Object.values(value).find(
      (item) => typeof item === 'string' && item,
    );
    return first || '';
  }
  return '';
};

const formatUnit = (unit, t) => {
  if (unit === 'second') return t('秒');
  if (unit === 'count') return t('次数');
  if (unit === 'token') return t('token（单位）');
  if (unit === 'credit') return t('credit');
  return '-';
};

const formatType = (type, t) => {
  if (type === 'number') return t('数字');
  if (type === 'boolean') return t('布尔');
  return t('枚举');
};

const TaskPluginDetail = ({
  detailVisible,
  closeDetail,
  detailPlugin,
  detailData,
  detailLoading,
  versions,
  versionsLoading,
  activateVersion,
  deleteVersion,
  dryRun,
  t,
}) => {
  const isMobile = useIsMobile();
  const { i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');

  const [hookName, setHookName] = useState('');
  const [hookMember, setHookMember] = useState('');
  const [argsText, setArgsText] = useState('[]');
  const [dryRunResult, setDryRunResult] = useState('');
  const [dryRunError, setDryRunError] = useState('');
  const [dryRunning, setDryRunning] = useState(false);

  const pluginKey = detailPlugin?.meta?.key || '';

  useEffect(() => {
    if (detailVisible) {
      setActiveTab('overview');
      setHookName('');
      setHookMember('');
      setArgsText('[]');
      setDryRunResult('');
      setDryRunError('');
    }
  }, [detailVisible, pluginKey]);

  const meta = detailData?.meta || detailPlugin?.meta || {};
  const source = detailData?.source || '';
  const hasIcon = detailData?.has_icon ?? detailPlugin?.has_icon;

  const description = useMemo(
    () => resolveLocalizedText(meta.description, i18n.language),
    [meta.description, i18n.language],
  );

  const overviewData = [
    { key: t('插件名称'), value: meta.name || '-' },
    { key: t('插件 Key'), value: meta.key || '-' },
    { key: t('版本'), value: meta.version || '-' },
    { key: t('API 版本'), value: String(meta.apiVersion ?? '-') },
    { key: t('作者'), value: meta.author?.name || '-' },
    {
      key: t('排序优先级'),
      value: String(meta.sortPriority ?? 0),
    },
    { key: t('抓取模式'), value: meta.fetchMode || '-' },
    {
      key: t('渠道类型'),
      value: meta.channelTypes?.length
        ? meta.channelTypes.map((type) => `#${type}`).join(', ')
        : t('任务插件'),
    },
    { key: t('默认 Base URL'), value: meta.baseUrl || '-' },
    { key: t('插件网站'), value: meta.website || '-' },
    {
      key: t('描述'),
      value: description || t('未声明'),
    },
  ];

  const modelList = meta.models || [];

  const routeList = meta.routes || [];
  const protocolList = meta.protocols || [];
  const usageSchema = meta.usageSchema || {};
  const usageEntries = Object.entries(usageSchema);
  const hasUsageSchema = usageEntries.length > 0;

  const versionColumns = [
    {
      title: t('版本'),
      dataIndex: 'version',
      key: 'version',
      render: (text) => (
        <span style={{ fontFamily: 'var(--semi-font-family-mono)' }}>
          {text}
        </span>
      ),
    },
    {
      title: t('备注'),
      dataIndex: 'remark',
      key: 'remark',
      render: (text) => text || '-',
    },
    {
      title: t('状态'),
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active) =>
        active ? <Tag color='green'>{t('当前版本')}</Tag> : '-',
    },
    {
      title: t('操作'),
      key: 'actions',
      width: 170,
      render: (_, record) => (
        <Space>
          <Button
            size='small'
            theme='borderless'
            type='primary'
            disabled={record.active}
            onClick={() => activateVersion(pluginKey, record.version)}
          >
            {t('激活 / 回滚')}
          </Button>
          <Button
            size='small'
            theme='borderless'
            type='danger'
            onClick={() => deleteVersion(pluginKey, record.version)}
          >
            {t('删除')}
          </Button>
        </Space>
      ),
    },
  ];

  const usageSchemaColumns = [
    { title: t('名称'), dataIndex: 'name', key: 'name' },
    { title: t('类型'), dataIndex: 'type', key: 'type', width: 100 },
    { title: t('单位'), dataIndex: 'unit', key: 'unit', width: 120 },
    {
      title: t('枚举值'),
      dataIndex: 'enum',
      key: 'enum',
      render: (values) => (values?.length ? values.join(', ') : '-'),
    },
    { title: t('描述'), dataIndex: 'description', key: 'description' },
  ];

  const usageSchemaData = usageEntries
    .map(([name, definition]) => ({
      key: name,
      name,
      type: formatType(definition?.type, t),
      unit: formatUnit(definition?.unit, t),
      enum: definition?.enum,
      description:
        resolveLocalizedText(definition?.description, i18n.language) || '-',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleDryRun = async () => {
    if (!hookName.trim() || dryRunning) return;
    let args;
    try {
      args = argsText.trim() ? JSON.parse(argsText) : [];
    } catch (error) {
      setDryRunError(t('参数必须是合法的 JSON 数组'));
      setDryRunResult('');
      return;
    }
    if (!Array.isArray(args)) {
      setDryRunError(t('参数必须是合法的 JSON 数组'));
      setDryRunResult('');
      return;
    }
    setDryRunning(true);
    setDryRunError('');
    setDryRunResult('');
    const outcome = await dryRun(pluginKey, {
      hook: hookName.trim(),
      member: hookMember.trim() || undefined,
      args,
    });
    setDryRunning(false);
    if (outcome?.success) {
      setDryRunResult(
        typeof outcome.data === 'string'
          ? outcome.data
          : JSON.stringify(outcome.data, null, 2),
      );
    } else {
      setDryRunError(outcome?.message || t('试运行失败'));
    }
  };

  const renderOverview = () => {
    if (detailLoading) {
      return (
        <div className='flex justify-center py-10'>
          <Spin />
        </div>
      );
    }
    return (
      <div className='flex flex-col gap-4'>
        <Descriptions data={overviewData} row />
        <div>
          <Title heading={6}>
            {t('模型')}（{modelList.length}）
          </Title>
          {modelList.length ? (
            <div className='mt-2 flex flex-wrap gap-1'>
              {modelList.map((model) => (
                <Tag key={model} color='white'>
                  {model}
                </Tag>
              ))}
            </div>
          ) : (
            <Text type='tertiary'>{t('未声明')}</Text>
          )}
        </div>
        <div>
          <Title heading={6}>{t('路由 / 端点')}</Title>
          {routeList.length === 0 && protocolList.length === 0 ? (
            <Text type='tertiary'>{t('未声明')}</Text>
          ) : (
            <div className='mt-2 flex flex-col gap-1'>
              {protocolList.map((claim) => {
                const name = typeof claim === 'string' ? claim : claim.name;
                const supports =
                  typeof claim === 'string' ? [] : claim.supports || [];
                return (
                  <div
                    key={`protocol-${name}`}
                    className='flex items-center gap-2'
                  >
                    <Tag color='blue'>{t('标准协议')}</Tag>
                    <span
                      style={{ fontFamily: 'var(--semi-font-family-mono)' }}
                    >
                      {name}
                    </span>
                    {supports.length ? (
                      <Text type='tertiary'>{supports.join(' / ')}</Text>
                    ) : null}
                  </div>
                );
              })}
              {routeList.map((route) => (
                <div
                  key={`${route.method}-${route.path}`}
                  className='flex items-center gap-2'
                >
                  <Tag color='green'>{route.method}</Tag>
                  <span style={{ fontFamily: 'var(--semi-font-family-mono)' }}>
                    {route.path}
                  </span>
                  <Text type='tertiary'>{route.type}</Text>
                  {route.models?.length ? (
                    <Text type='tertiary'>({route.models.length} models)</Text>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSource = () => {
    if (!source) {
      return <Empty description={t('暂无源码')} />;
    }
    return (
      <pre
        className='m-0 overflow-auto rounded-lg p-3'
        style={{
          maxHeight: '60vh',
          backgroundColor: 'var(--semi-color-fill-0)',
          fontFamily: 'var(--semi-font-family-mono)',
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {source}
      </pre>
    );
  };

  return (
    <SideSheet
      placement='right'
      visible={detailVisible}
      width={isMobile ? '100%' : 900}
      onCancel={closeDetail}
      closeIcon={<IconClose aria-label={t('关闭')} />}
      title={
        <div className='flex items-center gap-2 min-w-0'>
          <TaskPluginIcon pluginKey={pluginKey} hasIcon={hasIcon} size={26} />
          <span className='truncate'>{meta.name || t('插件详情')}</span>
          <Tag color='white'>{meta.version || '-'}</Tag>
        </div>
      }
      bodyStyle={{ padding: '12px 16px' }}
    >
      <Tabs
        type='line'
        activeKey={activeTab}
        onChange={setActiveTab}
        lazyRender
      >
        <TabPane tab={t('概览')} itemKey='overview'>
          {renderOverview()}
        </TabPane>
        <TabPane tab={t('计费参数')} itemKey='billing'>
          {hasUsageSchema ? (
            <Table
              columns={usageSchemaColumns}
              dataSource={usageSchemaData}
              pagination={false}
              size='small'
              scroll={{ x: 'max-content' }}
            />
          ) : (
            <Empty description={t('未声明计费参数')} />
          )}
        </TabPane>
        <TabPane tab={t('插件源码')} itemKey='source'>
          {renderSource()}
        </TabPane>
        <TabPane tab={t('版本历史')} itemKey='versions'>
          <Table
            columns={versionColumns}
            dataSource={versions}
            rowKey='id'
            loading={versionsLoading}
            pagination={false}
            size='small'
          />
        </TabPane>
        <TabPane tab={t('试运行')} itemKey='dryrun'>
          <Space vertical align='start' style={{ width: '100%' }} spacing={12}>
            <Banner
              type='info'
              closeIcon={null}
              description={t(
                '试运行会在当前激活的插件版本上调用指定的 Hook，请先确认参数合法。',
              )}
            />
            <div className='w-full'>
              <Text strong>{t('Hook 名称')}</Text>
              <TextArea
                className='!mt-2'
                rows={1}
                value={hookName}
                placeholder='fetch'
                onChange={setHookName}
              />
            </div>
            <div className='w-full'>
              <Text strong>{t('成员名（可选）')}</Text>
              <TextArea
                className='!mt-2'
                rows={1}
                value={hookMember}
                onChange={setHookMember}
              />
            </div>
            <div className='w-full'>
              <Text strong>{t('参数（JSON 数组）')}</Text>
              <TextArea
                className='!mt-2'
                rows={4}
                value={argsText}
                onChange={setArgsText}
              />
            </div>
            <Button
              theme='solid'
              type='primary'
              loading={dryRunning}
              disabled={!hookName.trim()}
              onClick={handleDryRun}
            >
              {t('执行试运行')}
            </Button>
            {dryRunError ? (
              <Banner
                type='danger'
                closeIcon={null}
                description={dryRunError}
              />
            ) : null}
            {dryRunResult ? (
              <pre
                className='m-0 w-full overflow-auto rounded-lg p-3'
                style={{
                  maxHeight: '40vh',
                  backgroundColor: 'var(--semi-color-fill-0)',
                  fontFamily: 'var(--semi-font-family-mono)',
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                {dryRunResult}
              </pre>
            ) : null}
          </Space>
        </TabPane>
      </Tabs>
    </SideSheet>
  );
};

export default TaskPluginDetail;
