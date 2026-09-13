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
import {
  Button,
  Card,
  Modal,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { Laptop, LogOut } from 'lucide-react';
import { showError, showSuccess } from '../../../../helpers';
import { useLoginSessions } from '../../../../hooks/security/useLoginSessions';

const formatUnix = (value) => {
  if (!value) {
    return '-';
  }
  return new Date(value * 1000).toLocaleString();
};

const resolveDeviceLabel = (userAgent, t) => {
  if (!userAgent) {
    return t('未知设备');
  }
  let browser = t('浏览器');
  if (userAgent.includes('Edg/')) browser = 'Edge';
  else if (userAgent.includes('Chrome/')) browser = 'Chrome';
  else if (userAgent.includes('Firefox/')) browser = 'Firefox';
  else if (userAgent.includes('Safari/')) browser = 'Safari';

  const maxTouchPoints =
    typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0;
  const isIPad =
    userAgent.includes('iPad') ||
    (userAgent.includes('Macintosh') && maxTouchPoints > 1);

  let system = '';
  if (userAgent.includes('iPhone') || isIPad) system = 'iOS';
  else if (userAgent.includes('Android')) system = 'Android';
  else if (userAgent.includes('Windows')) system = 'Windows';
  else if (userAgent.includes('Mac OS')) system = 'macOS';
  else if (userAgent.includes('Linux')) system = 'Linux';

  return system ? `${browser} · ${system}` : browser;
};

const resolveLoginMethodLabel = (method, t) => {
  const normalized = (method || '').trim().toLowerCase();
  switch (normalized) {
    case 'password':
      return t('密码');
    case '2fa':
      return t('两步验证');
    case 'passkey':
      return t('Passkey');
    case 'wechat':
      return t('微信');
    case 'telegram':
      return t('Telegram');
    case 'oauth':
      return t('OAuth');
    case 'unknown':
    case '':
      return t('未知');
    default:
      break;
  }
  if (!normalized.startsWith('oauth:')) {
    return method;
  }
  const provider = normalized.slice('oauth:'.length);
  const providerNames = {
    discord: 'Discord',
    github: 'GitHub',
    linuxdo: 'LinuxDO',
    oidc: 'OIDC',
  };
  return `${t('OAuth')} · ${providerNames[provider] || provider}`;
};

const LoginSessionsCard = ({ t }) => {
  const {
    sessions,
    loading,
    error,
    refresh,
    revokeSession,
    revokeOthers,
    revokingSid,
    revokingOthers,
  } = useLoginSessions();

  const hasOtherSessions = sessions.some((session) => !session.current);

  const handleRevoke = (session) => {
    Modal.confirm({
      title: session.current ? t('退出该设备？') : t('注销会话？'),
      content: t('该会话将立即失去访问权限，需要重新登录。'),
      okText: session.current ? t('退出登录') : t('注销'),
      cancelText: t('取消'),
      okType: 'danger',
      onOk: async () => {
        const result = await revokeSession(session.sid);
        if (result.success) {
          if (result.current) {
            showSuccess(t('当前会话已注销，请重新登录'));
          } else {
            showSuccess(t('会话已注销'));
          }
        } else {
          showError(result.message || t('注销会话失败'));
        }
      },
    });
  };

  const handleRevokeOthers = () => {
    Modal.confirm({
      title: t('退出其它会话？'),
      content: t('其它所有设备将立即失去访问权限，本设备将保持登录。'),
      okText: t('退出其它设备'),
      cancelText: t('取消'),
      okType: 'danger',
      onOk: async () => {
        const result = await revokeOthers();
        if (result.success) {
          showSuccess(t('其它会话已注销'));
        } else {
          showError(result.message || t('注销其它会话失败'));
        }
      },
    });
  };

  const renderSessions = () => {
    if (loading) {
      return (
        <div className='flex justify-center py-6'>
          <Spin size='middle' />
        </div>
      );
    }
    if (error) {
      return (
        <div className='flex flex-col items-center gap-3 py-6'>
          <Typography.Text type='danger'>
            {t('加载登录会话失败')}
          </Typography.Text>
          <Button size='small' theme='outline' onClick={refresh}>
            {t('重试')}
          </Button>
        </div>
      );
    }
    if (sessions.length === 0) {
      return (
        <div className='py-6 text-center text-sm text-gray-500'>
          {t('无活跃登录会话')}
        </div>
      );
    }
    return (
      <div className='divide-y divide-gray-100 dark:divide-gray-700'>
        {sessions.map((session) => (
          <div
            key={session.sid}
            className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4'
          >
            <div className='flex items-start flex-1 min-w-0'>
              <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                <Laptop size={18} className='text-slate-600 dark:text-slate-300' />
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center flex-wrap gap-2'>
                  <span className='font-medium text-gray-900 dark:text-gray-100'>
                    {resolveDeviceLabel(session.user_agent, t)}
                  </span>
                  {session.current && (
                    <Tag color='green' shape='circle' size='small'>
                      {t('当前会话')}
                    </Tag>
                  )}
                </div>
                <div className='mt-1 text-xs text-gray-500'>
                  {t('IP：{{ip}} · 登录方式：{{method}}', {
                    ip: session.ip || t('未知'),
                    method: resolveLoginMethodLabel(session.login_method, t),
                  })}
                </div>
                <div className='mt-1 text-xs text-gray-500'>
                  {t('创建时间：{{created}}', {
                    created: formatUnix(session.created_at),
                  })}
                  {' · '}
                  {t('最近活跃：{{active}}', {
                    active: formatUnix(session.last_active_at),
                  })}
                </div>
              </div>
            </div>
            <div className='flex-shrink-0'>
              <Button
                type={session.current ? 'primary' : 'danger'}
                theme='outline'
                size='small'
                loading={revokingSid === session.sid}
                onClick={() => handleRevoke(session)}
              >
                {session.current ? t('退出登录') : t('注销')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className='!rounded-xl w-full'>
      <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
        <div className='flex items-start w-full sm:w-auto'>
          <div className='w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-4 flex-shrink-0'>
            <Laptop size={20} className='text-slate-600 dark:text-slate-300' />
          </div>
          <div className='flex-1'>
            <Typography.Title heading={6} className='mb-1'>
              {t('登录会话')}
            </Typography.Title>
            <Typography.Text type='tertiary' className='text-sm'>
              {t('查看并注销当前正在使用你账户的设备。')}
            </Typography.Text>
          </div>
        </div>
        <Button
          type='danger'
          theme='solid'
          size='default'
          icon={<LogOut size={16} />}
          className='w-full sm:w-auto !rounded-lg !bg-slate-500 hover:!bg-slate-600'
          disabled={!hasOtherSessions || revokingOthers}
          loading={revokingOthers}
          onClick={handleRevokeOthers}
        >
          {t('退出其它会话')}
        </Button>
      </div>

      <div className='mt-4'>{renderSessions()}</div>
    </Card>
  );
};

export default LoginSessionsCard;
