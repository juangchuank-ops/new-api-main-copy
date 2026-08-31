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

import { useState, useEffect, useMemo, useContext, useRef } from 'react';
import { StatusContext } from '../../context/Status';
import { API } from '../../helpers';

// 创建一个全局事件系统来同步所有useSidebar实例
const sidebarEventTarget = new EventTarget();
const SIDEBAR_REFRESH_EVENT = 'sidebar-refresh';

export const DEFAULT_ADMIN_CONFIG = {
  chat: {
    enabled: true,
    playground: true,
    chat: true,
  },
  console: {
    enabled: true,
    detail: true,
    token: true,
    log: true,
    midjourney: true,
    task: true,
  },
  personal: {
    enabled: true,
    topup: true,
    personal: true,
    transfer: true,
  },
  admin: {
    enabled: true,
    channel: true,
    models: true,
    deployment: true,
    redemption: true,
    'invitation-code': true,
    user: true,
    subscription: true,
    setting: true,
    'system-info': true,
    banner: true,
    'upstream-account': true,
    'ip-ban': true,
    'browser-fingerprint-ban': true,
  },
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

export const mergeAdminConfig = (savedConfig) => {
  const merged = deepClone(DEFAULT_ADMIN_CONFIG);
  if (!savedConfig || typeof savedConfig !== 'object') return merged;

  for (const [sectionKey, sectionConfig] of Object.entries(savedConfig)) {
    if (!sectionConfig || typeof sectionConfig !== 'object') continue;

    if (!merged[sectionKey]) {
      merged[sectionKey] = { ...sectionConfig };
      continue;
    }

    merged[sectionKey] = { ...merged[sectionKey], ...sectionConfig };
  }

  return merged;
};

export const useSidebar = () => {
  const [statusState] = useContext(StatusContext);
  const [userConfig, setUserConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const instanceIdRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);
  const userConfigRequestRef = useRef(null);

  if (!instanceIdRef.current) {
    const randomPart = Math.random().toString(16).slice(2);
    instanceIdRef.current = `sidebar-${Date.now()}-${randomPart}`;
  }

  // 获取管理员配置
  const adminConfig = useMemo(() => {
    if (statusState?.status?.SidebarModulesAdmin) {
      try {
        const config = JSON.parse(statusState.status.SidebarModulesAdmin);
        return mergeAdminConfig(config);
      } catch (error) {
        return mergeAdminConfig(null);
      }
    }
    return mergeAdminConfig(null);
  }, [statusState?.status?.SidebarModulesAdmin]);

  // 加载用户配置的通用方法
  const loadUserConfig = async ({ withLoading } = {}) => {
    if (userConfigRequestRef.current) {
      return userConfigRequestRef.current;
    }

    const request = (async () => {
      const shouldShowLoader =
        typeof withLoading === 'boolean'
          ? withLoading
          : !hasLoadedOnceRef.current;

      try {
        if (shouldShowLoader) {
          setLoading(true);
        }

        const res = await API.get('/api/user/self');
        const selfData = res.data.data;
        if (selfData?.role !== undefined || selfData?.sidebar_modules !== undefined) {
          try {
            const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
            const nextUser = {
              ...cachedUser,
              ...(selfData?.role !== undefined ? { role: selfData.role } : {}),
              ...(selfData?.id !== undefined ? { id: selfData.id } : {}),
              ...(selfData?.sidebar_modules !== undefined
                ? { sidebar_modules: selfData.sidebar_modules }
                : {}),
            };
            const userChanged =
              cachedUser.role !== nextUser.role ||
              cachedUser.id !== nextUser.id ||
              JSON.stringify(cachedUser.sidebar_modules) !==
                JSON.stringify(nextUser.sidebar_modules);
            if (userChanged) {
              localStorage.setItem('user', JSON.stringify(nextUser));
              window.dispatchEvent(new Event('user-updated'));
            }
          } catch (e) {
            // Ignore malformed local user data; sidebar config still applies.
          }
        }
        if (res.data.success && res.data.data.sidebar_modules) {
          let config;
          // 检查sidebar_modules是字符串还是对象
          if (typeof res.data.data.sidebar_modules === 'string') {
            config = JSON.parse(res.data.data.sidebar_modules);
          } else {
            config = res.data.data.sidebar_modules;
          }
          setUserConfig(config);
        } else {
          // 当用户没有配置时，生成一个基于管理员配置的默认用户配置
          // 这样可以确保权限控制正确生效
          const defaultUserConfig = {};
          Object.keys(adminConfig).forEach((sectionKey) => {
            if (adminConfig[sectionKey]?.enabled) {
              defaultUserConfig[sectionKey] = { enabled: true };
              // 为每个管理员允许的模块设置默认值为true
              Object.keys(adminConfig[sectionKey]).forEach((moduleKey) => {
                if (
                  moduleKey !== 'enabled' &&
                  adminConfig[sectionKey][moduleKey]
                ) {
                  defaultUserConfig[sectionKey][moduleKey] = true;
                }
              });
            }
          });
          setUserConfig(defaultUserConfig);
        }
      } catch (error) {
        // 出错时也生成默认配置，而不是设置为空对象
        const defaultUserConfig = {};
        Object.keys(adminConfig).forEach((sectionKey) => {
          if (adminConfig[sectionKey]?.enabled) {
            defaultUserConfig[sectionKey] = { enabled: true };
            Object.keys(adminConfig[sectionKey]).forEach((moduleKey) => {
              if (moduleKey !== 'enabled' && adminConfig[sectionKey][moduleKey]) {
                defaultUserConfig[sectionKey][moduleKey] = true;
              }
            });
          }
        });
        setUserConfig(defaultUserConfig);
      } finally {
        if (shouldShowLoader) {
          setLoading(false);
        }
        hasLoadedOnceRef.current = true;
      }
    })();

    userConfigRequestRef.current = request;
    try {
      return await request;
    } finally {
      if (userConfigRequestRef.current === request) {
        userConfigRequestRef.current = null;
      }
    }
  };

  // 刷新用户配置的方法（供外部调用）
  const refreshUserConfig = async () => {
    if (Object.keys(adminConfig).length > 0) {
      await loadUserConfig({ withLoading: false });
    }

    // 触发全局刷新事件，通知所有useSidebar实例更新
    sidebarEventTarget.dispatchEvent(
      new CustomEvent(SIDEBAR_REFRESH_EVENT, {
        detail: { sourceId: instanceIdRef.current, skipLoader: true },
      }),
    );
  };

  // 加载用户配置
  useEffect(() => {
    // 只有当管理员配置加载完成后才加载用户配置
    if (Object.keys(adminConfig).length > 0) {
      loadUserConfig();
    }
  }, [adminConfig]);

  // 监听全局刷新事件
  useEffect(() => {
    const handleRefresh = (event) => {
      if (event?.detail?.sourceId === instanceIdRef.current) {
        return;
      }

      if (Object.keys(adminConfig).length > 0) {
        loadUserConfig({
          withLoading: event?.detail?.skipLoader ? false : undefined,
        });
      }
    };

    sidebarEventTarget.addEventListener(SIDEBAR_REFRESH_EVENT, handleRefresh);

    return () => {
      sidebarEventTarget.removeEventListener(
        SIDEBAR_REFRESH_EVENT,
        handleRefresh,
      );
    };
  }, [adminConfig]);

  // Keep an already-mounted sidebar in sync when the current user's role changes.
  useEffect(() => {
    const handleUserUpdated = () => {
      if (Object.keys(adminConfig).length > 0) {
        loadUserConfig({ withLoading: false });
      }
    };

    window.addEventListener('user-updated', handleUserUpdated);
    return () => window.removeEventListener('user-updated', handleUserUpdated);
  }, [adminConfig]);

  // 计算最终的显示配置
  const finalConfig = useMemo(() => {
    const result = {};

    // 确保adminConfig已加载
    if (!adminConfig || Object.keys(adminConfig).length === 0) {
      return result;
    }

    // 如果userConfig未加载，等待加载完成
    if (!userConfig) {
      return result;
    }

    // 遍历所有区域
    Object.keys(adminConfig).forEach((sectionKey) => {
      const adminSection = adminConfig[sectionKey];
      const userSection = userConfig[sectionKey];

      // 如果管理员禁用了整个区域，则该区域不显示
      if (!adminSection?.enabled) {
        result[sectionKey] = { enabled: false };
        return;
      }

      // 区域级别：用户可以选择隐藏管理员允许的区域
      // 当userSection存在时检查enabled状态，否则默认为true
      const sectionEnabled = userSection ? userSection.enabled !== false : true;
      result[sectionKey] = { enabled: sectionEnabled };

      // 功能级别：只有管理员和用户都允许的功能才显示
      Object.keys(adminSection).forEach((moduleKey) => {
        if (moduleKey === 'enabled') return;

        const adminAllowed = adminSection[moduleKey];
        // 权限管理员保存的是完整的 admin 配置；配置中缺失的模块必须视为未授权。
        // 其余区域是用户个人偏好，缺失的键默认可见（与 useUserPermissions 的
        // isSidebarModuleAllowed 一致），否则新增模块对已保存配置的老用户永远不可见。
        const strictUserConfig = sectionKey === 'admin';
        const userAllowed = userSection
          ? strictUserConfig
            ? userSection[moduleKey] === true
            : userSection[moduleKey] !== false
          : true;

        result[sectionKey][moduleKey] =
          adminAllowed && userAllowed && sectionEnabled;
      });
    });

    return result;
  }, [adminConfig, userConfig]);

  // 检查特定功能是否应该显示
  const isModuleVisible = (sectionKey, moduleKey = null) => {
    if (moduleKey) {
      return finalConfig[sectionKey]?.[moduleKey] === true;
    } else {
      return finalConfig[sectionKey]?.enabled === true;
    }
  };

  // 检查区域是否有任何可见的功能
  const hasSectionVisibleModules = (sectionKey) => {
    const section = finalConfig[sectionKey];
    if (!section?.enabled) return false;

    return Object.keys(section).some(
      (key) => key !== 'enabled' && section[key] === true,
    );
  };

  // 获取区域的可见功能列表
  const getVisibleModules = (sectionKey) => {
    const section = finalConfig[sectionKey];
    if (!section?.enabled) return [];

    return Object.keys(section).filter(
      (key) => key !== 'enabled' && section[key] === true,
    );
  };

  return {
    loading,
    adminConfig,
    userConfig,
    finalConfig,
    isModuleVisible,
    hasSectionVisibleModules,
    getVisibleModules,
    refreshUserConfig,
  };
};
