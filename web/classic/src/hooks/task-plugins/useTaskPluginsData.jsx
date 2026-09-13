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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';

const PLUGIN_LIST_URL = '/api/plugin/task';
const MARKETPLACE_SOURCES_URL = '/api/plugin/task/marketplace/sources';
const RUNTIME_STATUS_URL = '/api/plugin/task/runtime/status';

const pluginUrl = (key, suffix = '') =>
  `${PLUGIN_LIST_URL}/${encodeURIComponent(key)}${suffix}`;

export const useTaskPluginsData = () => {
  const { t } = useTranslation();

  // 列表
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [activeTab, setActiveTab] = useState('installed');

  // 全局开关
  const [pluginSystemEnabled, setPluginSystemEnabled] = useState(true);
  const [enabledLoading, setEnabledLoading] = useState(false);

  // 运行时状态
  const [runtimeVisible, setRuntimeVisible] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);

  // 上传弹窗
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploadTargetKey, setUploadTargetKey] = useState('');

  // 详情
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailPlugin, setDetailPlugin] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // 市场来源
  const [marketplaceSources, setMarketplaceSources] = useState([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(PLUGIN_LIST_URL);
      const { success, message, data } = res.data;
      if (success) {
        setPlugins(Array.isArray(data) ? data : []);
      } else {
        showError(message);
      }
    } catch (error) {
      // 网络错误已由响应拦截器统一提示
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPluginSystemEnabled = useCallback(async () => {
    setEnabledLoading(true);
    try {
      const res = await API.get('/api/option/');
      const { success, data } = res.data;
      if (success && Array.isArray(data)) {
        const option = data.find((item) => item.key === 'TaskPluginEnabled');
        if (option) {
          setPluginSystemEnabled(String(option.value) === 'true');
        }
      }
    } catch (error) {
      // 忽略读取失败，保持默认开启
    } finally {
      setEnabledLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (key, version) => {
    if (!key) return;
    setDetailLoading(true);
    try {
      const res = await API.get(
        pluginUrl(key),
        version ? { params: { version } } : undefined,
      );
      const { success, message, data } = res.data;
      if (success) {
        setDetailData(data);
      } else {
        showError(message);
      }
    } catch (error) {
      // 网络错误已由响应拦截器统一提示
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadVersions = useCallback(async (key) => {
    if (!key) return;
    setVersionsLoading(true);
    try {
      const res = await API.get(pluginUrl(key, '/versions'));
      const { success, message, data } = res.data;
      if (success) {
        setVersions(Array.isArray(data) ? data : []);
      } else {
        showError(message);
      }
    } catch (error) {
      // 网络错误已由响应拦截器统一提示
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const loadMarketplaceSources = useCallback(async () => {
    setMarketplaceLoading(true);
    try {
      const res = await API.get(MARKETPLACE_SOURCES_URL);
      const { success, message, data } = res.data;
      if (success) {
        setMarketplaceSources(Array.isArray(data) ? data : []);
      } else {
        showError(message);
      }
    } catch (error) {
      // 网络错误已由响应拦截器统一提示
    } finally {
      setMarketplaceLoading(false);
    }
  }, []);

  const saveMarketplaceSources = useCallback(
    async (sources) => {
      try {
        const res = await API.put(MARKETPLACE_SOURCES_URL, sources);
        const { success, message, data } = res.data;
        if (success) {
          setMarketplaceSources(Array.isArray(data) ? data : sources);
          showSuccess(t('市场来源已保存'));
          return true;
        }
        showError(message);
        return false;
      } catch (error) {
        return false;
      }
    },
    [t],
  );

  const savePluginSystemEnabled = useCallback(
    async (enabled) => {
      const apply = async () => {
        try {
          const res = await API.put('/api/option/', {
            key: 'TaskPluginEnabled',
            value: String(enabled),
          });
          const { success, message } = res.data;
          if (success) {
            setPluginSystemEnabled(enabled);
            showSuccess(t('任务插件开关已更新'));
          } else {
            showError(message);
          }
        } catch (error) {
          // 网络错误已由响应拦截器统一提示
        }
      };
      if (enabled) {
        await apply();
        return;
      }
      Modal.confirm({
        title: t('确认停用任务插件系统？'),
        content: t(
          '停用后，内置插件与自定义插件都会立即停止提供服务，进行中的任务将由超时清理处理。',
        ),
        okText: t('停用'),
        cancelText: t('取消'),
        okButtonProps: { type: 'danger' },
        onOk: apply,
      });
    },
    [t],
  );

  const usageContent = useCallback(
    (usage) => (
      <div className='flex flex-col gap-1'>
        <div>
          {t('仍有 {{count}} 个渠道与 {{tasks}} 个进行中的任务在使用该插件。', {
            count: usage.channels.length,
            tasks: usage.in_flight_count,
          })}
        </div>
        {usage.channels.length > 0 && (
          <ul className='list-disc pl-5'>
            {usage.channels.map((channel) => (
              <li key={channel.id}>
                #{channel.id} {channel.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    ),
    [t],
  );

  const setPluginStatus = useCallback(
    async (key, enabled, options) => {
      try {
        const res = await API.post(
          pluginUrl(key, '/status'),
          { enabled },
          options ? { params: options } : undefined,
        );
        const { success, message, data } = res.data;
        if (success) {
          showSuccess(enabled ? t('插件已启用') : t('插件已停用'));
          await loadPlugins();
          return { success: true };
        }
        if (
          data &&
          Array.isArray(data.channels) &&
          typeof data.in_flight_count === 'number'
        ) {
          return { blocked: true, usage: data, message };
        }
        showError(message);
        return { success: false };
      } catch (error) {
        return { success: false };
      }
    },
    [loadPlugins, t],
  );

  const requestStatusChange = useCallback(
    (plugin, enabled) => {
      const name = plugin?.meta?.name || '';
      const key = plugin?.meta?.key || '';
      Modal.confirm({
        title: enabled ? t('确认启用该插件？') : t('确认停用该插件？'),
        content: enabled
          ? t('确认启用插件 {{name}}（{{key}}）？', { name, key })
          : t('停用插件 {{name}}（{{key}}）后，使用该插件的请求可能受影响。', {
              name,
              key,
            }),
        okText: enabled ? t('启用') : t('停用'),
        cancelText: t('取消'),
        okButtonProps: { type: enabled ? 'primary' : 'danger' },
        onOk: async () => {
          const outcome = await setPluginStatus(key, enabled);
          if (outcome?.blocked) {
            Modal.confirm({
              title: t('插件仍在使用中'),
              content: usageContent(outcome.usage),
              okText: t('强制操作'),
              cancelText: t('取消'),
              okButtonProps: { type: 'danger' },
              onOk: () =>
                setPluginStatus(key, enabled, { cascade: true, force: true }),
            });
          }
        },
      });
    },
    [setPluginStatus, usageContent, t],
  );

  const activateVersion = useCallback(
    async (key, version) => {
      try {
        const res = await API.post(pluginUrl(key, '/activate'), { version });
        const { success, message } = res.data;
        if (success) {
          showSuccess(t('插件版本已激活'));
          await loadPlugins();
          await Promise.all([loadDetail(key), loadVersions(key)]);
          return true;
        }
        showError(message);
        return false;
      } catch (error) {
        return false;
      }
    },
    [loadPlugins, loadDetail, loadVersions, t],
  );

  const deleteVersion = useCallback(
    (key, version) => {
      const run = async (force) => {
        try {
          const res = await API.delete(
            pluginUrl(key, `/versions/${encodeURIComponent(version)}`),
            force ? { params: { force: true } } : undefined,
          );
          const { success, message, data } = res.data;
          if (success) {
            showSuccess(t('插件版本已删除'));
            await loadPlugins();
            if (detailVisible && detailPlugin?.meta?.key === key) {
              await Promise.all([loadDetail(key), loadVersions(key)]);
            }
            return { success: true };
          }
          if (data && Array.isArray(data.channels)) {
            return { blocked: true, usage: data };
          }
          showError(message);
          return { success: false };
        } catch (error) {
          return { success: false };
        }
      };
      Modal.confirm({
        title: t('确认删除该插件版本？'),
        content: t(
          '删除 {{key}}@{{version}} 后不可恢复；若存在同名内置插件，会自动回退到内置版本。',
          { key, version },
        ),
        okText: t('删除'),
        cancelText: t('取消'),
        okButtonProps: { type: 'danger' },
        onOk: async () => {
          const outcome = await run(false);
          if (outcome?.blocked) {
            Modal.confirm({
              title: t('插件仍在使用中'),
              content: usageContent(outcome.usage),
              okText: t('强制删除'),
              cancelText: t('取消'),
              okButtonProps: { type: 'danger' },
              onOk: () => run(true),
            });
          }
        },
      });
    },
    [
      loadPlugins,
      loadDetail,
      loadVersions,
      detailVisible,
      detailPlugin,
      usageContent,
      t,
    ],
  );

  const uploadPlugin = useCallback(
    async ({ source, remark, icon }) => {
      try {
        const res = await API.post(PLUGIN_LIST_URL, {
          source,
          remark: remark || '',
          icon: icon || undefined,
        });
        const { success, message, data } = res.data;
        if (success) {
          showSuccess(t('插件上传成功'));
          await loadPlugins();
          return { success: true, data };
        }
        return { success: false, message };
      } catch (error) {
        return {
          success: false,
          message: error?.message || t('插件上传失败'),
        };
      }
    },
    [loadPlugins, t],
  );

  const dryRun = useCallback(async (key, payload) => {
    try {
      const res = await API.post(pluginUrl(key, '/dryrun'), payload);
      const { success, message, data } = res.data;
      if (success) {
        return { success: true, data };
      }
      return { success: false, message };
    } catch (error) {
      return { success: false, message: error?.message };
    }
  }, []);

  const openRuntimeStatus = useCallback(async () => {
    setRuntimeVisible(true);
    setRuntimeLoading(true);
    try {
      const res = await API.get(RUNTIME_STATUS_URL);
      const { success, message, data } = res.data;
      if (success) {
        setRuntimeStatus(data);
      } else {
        showError(message);
      }
    } catch (error) {
      // 网络错误已由响应拦截器统一提示
    } finally {
      setRuntimeLoading(false);
    }
  }, []);

  const openUpload = useCallback((key = '') => {
    setUploadTargetKey(key || '');
    setUploadVisible(true);
  }, []);

  const closeUpload = useCallback(() => {
    setUploadVisible(false);
    setUploadTargetKey('');
  }, []);

  const openDetail = useCallback(
    (plugin) => {
      const key = plugin?.meta?.key;
      setDetailPlugin(plugin);
      setDetailData(null);
      setVersions([]);
      setDetailVisible(true);
      if (key) {
        loadDetail(key);
        loadVersions(key);
      }
    },
    [loadDetail, loadVersions],
  );

  const closeDetail = useCallback(() => {
    setDetailVisible(false);
    setDetailPlugin(null);
    setDetailData(null);
    setVersions([]);
  }, []);

  const refresh = useCallback(() => {
    loadPlugins();
    loadPluginSystemEnabled();
    loadMarketplaceSources();
  }, [loadPlugins, loadPluginSystemEnabled, loadMarketplaceSources]);

  const filteredPlugins = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return plugins;
    return plugins.filter((plugin) => {
      const meta = plugin.meta || {};
      return [meta.name, meta.key, meta.author?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [plugins, keyword]);

  const pagedPlugins = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return filteredPlugins.slice(start, start + pageSize);
  }, [filteredPlugins, activePage, pageSize]);

  const handlePageChange = useCallback((page) => setActivePage(page), []);

  const handlePageSizeChange = useCallback((size) => {
    setPageSize(size);
    setActivePage(1);
  }, []);

  useEffect(() => {
    loadPlugins();
    loadPluginSystemEnabled();
    loadMarketplaceSources();
  }, [loadPlugins, loadPluginSystemEnabled, loadMarketplaceSources]);

  useEffect(() => {
    setActivePage(1);
  }, [keyword]);

  return {
    t,

    // 列表
    plugins,
    filteredPlugins,
    pagedPlugins,
    loading,
    keyword,
    setKeyword,
    activePage,
    pageSize,
    total: filteredPlugins.length,
    activeTab,
    setActiveTab,
    loadPlugins,
    refresh,
    handlePageChange,
    handlePageSizeChange,

    // 全局开关
    pluginSystemEnabled,
    enabledLoading,
    savePluginSystemEnabled,

    // 运行时状态
    runtimeVisible,
    setRuntimeVisible,
    runtimeStatus,
    runtimeLoading,
    openRuntimeStatus,

    // 上传弹窗
    uploadVisible,
    uploadTargetKey,
    openUpload,
    closeUpload,
    uploadPlugin,

    // 详情
    detailVisible,
    detailPlugin,
    detailData,
    detailLoading,
    versions,
    versionsLoading,
    openDetail,
    closeDetail,
    loadDetail,
    loadVersions,

    // 操作
    requestStatusChange,
    activateVersion,
    deleteVersion,
    dryRun,

    // 市场来源
    marketplaceSources,
    marketplaceLoading,
    loadMarketplaceSources,
    saveMarketplaceSources,
  };
};
