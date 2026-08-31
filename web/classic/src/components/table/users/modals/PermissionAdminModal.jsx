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
import { Modal, Switch, Row, Col, Card, Typography, Banner } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

// 与 Classic 侧边栏管理员区域一致的模块目录。新增侧边栏模块时同步在此登记，
// 保证权限管理弹窗与侧边栏/后端 ModuleAuth 使用同一组 key。
const ADMIN_MODULES = [
  { key: 'channel', titleKey: '渠道管理', descKey: 'API渠道配置' },
  { key: 'subscription', titleKey: '订阅管理', descKey: '订阅套餐管理' },
  { key: 'models', titleKey: '模型管理', descKey: 'AI模型配置' },
  { key: 'deployment', titleKey: '模型部署', descKey: '模型部署管理' },
  { key: 'redemption', titleKey: '兑换码管理', descKey: '兑换码生成管理' },
  { key: 'invitation-code', titleKey: '邀请码管理', descKey: '邀请码生成管理' },
  { key: 'user', titleKey: '用户管理', descKey: '用户账户管理' },
  { key: 'banner', titleKey: '横幅管理', descKey: '公共横幅公告管理' },
  { key: 'upstream-account', titleKey: '上游账号', descKey: '上游账号管理' },
  { key: 'ip-ban', titleKey: 'IP封禁', descKey: '管理禁止访问的 IP 和网段' },
  {
    key: 'browser-fingerprint-ban',
    titleKey: '浏览器指纹封禁',
    descKey: '管理禁止访问的浏览器指纹',
  },
];

// 系统设置与系统信息受 RootAuth 保护，不可下放给权限管理员，
// 因此不在可分配列表中出现，避免 Root 误配后被后端拒绝造成菜单可见但 API 403。

const DEFAULT_MODULES = () => {
  const admin = { enabled: true };
  ADMIN_MODULES.forEach((m) => {
    admin[m.key] = m.key === 'user';
  });
  return { admin };
};

const parseAdminConfig = (raw) => {
  const base = DEFAULT_MODULES();
  if (!raw) return base;
  let config = raw;
  if (typeof raw === 'string') {
    try {
      config = JSON.parse(raw);
    } catch (e) {
      return base;
    }
  }
  const adminRaw = config?.admin;
  if (adminRaw && typeof adminRaw === 'object') {
    const admin = { enabled: adminRaw.enabled !== false };
    ADMIN_MODULES.forEach((m) => {
      // 缺失模块默认关闭，避免新模块或未配置模块被意外放权
      admin[m.key] = adminRaw[m.key] === true;
    });
    return { admin };
  }
  return base;
};

const PermissionAdminModal = ({ visible, user, onCancel, onConfirm, loading }) => {
  const { t } = useTranslation();
  const [modules, setModules] = useState(DEFAULT_MODULES());

  useEffect(() => {
    if (visible && user) {
      setModules(parseAdminConfig(user.sidebar_modules));
    }
  }, [visible, user]);

  const admin = modules.admin || {};
  const safeAdminModules = Array.isArray(ADMIN_MODULES) ? ADMIN_MODULES : [];
  const enabledCount = useMemo(
    () => safeAdminModules.filter((m) => admin[m.key] === true).length,
    [admin, safeAdminModules],
  );

  const handleToggle = (key) => (checked) => {
    setModules((prev) => ({
      ...prev,
      admin: { ...prev.admin, [key]: checked },
    }));
  };

  const handleSectionToggle = (checked) => {
    setModules((prev) => ({
      ...prev,
      admin: { ...prev.admin, enabled: checked },
    }));
  };

  const handleSave = () => {
    onConfirm(modules);
  };

  return (
    <Modal
      title={
        <Title heading={5}>{t('配置权限管理员')}</Title>
      }
      visible={visible}
      onCancel={onCancel}
      onOk={handleSave}
      okText={t('保存权限')}
      cancelText={t('取消')}
      confirmLoading={!!loading}
      maskClosable={false}
      width={680}
    >
      <div style={{ marginBottom: 12 }}>
        <Text type='secondary'>
          {t('为权限管理员 {{username}} 选择允许访问的管理员功能，未勾选的功能将从其侧边栏隐藏并拒绝 API 访问。', {
            username: user?.username || '',
          })}
        </Text>
      </div>

      <Banner
        type='info'
        description={t('系统设置和系统信息仅 Root 可用，不可下放。当前已启用 {{count}} 个功能。', { count: enabledCount })}
        style={{ marginBottom: 12 }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          padding: '12px 16px',
          backgroundColor: 'var(--semi-color-fill-0)',
          borderRadius: 8,
          border: '1px solid var(--semi-color-border)',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
            {t('管理员区域')}
          </div>
          <Text type='secondary' size='small'>
            {t('关闭后该权限管理员将看不到整个管理员分组')}
          </Text>
        </div>
        <Switch
          checked={admin.enabled !== false}
          onChange={handleSectionToggle}
          size='default'
        />
      </div>

      <Row gutter={[16, 16]}>
        {safeAdminModules.map((m) => (
          <Col key={m.key} xs={24} sm={12} md={12} lg={8} xl={8}>
            <Card
              bodyStyle={{ padding: 16 }}
              hoverable
              style={{
                opacity: admin.enabled !== false ? 1 : 0.5,
                transition: 'opacity 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                    {t(m.titleKey)}
                  </div>
                  <Text type='secondary' size='small' style={{ display: 'block' }}>
                    {t(m.descKey)}
                  </Text>
                </div>
                <div style={{ marginLeft: 16 }}>
                  <Switch
                    checked={admin[m.key] === true}
                    onChange={handleToggle(m.key)}
                    size='default'
                    disabled={admin.enabled === false}
                  />
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </Modal>
  );
};

export default PermissionAdminModal;
