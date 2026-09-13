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

import React from 'react';
import { Button, Tag, Tooltip, Typography } from '@douyinfe/semi-ui';

const AUDIT_CATEGORY_LABELS = {
  login: '登录',
  security: '账户安全',
  operation: '操作审计',
  access_token: '访问令牌',
};

const AUDIT_ROLE_LABELS = {
  0: '访客',
  1: '用户',
  10: '管理员',
  100: '超级管理员',
};

const AUDIT_ACTION_LABELS = {
  'user.create': '创建用户',
  'user.update': '更新用户',
  'user.delete': '删除用户',
  'user.account_delete': '删除账号',
  'user.manage': '用户管理操作',
  'user.quota_add': '增加用户额度',
  'user.quota_subtract': '减少用户额度',
  'user.quota_override': '覆盖用户额度',
  'user.binding_clear': '清除账号绑定',
  'user.binding_start': '发起账号绑定',
  'user.binding_bind': '绑定账号',
  'user.binding_unbind': '解绑账号',
  'user.email_binding_resend': '重发邮箱验证码',
  'user.2fa_setup': '发起双因素认证设置',
  'user.2fa_enable': '启用双因素认证',
  'user.2fa_disable': '强制关闭双因素认证',
  'user.2fa_disable_self': '关闭双因素认证',
  'user.2fa_backup_codes': '重新生成双因素备份码',
  'user.security_verify': '完成安全验证',
  'user.passkey_register': '注册通行密钥',
  'user.passkey_delete': '删除通行密钥',
  'user.reset_passkey': '重置通行密钥',
  'user.password_change': '修改账号密码',
  'access_token.generate': '生成访问令牌',
  'access_token.revoke': '吊销访问令牌',
  'option.update': '更新系统设置',
  'banner.create': '创建公告',
  'banner.update': '更新公告',
  'banner.delete': '删除公告',
  'channel.create': '创建渠道',
  'channel.update': '更新渠道',
  'channel.delete': '删除渠道',
  'channel.delete_batch': '批量删除渠道',
  'channel.delete_disabled': '删除全部禁用渠道',
  'channel.key_view': '查看渠道密钥',
  'channel.tag_disable': '批量禁用渠道',
  'channel.tag_enable': '批量启用渠道',
  'channel.tag_edit': '批量编辑渠道',
  'channel.tag_batch_set': '批量设置渠道标签',
  'channel.copy': '复制渠道',
  'channel.multi_key_manage': '多渠道密钥管理',
  'channel.upstream_apply': '应用上游模型变更',
  'channel.upstream_apply_all': '批量应用上游模型变更',
  'redemption.create': '创建兑换码',
  'redemption.export': '导出兑换码',
  'redemption.delete_batch': '批量删除兑换码',
  'subscription.plan_reset': '重置订阅套餐',
  'subscription.user_plan_reset': '重置用户订阅套餐',
  'token.create': '创建 API 令牌',
  'token.update': '更新 API 令牌',
  'token.status_update': '更新 API 令牌状态',
  'token.delete': '删除 API 令牌',
  'token.delete_batch': '批量删除 API 令牌',
  'token.key_view': '查看 API 令牌密钥',
  'token.key_view_batch': '批量查看 API 令牌密钥',
  generic: '通用操作',
};

const AUDIT_AUTH_METHOD_LABELS = {
  session: '会话',
  access_token: '访问令牌',
  password: '密码',
  '2fa': '双因素认证',
  passkey: '通行密钥',
  wechat: '微信',
  telegram: 'Telegram',
  oauth: 'OAuth',
  unknown: '未知',
};

export const AUDIT_CATEGORY_OPTIONS = [
  { value: 'login', label: '登录' },
  { value: 'security', label: '账户安全' },
  { value: 'operation', label: '操作审计' },
  { value: 'access_token', label: '访问令牌' },
];

export function getAuditCategoryLabel(category, t) {
  if (!category) {
    return '-';
  }
  const label = AUDIT_CATEGORY_LABELS[category];
  return label ? t(label) : category;
}

export function getAuditActionLabel(action, t) {
  if (!action) {
    return '-';
  }
  const label = AUDIT_ACTION_LABELS[action];
  return label ? t(label) : action;
}

export function getAuditRoleLabel(role, t) {
  if (role === undefined || role === null || role === '') {
    return '-';
  }
  const label = AUDIT_ROLE_LABELS[role];
  return label ? t(label) : String(role);
}

export function getAuditAuthMethodLabel(method, t) {
  if (!method) {
    return '-';
  }
  const label = AUDIT_AUTH_METHOD_LABELS[method];
  return label ? t(label) : method;
}

function renderCopyableText(text, copyText, t) {
  if (!text) {
    return <span>-</span>;
  }
  return (
    <Tooltip content={t('点击复制')}>
      <Typography.Text
        size='small'
        className='cursor-pointer'
        ellipsis={{ showTooltip: false }}
        style={{ maxWidth: 180, fontFamily: 'monospace' }}
        onClick={(event) => copyText(event, text)}
      >
        {text}
      </Typography.Text>
    </Tooltip>
  );
}

export const getAuditLogsColumns = ({ t, copyText, openDetail, isAdminUser }) => {
  const columns = [
    {
      key: 'time',
      title: t('时间'),
      dataIndex: 'timestamp2string',
      width: 180,
    },
    {
      key: 'event_id',
      title: t('事件 ID'),
      dataIndex: 'event_id',
      width: 190,
      render: (text) => renderCopyableText(text, copyText, t),
    },
    {
      key: 'category',
      title: t('分类'),
      dataIndex: 'category',
      width: 120,
      render: (text) => (
        <Tag color='blue' shape='circle'>
          {getAuditCategoryLabel(text, t)}
        </Tag>
      ),
    },
    {
      key: 'action',
      title: t('操作'),
      dataIndex: 'action',
      width: 160,
      render: (text) => getAuditActionLabel(text, t),
    },
  ];

  if (isAdminUser) {
    columns.push({
      key: 'username',
      title: t('操作者'),
      dataIndex: 'username',
      width: 160,
      render: (text, record) => {
        const name = text || '-';
        if (record.user_id) {
          return `${name} (ID: ${record.user_id})`;
        }
        return name;
      },
    });
  }

  columns.push(
    {
      key: 'actor_role',
      title: t('角色'),
      dataIndex: 'actor_role',
      width: 110,
      render: (text) => getAuditRoleLabel(text, t),
    },
    {
      key: 'success',
      title: t('结果'),
      dataIndex: 'success',
      width: 90,
      render: (text) => (
        <Tag color={text ? 'green' : 'red'} shape='circle'>
          {text ? t('成功') : t('失败')}
        </Tag>
      ),
    },
    {
      key: 'ip',
      title: 'IP',
      dataIndex: 'ip',
      width: 140,
      render: (text) => <span style={{ fontFamily: 'monospace' }}>{text || '-'}</span>,
    },
    {
      key: 'route',
      title: t('方法/路由'),
      dataIndex: 'route',
      width: 240,
      render: (text, record) => (
        <span style={{ fontFamily: 'monospace' }}>
          {record.method ? `${record.method} ` : ''}
          {text || '-'}
        </span>
      ),
    },
    {
      key: 'request_id',
      title: 'Request ID',
      dataIndex: 'request_id',
      width: 190,
      render: (text) => renderCopyableText(text, copyText, t),
    },
    {
      key: 'content',
      title: t('内容'),
      dataIndex: 'content',
      width: 260,
      render: (text) => (
        <Typography.Paragraph
          ellipsis={{
            rows: 2,
            showTooltip: {
              type: 'popover',
              opts: { style: { width: 320 } },
            },
          }}
          style={{ maxWidth: 260, marginBottom: 0 }}
        >
          {text}
        </Typography.Paragraph>
      ),
    },
    {
      key: 'details',
      title: t('详情'),
      fixed: 'right',
      width: 90,
      render: (text, record) => (
        <Button
          size='small'
          theme='borderless'
          type='primary'
          onClick={(event) => {
            event.stopPropagation();
            openDetail(record);
          }}
        >
          {t('详情')}
        </Button>
      ),
    },
  );

  return columns;
};
