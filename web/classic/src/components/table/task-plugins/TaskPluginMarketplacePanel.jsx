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
  Banner,
  Button,
  Empty,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconDelete, IconPlus, IconRefresh } from '@douyinfe/semi-icons';

const { Text } = Typography;

const DEFAULT_INDEX_URLS = [
  'https://www.newapi.ai/api/v1/plugins/index.json',
  'https://raw.githubusercontent.com/QuantumNous/new-api-plugins/main/index.json',
];

const isDefaultSource = (url) =>
  DEFAULT_INDEX_URLS.includes(String(url).trim());

/**
 * 只读解析市场索引：索引仅作为展示缓存，安装时的准入仍由后端在编译源码后判定，
 * 因此这里对畸形条目做跳过而不是整体失败。
 */
const parseIndex = (payload) => {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray(payload.plugins)
  ) {
    return { name: '', plugins: [] };
  }
  const plugins = payload.plugins
    .filter(
      (entry) => entry && typeof entry.key === 'string' && entry.key.trim(),
    )
    .map((entry) => ({
      key: entry.key.trim(),
      name:
        typeof entry.name === 'string' && entry.name
          ? entry.name
          : entry.key.trim(),
      latest: typeof entry.latest === 'string' ? entry.latest : '',
      description:
        typeof entry.description === 'string' ? entry.description : '',
      models: Array.isArray(entry.models) ? entry.models.length : 0,
      versions: Array.isArray(entry.versions) ? entry.versions.length : 0,
    }));
  return {
    name: typeof payload.name === 'string' ? payload.name : '',
    plugins,
  };
};

const TaskPluginMarketplacePanel = ({
  marketplaceSources,
  marketplaceLoading,
  saveMarketplaceSources,
  t,
}) => {
  const [selectedIndexUrl, setSelectedIndexUrl] = useState('');
  const [indexName, setIndexName] = useState('');
  const [indexPlugins, setIndexPlugins] = useState([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const [indexError, setIndexError] = useState('');

  const [sourcesModalVisible, setSourcesModalVisible] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const rowIdRef = useRef(0);

  const nextRowId = () => {
    rowIdRef.current += 1;
    return `row-${rowIdRef.current}`;
  };

  useEffect(() => {
    const urls = marketplaceSources.map((source) => source.index_url);
    if (!urls.length) {
      setSelectedIndexUrl('');
      return;
    }
    if (!urls.includes(selectedIndexUrl)) {
      setSelectedIndexUrl(urls[0]);
    }
  }, [marketplaceSources, selectedIndexUrl]);

  const selectedSource = useMemo(
    () =>
      marketplaceSources.find(
        (source) => source.index_url === selectedIndexUrl,
      ) || null,
    [marketplaceSources, selectedIndexUrl],
  );

  const fetchIndex = useCallback(
    async (indexUrl) => {
      if (!indexUrl) return;
      setIndexLoading(true);
      setIndexError('');
      try {
        const response = await fetch(indexUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const parsed = parseIndex(payload);
        setIndexName(parsed.name);
        setIndexPlugins(parsed.plugins);
      } catch (error) {
        setIndexName('');
        setIndexPlugins([]);
        setIndexError(error?.message || t('加载失败'));
      } finally {
        setIndexLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (selectedIndexUrl) {
      fetchIndex(selectedIndexUrl);
    }
  }, [selectedIndexUrl, fetchIndex]);

  const openSourcesModal = () => {
    setDraft(
      marketplaceSources.map((source) => ({
        rowId: nextRowId(),
        name: source.name || '',
        index_url: source.index_url || '',
      })),
    );
    setSourcesModalVisible(true);
  };

  const updateDraft = (index, patch) => {
    setDraft((rows) =>
      rows.map((row, position) =>
        position === index ? { ...row, ...patch } : row,
      ),
    );
  };

  const invalidDraft = draft.some(
    (row) => !row.name.trim() || !row.index_url.trim(),
  );

  const handleSaveSources = async () => {
    if (invalidDraft || saving) return;
    setSaving(true);
    const payload = draft.map((row) => ({
      name: row.name.trim(),
      index_url: row.index_url.trim(),
    }));
    const ok = await saveMarketplaceSources(payload);
    setSaving(false);
    if (ok) {
      setSourcesModalVisible(false);
    }
  };

  const columns = [
    {
      title: t('插件'),
      dataIndex: 'plugin',
      key: 'plugin',
      width: 240,
      render: (_, record) => (
        <div className='min-w-0'>
          <div className='truncate font-medium'>{record.name}</div>
          <div
            className='truncate'
            style={{
              fontFamily: 'var(--semi-font-family-mono)',
              fontSize: 12,
              color: 'var(--semi-color-text-2)',
            }}
          >
            {record.key}
          </div>
        </div>
      ),
    },
    {
      title: t('最新版本'),
      dataIndex: 'latest',
      key: 'latest',
      width: 120,
      render: (value) => value || '-',
    },
    {
      title: t('版本数'),
      dataIndex: 'versions',
      key: 'versions',
      width: 90,
    },
    {
      title: t('模型数'),
      dataIndex: 'models',
      key: 'models',
      width: 90,
    },
    {
      title: t('描述'),
      dataIndex: 'description',
      key: 'description',
      render: (value) => value || '-',
    },
  ];

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Text type='tertiary'>
          {t(
            '插件索引由浏览器直接拉取，安装走与手动上传完全相同的审核与准入流程。',
          )}
        </Text>
        <Space>
          <Button
            size='small'
            icon={<IconRefresh />}
            disabled={!selectedIndexUrl || indexLoading}
            onClick={() => fetchIndex(selectedIndexUrl)}
          >
            {t('刷新')}
          </Button>
          <Button size='small' icon={<IconPlus />} onClick={openSourcesModal}>
            {t('管理来源')}
          </Button>
        </Space>
      </div>

      {marketplaceLoading ? (
        <div className='flex justify-center py-6'>
          <Spin />
        </div>
      ) : null}

      {!marketplaceLoading && marketplaceSources.length === 0 ? (
        <Empty description={t('尚未配置市场来源')} style={{ padding: 30 }} />
      ) : null}

      {marketplaceSources.length > 1 ? (
        <RadioGroup
          type='button'
          value={selectedIndexUrl}
          onChange={(e) => setSelectedIndexUrl(e.target.value)}
        >
          {marketplaceSources.map((source) => (
            <Radio
              key={`${source.index_url}|${source.name}`}
              value={source.index_url}
            >
              {source.name || source.index_url}
            </Radio>
          ))}
        </RadioGroup>
      ) : null}

      {selectedSource ? (
        <>
          <div className='flex flex-wrap items-center gap-2'>
            <Text strong>{indexName || selectedSource.name}</Text>
            {isDefaultSource(selectedSource.index_url) ? (
              <Tag color='green'>{t('官方')}</Tag>
            ) : (
              <Tag color='red'>{t('第三方，请自行承担风险')}</Tag>
            )}
          </div>
          {indexError ? (
            <Banner
              type='danger'
              closeIcon={null}
              description={t(
                '无法加载该来源的索引：{{message}}，可能是跨域请求被拦截。',
                { message: indexError },
              )}
            />
          ) : null}
          <Table
            columns={columns}
            dataSource={indexPlugins}
            rowKey='key'
            loading={indexLoading}
            pagination={false}
            size='small'
            scroll={{ x: 'max-content' }}
            empty={
              <Empty
                description={t('该来源没有可安装的任务插件')}
                style={{ padding: 30 }}
              />
            }
          />
        </>
      ) : null}

      <Modal
        title={t('市场来源')}
        visible={sourcesModalVisible}
        onCancel={() => setSourcesModalVisible(false)}
        onOk={handleSaveSources}
        okText={saving ? t('保存中...') : t('保存')}
        cancelText={t('取消')}
        confirmLoading={saving}
        okButtonProps={{ disabled: invalidDraft }}
        width={640}
      >
        <Space vertical align='start' style={{ width: '100%' }} spacing={12}>
          <Text type='tertiary'>
            {t(
              '每个来源提供一个列出可安装插件的 index.json，索引由浏览器拉取，网关不会发起外部请求。',
            )}
          </Text>
          {draft.length === 0 ? (
            <Text type='tertiary'>{t('尚未配置市场来源')}</Text>
          ) : null}
          {draft.map((row, index) => (
            <div
              key={row.rowId}
              className='w-full rounded-lg border p-3'
              style={{ borderColor: 'var(--semi-color-border)' }}
            >
              <div className='mb-2 flex items-center justify-between gap-2'>
                <Text strong>{t('来源名称')}</Text>
                <div className='flex items-center gap-2'>
                  {isDefaultSource(row.index_url) ? (
                    <Tag color='green'>{t('官方')}</Tag>
                  ) : (
                    <Tag color='red'>{t('第三方，请自行承担风险')}</Tag>
                  )}
                  <Button
                    size='small'
                    theme='borderless'
                    type='danger'
                    icon={<IconDelete />}
                    onClick={() =>
                      setDraft((rows) =>
                        rows.filter((_, position) => position !== index),
                      )
                    }
                  />
                </div>
              </div>
              <Input
                value={row.name}
                placeholder={t('来源名称')}
                onChange={(value) => updateDraft(index, { name: value })}
              />
              <div className='mt-2'>
                <Input
                  value={row.index_url}
                  placeholder='https://example.com/index.json'
                  onChange={(value) => updateDraft(index, { index_url: value })}
                />
              </div>
            </div>
          ))}
          <Button
            icon={<IconPlus />}
            onClick={() =>
              setDraft((rows) => [
                ...rows,
                { rowId: nextRowId(), name: '', index_url: '' },
              ])
            }
          >
            {t('添加来源')}
          </Button>
          <Banner
            type='warning'
            closeIcon={null}
            description={t(
              '任何人都可以发布索引。从第三方来源安装的插件与你手动上传的插件拥有相同权限，安装前请先审阅源码。',
            )}
          />
        </Space>
      </Modal>
    </div>
  );
};

export default TaskPluginMarketplacePanel;
