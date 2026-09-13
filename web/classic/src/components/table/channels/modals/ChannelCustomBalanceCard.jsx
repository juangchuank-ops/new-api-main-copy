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
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Button,
  Col,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';

const { Text } = Typography;

// 与 service.ChannelCustomBalance* 常量保持一致。
const CUSTOM_BALANCE_PROVIDERS = [
  { value: 'new_api', label: 'New API 兼容' },
  { value: 'one_api', label: 'One API' },
  { value: 'veloera', label: 'Veloera' },
  { value: 'anyrouter', label: 'AnyRouter' },
];
const CUSTOM_BALANCE_PROVIDER_VALUES = CUSTOM_BALANCE_PROVIDERS.map(
  (option) => option.value,
);
const CUSTOM_BALANCE_AUTH_TYPES = [
  { value: 'token', label: '令牌' },
  { value: 'cookie', label: 'Cookie' },
];
const MAX_INTERVAL_SECONDS = 31536000;
const MAX_RETRY_MAX = 20;
const MAX_QUOTA_PER_UNIT = 1e12;
const MAX_USER_ID_LENGTH = 128;

const CUSTOM_BALANCE_FORM_DEFAULTS = {
  enabled: false,
  provider: 'new_api',
  use_channel_key: false,
  auth_type: 'token',
  user_id: '',
  quota_per_unit: 500000,
  auto_balance: false,
  auto_checkin: false,
  ignore_balance_auto_ban: false,
  balance_interval_seconds: 3600,
  checkin_interval_seconds: 86400,
  retry_max: 3,
  retry_interval_seconds: 300,
};

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// 服务端视图只在 credential_set 中暴露凭据是否存在，凭据本身永不回显。
const customBalanceFormValues = (view) => ({
  ...CUSTOM_BALANCE_FORM_DEFAULTS,
  enabled: view?.enabled === true,
  provider: CUSTOM_BALANCE_PROVIDER_VALUES.includes(view?.provider)
    ? view.provider
    : CUSTOM_BALANCE_FORM_DEFAULTS.provider,
  use_channel_key: view?.use_channel_key === true,
  auth_type: view?.auth_type === 'cookie' ? 'cookie' : 'token',
  user_id: view?.user_id == null ? '' : String(view.user_id),
  quota_per_unit: toPositiveNumber(
    view?.quota_per_unit,
    CUSTOM_BALANCE_FORM_DEFAULTS.quota_per_unit,
  ),
  auto_balance: view?.auto_balance === true,
  auto_checkin: view?.auto_checkin === true,
  ignore_balance_auto_ban: view?.ignore_balance_auto_ban === true,
  balance_interval_seconds: toPositiveInteger(
    view?.balance_interval_seconds,
    CUSTOM_BALANCE_FORM_DEFAULTS.balance_interval_seconds,
  ),
  checkin_interval_seconds: toPositiveInteger(
    view?.checkin_interval_seconds,
    CUSTOM_BALANCE_FORM_DEFAULTS.checkin_interval_seconds,
  ),
  retry_max: toPositiveInteger(
    view?.retry_max_attempts ?? view?.retry_max,
    CUSTOM_BALANCE_FORM_DEFAULTS.retry_max,
  ),
  retry_interval_seconds: toPositiveInteger(
    view?.retry_interval_seconds,
    CUSTOM_BALANCE_FORM_DEFAULTS.retry_interval_seconds,
  ),
});

// 校验范围与 service.ValidateChannelCustomBalanceConfig 保持一致。
const getCustomBalanceError = (t, values, options) => {
  if (!CUSTOM_BALANCE_PROVIDER_VALUES.includes(values.provider)) {
    return t('请选择余额查询提供方');
  }
  if (values.auth_type !== 'token' && values.auth_type !== 'cookie') {
    return t('鉴权方式必须是令牌或 Cookie');
  }
  const quotaPerUnit = Number(values.quota_per_unit);
  if (!Number.isFinite(quotaPerUnit) || quotaPerUnit <= 0) {
    return t('单位配额必须大于 0');
  }
  if (quotaPerUnit > MAX_QUOTA_PER_UNIT) {
    return t('单位配额不能超过 {{max}}', { max: MAX_QUOTA_PER_UNIT });
  }
  const userId = String(values.user_id || '');
  if (/[\r\n]/.test(userId)) {
    return t('用户 ID 不能包含换行符');
  }
  if ([...userId].length > MAX_USER_ID_LENGTH) {
    return t('用户 ID 长度不能超过 {{max}}', { max: MAX_USER_ID_LENGTH });
  }
  const intervals = [
    [values.balance_interval_seconds, t('余额刷新间隔')],
    [values.checkin_interval_seconds, t('签到间隔')],
    [values.retry_interval_seconds, t('重试间隔')],
  ];
  for (const [value, label] of intervals) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return t('{{label}}必须是大于 0 的整数（秒）', { label });
    }
    if (parsed > MAX_INTERVAL_SECONDS) {
      return t('{{label}}不能超过 {{max}} 秒', {
        label,
        max: MAX_INTERVAL_SECONDS,
      });
    }
  }
  const retryMax = Number(values.retry_max);
  if (!Number.isInteger(retryMax) || retryMax <= 0) {
    return t('最大重试次数必须是大于 0 的整数');
  }
  if (retryMax > MAX_RETRY_MAX) {
    return t('最大重试次数不能超过 {{max}}', { max: MAX_RETRY_MAX });
  }
  if (
    !options.useChannelKey &&
    !options.credentialSet &&
    !String(values.credential || '').trim() &&
    (values.enabled || values.auto_balance || values.auto_checkin)
  ) {
    return t('启用自动余额刷新或自动签到且不复用渠道密钥时，必须填写凭据');
  }
  return null;
};

const formatTime = (seconds) => {
  const value = Number(seconds);
  if (!value) {
    return '-';
  }
  return new Date(value * 1000).toLocaleString();
};

const ChannelCustomBalanceCard = ({ channelId, isEdit, isMultiKey }) => {
  const { t } = useTranslation();
  const [view, setView] = useState(null);
  const [form, setForm] = useState({ ...CUSTOM_BALANCE_FORM_DEFAULTS });
  const [credential, setCredential] = useState('');
  const [clearCredential, setClearCredential] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loadError, setLoadError] = useState('');

  const applyView = (nextView) => {
    setView(nextView || null);
    setForm(customBalanceFormValues(nextView));
    setCredential('');
    setClearCredential(false);
  };

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!isEdit || !channelId) {
      setView(null);
      setLoadError('');
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    API.get(`/api/channel/${channelId}/custom-balance`, {
      skipErrorHandler: true,
    })
      .then((res) => {
        if (cancelled) {
          return;
        }
        if (res?.data?.success) {
          applyView(res.data.data);
        } else {
          setLoadError(res?.data?.message || t('加载自定义余额配置失败'));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error?.response?.data?.message ||
              error.message ||
              t('加载自定义余额配置失败'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [channelId, isEdit, t]);

  const credentialSet = view?.credential_set === true;
  // 多密钥渠道不支持复用渠道密钥，后端会直接拒绝，这里统一归一化为关闭
  const useChannelKey = isMultiKey ? false : form.use_channel_key === true;
  const formError = getCustomBalanceError(t, form, {
    useChannelKey,
    credentialSet,
  });
  const busy = saving || refreshing || checking;

  const handleSave = async () => {
    if (formError) {
      showError(formError);
      return;
    }
    const payload = {
      enabled: form.enabled === true,
      provider: form.provider,
      use_channel_key: useChannelKey,
      auth_type: form.auth_type,
      user_id: String(form.user_id || '').trim(),
      quota_per_unit: Number(form.quota_per_unit),
      auto_balance: form.auto_balance === true,
      auto_checkin: form.auto_checkin === true,
      ignore_balance_auto_ban: form.ignore_balance_auto_ban === true,
      balance_interval_seconds: Number(form.balance_interval_seconds),
      checkin_interval_seconds: Number(form.checkin_interval_seconds),
      retry_max: Number(form.retry_max),
      retry_interval_seconds: Number(form.retry_interval_seconds),
    };
    const credentialText = credential.trim();
    if (clearCredential) {
      payload.clear_credential = true;
    } else if (credentialText && !payload.use_channel_key) {
      payload.credential = credentialText;
    }

    setSaving(true);
    try {
      const res = await API.put(
        `/api/channel/${channelId}/custom-balance`,
        payload,
        { skipErrorHandler: true },
      );
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || t('保存自定义余额配置失败'));
      }
      applyView(res.data.data);
      showSuccess(t('自定义余额配置已保存'));
    } catch (error) {
      showError(
        error?.response?.data?.message ||
          error.message ||
          t('保存自定义余额配置失败'),
      );
    } finally {
      setSaving(false);
    }
  };

  const runOperation = async (kind) => {
    const isBalance = kind === 'balance';
    if (isBalance) {
      setRefreshing(true);
    } else {
      setChecking(true);
    }
    try {
      const res = await API.post(
        `/api/channel/${channelId}/custom-balance/${isBalance ? 'refresh' : 'checkin'}`,
        {},
        { skipErrorHandler: true },
      );
      if (res?.data?.data) {
        applyView(res.data.data);
      }
      if (res?.data?.success) {
        showSuccess(isBalance ? t('余额已刷新') : t('签到已完成'));
      } else {
        showError(
          res?.data?.message || (isBalance ? t('刷新余额失败') : t('签到失败')),
        );
      }
    } catch (error) {
      showError(
        error?.response?.data?.message ||
          error.message ||
          (isBalance ? t('刷新余额失败') : t('签到失败')),
      );
    } finally {
      if (isBalance) {
        setRefreshing(false);
      } else {
        setChecking(false);
      }
    }
  };

  return (
    <div className='pt-3 border-t border-gray-100'>
      <div className='flex items-center justify-between mb-1'>
        <Text className='text-sm font-medium text-gray-500'>
          {t('自定义余额 / 自动签到')}
        </Text>
        {view?.enabled ? (
          <Tag color='green' shape='circle'>
            {t('已启用')}
          </Tag>
        ) : null}
      </div>
      <div className='text-xs text-gray-500 mb-3'>
        {t(
          '为该渠道单独配置上游余额查询与自动签到（仅编辑已有渠道时可用）。',
        )}
      </div>

      {!isEdit || !channelId ? (
        <Banner
          type='info'
          closeIcon={null}
          className='!rounded-xl'
          description={t('保存渠道后即可配置自定义余额与自动签到')}
        />
      ) : (
        <Spin spinning={loading}>
          {loadError ? (
            <Banner
              type='warning'
              closeIcon={null}
              className='!rounded-xl'
              description={loadError}
            />
          ) : null}

          {view ? (
            <div
              className='mb-3 rounded-xl p-3 text-xs'
              style={{
                backgroundColor: 'var(--semi-color-fill-0)',
                border: '1px solid var(--semi-color-fill-2)',
              }}
            >
              <div className='flex items-center justify-between mb-2'>
                <Text className='text-xs font-medium'>{t('余额与状态')}</Text>
                <Button
                  size='small'
                  type='tertiary'
                  icon={<IconRefresh size={12} />}
                  loading={refreshing}
                  disabled={busy}
                  onClick={() => runOperation('balance')}
                >
                  {t('刷新余额')}
                </Button>
              </div>
              <div className='space-y-1 text-gray-600'>
                <div>
                  {t('当前余额')}: {Number(view.balance) || 0}
                </div>
                <div>
                  {t('余额更新时间')}: {formatTime(view.balance_updated_time)}
                </div>
                <div>
                  {t('凭据状态')}:{' '}
                  {view.credential_set ? t('已配置') : t('未配置')}
                </div>
                <div>
                  {t('下次余额刷新')}: {formatTime(view.next_balance_at)}
                </div>
                <div>
                  {t('下次签到')}: {formatTime(view.next_checkin_at)}
                </div>
                <div className='break-all'>
                  {t('上次余额结果')}:{' '}
                  {view.last_balance_message ||
                    view.last_balance_error ||
                    view.last_balance_status ||
                    '-'}{' '}
                  ({formatTime(view.last_balance_at)})
                </div>
                <div className='break-all'>
                  {t('上次签到结果')}:{' '}
                  {view.last_checkin_message ||
                    view.last_checkin_error ||
                    view.last_checkin_status ||
                    '-'}{' '}
                  ({formatTime(view.last_checkin_at)})
                </div>
              </div>
            </div>
          ) : null}

          <Row gutter={12}>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>{t('余额提供方')}</div>
              <Select
                value={form.provider}
                style={{ width: '100%' }}
                onChange={(value) => updateForm('provider', value)}
              >
                {CUSTOM_BALANCE_PROVIDERS.map((option) => (
                  <Select.Option key={option.value} value={option.value}>
                    {t(option.label)}
                  </Select.Option>
                ))}
              </Select>
            </Col>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>{t('鉴权方式')}</div>
              <Select
                value={form.auth_type}
                style={{ width: '100%' }}
                onChange={(value) => updateForm('auth_type', value)}
              >
                {CUSTOM_BALANCE_AUTH_TYPES.map((option) => (
                  <Select.Option key={option.value} value={option.value}>
                    {t(option.label)}
                  </Select.Option>
                ))}
              </Select>
            </Col>
          </Row>

          <div className='mt-3 flex items-center justify-between gap-2'>
            <Text className='text-xs text-gray-600'>{t('复用渠道密钥')}</Text>
            <Switch
              checked={useChannelKey}
              disabled={isMultiKey}
              checkedText={t('开')}
              uncheckedText={t('关')}
              onChange={(value) => updateForm('use_channel_key', value === true)}
            />
          </div>
          <div className='mt-1 text-xs text-gray-500'>
            {isMultiKey
              ? t('多密钥渠道不支持复用渠道密钥，请填写独立凭据')
              : t('开启后使用渠道密钥作为凭据，无需单独填写')}
          </div>

          <div className='mt-3'>
            <div className='mb-1 text-xs text-gray-600'>
              {form.auth_type === 'cookie' ? t('Cookie 凭据') : t('访问令牌')}
            </div>
            <Input
              mode='password'
              value={credential}
              disabled={useChannelKey || clearCredential}
              placeholder={
                credentialSet
                  ? t('留空表示保持现有凭据')
                  : t('请输入用于余额查询的凭据')
              }
              onChange={setCredential}
            />
            <div className='mt-1 flex items-center justify-between gap-2'>
              <span className='text-xs text-gray-500'>
                {t('凭据仅写入不读取，保存后无法再次查看')}
              </span>
              <Space>
                <Text className='text-xs text-gray-600'>
                  {t('清除已保存的凭据')}
                </Text>
                <Switch
                  checked={clearCredential}
                  size='small'
                  disabled={!credentialSet}
                  onChange={(value) => setClearCredential(value === true)}
                />
              </Space>
            </div>
          </div>

          <Row gutter={12} className='mt-3'>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>{t('用户 ID')}</div>
              <Input
                value={form.user_id}
                placeholder={t('可选，部分站点需要')}
                onChange={(value) => updateForm('user_id', value)}
              />
            </Col>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>
                {t('单位配额换算比例')}
              </div>
              <InputNumber
                value={form.quota_per_unit}
                min={1}
                step={1}
                style={{ width: '100%' }}
                onChange={(value) =>
                  updateForm('quota_per_unit', toPositiveNumber(value, 0))
                }
              />
            </Col>
          </Row>

          <div
            className='mt-3 rounded-xl p-3'
            style={{
              backgroundColor: 'var(--semi-color-fill-0)',
              border: '1px solid var(--semi-color-fill-2)',
            }}
          >
            <div className='flex items-center justify-between mb-2'>
              <Text className='text-xs font-medium'>{t('自动化')}</Text>
            </div>
            <div className='flex items-center justify-between gap-2'>
              <Text className='text-xs text-gray-600'>{t('启用自定义余额')}</Text>
              <Switch
                checked={form.enabled}
                checkedText={t('开')}
                uncheckedText={t('关')}
                onChange={(value) => updateForm('enabled', value === true)}
              />
            </div>
            <div className='mt-2 flex items-center justify-between gap-2'>
              <Text className='text-xs text-gray-600'>{t('自动刷新余额')}</Text>
              <Switch
                checked={form.auto_balance}
                checkedText={t('开')}
                uncheckedText={t('关')}
                onChange={(value) => updateForm('auto_balance', value === true)}
              />
            </div>
            <div className='mt-2 flex items-center justify-between gap-2'>
              <Text className='text-xs text-gray-600'>{t('自动签到')}</Text>
              <Switch
                checked={form.auto_checkin}
                checkedText={t('开')}
                uncheckedText={t('关')}
                onChange={(value) => updateForm('auto_checkin', value === true)}
              />
            </div>
            <div className='mt-2 flex items-center justify-between gap-2'>
              <div className='flex-1'>
                <Text className='text-xs text-gray-600'>
                  {t('余额限制不自动禁用渠道')}
                </Text>
                <div className='text-xs text-gray-500'>
                  {t('上游返回余额或额度不足时保持渠道启用，等待额度恢复')}
                </div>
              </div>
              <Switch
                checked={form.ignore_balance_auto_ban}
                checkedText={t('开')}
                uncheckedText={t('关')}
                onChange={(value) =>
                  updateForm('ignore_balance_auto_ban', value === true)
                }
              />
            </div>
          </div>

          <Row gutter={12} className='mt-3'>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>
                {t('余额刷新间隔（秒）')}
              </div>
              <InputNumber
                value={form.balance_interval_seconds}
                min={1}
                max={MAX_INTERVAL_SECONDS}
                step={1}
                precision={0}
                style={{ width: '100%' }}
                onChange={(value) =>
                  updateForm(
                    'balance_interval_seconds',
                    toPositiveInteger(value, 0),
                  )
                }
              />
            </Col>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>
                {t('签到间隔（秒）')}
              </div>
              <InputNumber
                value={form.checkin_interval_seconds}
                min={1}
                max={MAX_INTERVAL_SECONDS}
                step={1}
                precision={0}
                style={{ width: '100%' }}
                onChange={(value) =>
                  updateForm(
                    'checkin_interval_seconds',
                    toPositiveInteger(value, 0),
                  )
                }
              />
            </Col>
          </Row>

          <Row gutter={12} className='mt-3'>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>
                {t('最大重试次数')}
              </div>
              <InputNumber
                value={form.retry_max}
                min={1}
                max={MAX_RETRY_MAX}
                step={1}
                precision={0}
                style={{ width: '100%' }}
                onChange={(value) =>
                  updateForm('retry_max', toPositiveInteger(value, 0))
                }
              />
            </Col>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>
                {t('重试间隔（秒）')}
              </div>
              <InputNumber
                value={form.retry_interval_seconds}
                min={1}
                max={MAX_INTERVAL_SECONDS}
                step={1}
                precision={0}
                style={{ width: '100%' }}
                onChange={(value) =>
                  updateForm('retry_interval_seconds', toPositiveInteger(value, 0))
                }
              />
            </Col>
          </Row>

          {formError ? (
            <Banner
              type='warning'
              closeIcon={null}
              className='!rounded-xl mt-3'
              description={formError}
            />
          ) : null}

          <div className='mt-3 flex flex-wrap items-center gap-2'>
            <Button
              theme='solid'
              size='small'
              loading={saving}
              disabled={busy}
              onClick={handleSave}
            >
              {t('保存自定义余额配置')}
            </Button>
            <Button
              type='primary'
              theme='light'
              size='small'
              loading={refreshing}
              disabled={busy}
              onClick={() => runOperation('balance')}
            >
              {t('刷新余额')}
            </Button>
            <Button
              type='primary'
              theme='light'
              size='small'
              loading={checking}
              disabled={busy}
              onClick={() => runOperation('checkin')}
            >
              {t('立即签到')}
            </Button>
          </div>
        </Spin>
      )}
    </div>
  );
};

export default ChannelCustomBalanceCard;
