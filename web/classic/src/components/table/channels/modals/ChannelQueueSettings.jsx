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
  Switch,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { API } from '../../../../helpers';

const { Text } = Typography;

// 与后端 model.MaxQueueDurationSeconds 保持一致。
export const MAX_QUEUE_DURATION_SECONDS = 86400;
// 与后端 model.validateChannelQueueSettings 的 max_tokens 上限保持一致。
export const MAX_QUEUE_WARMUP_TOKENS = 128000;

// relaykit/types.EndpointType 的合法取值，空值代表自动检测。
const QUEUE_ENDPOINT_TYPES = [
  { value: '', label: '自动检测' },
  { value: 'openai', label: 'OpenAI Chat Completions' },
  { value: 'openai-response', label: 'OpenAI Responses' },
  { value: 'openai-response-compact', label: 'OpenAI Responses Compact' },
  { value: 'openai-alpha-search', label: 'OpenAI Alpha Search' },
  { value: 'anthropic', label: 'Anthropic Messages' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'jina-rerank', label: 'Jina Rerank' },
  { value: 'image-generation', label: '图像生成' },
  { value: 'embeddings', label: 'Embeddings' },
  { value: 'openai-video', label: 'OpenAI 视频' },
];

const QUEUE_ENDPOINT_TYPE_VALUES = new Set(
  QUEUE_ENDPOINT_TYPES.map((option) => option.value).filter(Boolean),
);

// 与后端 ChannelQueueSettings 字段一一对应的表单默认值。
export const QUEUE_FORM_DEFAULTS = {
  queue_enabled: false,
  queue_model: '',
  queue_interval: 30,
  queue_endpoint_type: '',
  queue_warmup_message: '',
  queue_max_tokens: 16,
  queue_timeout: 25,
  queue_circuit_breaker_enabled: true,
  queue_max_consecutive_failures: 10,
  queue_cooldown_seconds: 300,
  queue_max_queue_attempts: 0,
  queue_backoff_seconds: 30,
  queue_busy_status_codes: '429,503',
};

const toIntegerOrNull = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const toSeconds = (value, fallback) => {
  const parsed = toIntegerOrNull(value);
  return parsed === null ? fallback : parsed;
};

// queue_busy_status_codes 在后端是 []int，表单里用逗号分隔字符串承载。
export function parseQueueBusyStatusCodes(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value ?? '');
  const codes = [];
  const invalid = [];
  raw.split(',').forEach((part) => {
    const text = part.trim();
    if (!text) {
      return;
    }
    const code = Number(text);
    if (!Number.isInteger(code) || code < 100 || code > 599) {
      invalid.push(text);
      return;
    }
    if (!codes.includes(code)) {
      codes.push(code);
    }
  });
  return { codes, invalid };
}

// 空值与 auto 都表示让后端自动检测端点。
export function normalizeQueueEndpointType(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim().toLowerCase();
  return normalized === 'auto' ? '' : normalized;
}

// 从已保存的 setting JSON 中还原排队预热表单值，缺省时回落到默认值。
export function extractQueueFormValues(rawSetting) {
  const values = { ...QUEUE_FORM_DEFAULTS };
  if (typeof rawSetting === 'string') {
    if (!rawSetting.trim()) {
      return values;
    }
    try {
      return extractQueueFormValues(JSON.parse(rawSetting));
    } catch (error) {
      return values;
    }
  }
  const queue =
    rawSetting && typeof rawSetting === 'object' ? rawSetting.queue : null;
  if (!queue || typeof queue !== 'object' || Array.isArray(queue)) {
    return values;
  }

  values.queue_enabled = queue.enabled === true;
  values.queue_model =
    typeof queue.model === 'string' ? queue.model.trim() : '';
  if (Number.isInteger(queue.interval) && queue.interval > 0) {
    values.queue_interval = queue.interval;
  }
  values.queue_endpoint_type = normalizeQueueEndpointType(queue.endpoint_type);
  values.queue_warmup_message =
    typeof queue.warmup_message === 'string' ? queue.warmup_message : '';
  values.queue_max_tokens = Number.isInteger(queue.max_tokens)
    ? queue.max_tokens
    : null;
  if (Number.isInteger(queue.timeout)) {
    values.queue_timeout = queue.timeout;
  }
  values.queue_circuit_breaker_enabled = queue.circuit_breaker_enabled !== false;
  if (Number.isInteger(queue.max_consecutive_failures)) {
    values.queue_max_consecutive_failures = queue.max_consecutive_failures;
  }
  if (Number.isInteger(queue.cooldown_seconds)) {
    values.queue_cooldown_seconds = queue.cooldown_seconds;
  }
  if (Number.isInteger(queue.max_queue_attempts)) {
    values.queue_max_queue_attempts = queue.max_queue_attempts;
  }
  if (Number.isInteger(queue.backoff_seconds)) {
    values.queue_backoff_seconds = queue.backoff_seconds;
  }
  if (
    Array.isArray(queue.queue_busy_status_codes) &&
    queue.queue_busy_status_codes.length > 0
  ) {
    values.queue_busy_status_codes = queue.queue_busy_status_codes.join(',');
  }
  return values;
}

// 前端校验范围与后端 validateChannelQueueSettings 完全一致。
export function getQueueSettingsError(t, inputs, models) {
  if (inputs?.queue_enabled !== true) {
    return null;
  }
  const model = String(inputs.queue_model || '').trim();
  if (!model) {
    return t('启用排队预热后必须填写预热模型');
  }
  const modelList = Array.isArray(models)
    ? models.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  if (!modelList.includes(model)) {
    return t('预热模型必须是当前渠道模型列表中的模型');
  }

  const interval = Number(inputs.queue_interval);
  if (!Number.isInteger(interval) || interval < 1) {
    return t('预热间隔必须是不小于 1 的整数（秒）');
  }
  if (interval > MAX_QUEUE_DURATION_SECONDS) {
    return t('预热间隔不能超过 {{max}} 秒', {
      max: MAX_QUEUE_DURATION_SECONDS,
    });
  }

  const timeout = Number(inputs.queue_timeout);
  if (!Number.isInteger(timeout) || timeout < 0) {
    return t('单次超时必须是不小于 0 的整数（秒）');
  }
  if (timeout > MAX_QUEUE_DURATION_SECONDS) {
    return t('单次超时不能超过 {{max}} 秒', { max: MAX_QUEUE_DURATION_SECONDS });
  }
  if (timeout > 0 && timeout >= interval) {
    return t('单次超时必须小于预热间隔');
  }

  const maxTokens = inputs.queue_max_tokens;
  if (maxTokens !== '' && maxTokens !== null && maxTokens !== undefined) {
    const parsedMaxTokens = Number(maxTokens);
    if (!Number.isInteger(parsedMaxTokens) || parsedMaxTokens < 0) {
      return t('最大 tokens 必须是不小于 0 的整数');
    }
    if (parsedMaxTokens > MAX_QUEUE_WARMUP_TOKENS) {
      return t('最大 tokens 不能超过 {{max}}', {
        max: MAX_QUEUE_WARMUP_TOKENS,
      });
    }
  }

  const failures = Number(inputs.queue_max_consecutive_failures);
  if (!Number.isInteger(failures) || failures < 0) {
    return t('连续失败阈值必须是不小于 0 的整数');
  }

  const cooldown = Number(inputs.queue_cooldown_seconds);
  if (!Number.isInteger(cooldown) || cooldown < 0) {
    return t('熔断冷却必须是不小于 0 的整数（秒）');
  }
  if (cooldown > MAX_QUEUE_DURATION_SECONDS) {
    return t('熔断冷却不能超过 {{max}} 秒', { max: MAX_QUEUE_DURATION_SECONDS });
  }

  const attempts = Number(inputs.queue_max_queue_attempts);
  if (!Number.isInteger(attempts) || attempts < 0) {
    return t('单轮最大排队尝试次数必须是不小于 0 的整数');
  }

  const backoff = Number(inputs.queue_backoff_seconds);
  if (!Number.isInteger(backoff) || backoff < 0) {
    return t('重试退避必须是不小于 0 的整数（秒）');
  }
  if (backoff > MAX_QUEUE_DURATION_SECONDS) {
    return t('重试退避不能超过 {{max}} 秒', { max: MAX_QUEUE_DURATION_SECONDS });
  }

  const endpointType = normalizeQueueEndpointType(inputs.queue_endpoint_type);
  if (endpointType && !QUEUE_ENDPOINT_TYPE_VALUES.has(endpointType)) {
    return t('端点类型不合法');
  }

  const { invalid } = parseQueueBusyStatusCodes(inputs.queue_busy_status_codes);
  if (invalid.length > 0) {
    return t('队列繁忙状态码必须是 100-599 之间的整数，用英文逗号分隔');
  }
  return null;
}

// 只在启用时写入 setting.queue，字段名与后端 ChannelQueueSettings 完全一致。
export function buildQueueSettingsObject(inputs) {
  const queue = {
    enabled: true,
    model: String(inputs.queue_model || '').trim(),
    interval: toSeconds(inputs.queue_interval, QUEUE_FORM_DEFAULTS.queue_interval),
    endpoint_type: normalizeQueueEndpointType(inputs.queue_endpoint_type),
    warmup_message: String(inputs.queue_warmup_message || '').trim(),
    timeout: toSeconds(inputs.queue_timeout, QUEUE_FORM_DEFAULTS.queue_timeout),
    circuit_breaker_enabled: inputs.queue_circuit_breaker_enabled === true,
    max_consecutive_failures: toSeconds(
      inputs.queue_max_consecutive_failures,
      QUEUE_FORM_DEFAULTS.queue_max_consecutive_failures,
    ),
    cooldown_seconds: toSeconds(
      inputs.queue_cooldown_seconds,
      QUEUE_FORM_DEFAULTS.queue_cooldown_seconds,
    ),
    max_queue_attempts: toSeconds(
      inputs.queue_max_queue_attempts,
      QUEUE_FORM_DEFAULTS.queue_max_queue_attempts,
    ),
    backoff_seconds: toSeconds(
      inputs.queue_backoff_seconds,
      QUEUE_FORM_DEFAULTS.queue_backoff_seconds,
    ),
  };

  const maxTokens = toIntegerOrNull(inputs.queue_max_tokens);
  if (maxTokens !== null) {
    queue.max_tokens = maxTokens;
  }
  const { codes } = parseQueueBusyStatusCodes(inputs.queue_busy_status_codes);
  if (codes.length > 0) {
    queue.queue_busy_status_codes = codes;
  }
  return queue;
}

const formatStatusTime = (seconds) => {
  const value = Number(seconds);
  if (!value) {
    return '-';
  }
  return new Date(value * 1000).toLocaleString();
};

const QueueStatusPanel = ({ status, loading, onRefresh }) => {
  const { t } = useTranslation();

  let statusText = t('空闲');
  let statusColor = 'grey';
  if (status?.breaker_active) {
    statusText = t('熔断中');
    statusColor = 'orange';
  } else if (status?.warming) {
    statusText = t('预热中');
    statusColor = 'blue';
  } else if (status?.last_result === 'ok') {
    statusText = t('正常');
    statusColor = 'green';
  }

  return (
    <div
      className='rounded-xl p-3 text-xs'
      style={{
        backgroundColor: 'var(--semi-color-fill-0)',
        border: '1px solid var(--semi-color-fill-2)',
      }}
    >
      <div className='flex items-center justify-between mb-2'>
        <Text className='text-xs font-medium'>{t('预热状态')}</Text>
        <Space>
          {status ? (
            <Tag color={statusColor} shape='circle'>
              {statusText}
            </Tag>
          ) : null}
          <Button
            size='small'
            type='tertiary'
            icon={<IconRefresh size={12} />}
            loading={loading}
            onClick={onRefresh}
          >
            {t('刷新状态')}
          </Button>
        </Space>
      </div>
      {status ? (
        <div className='space-y-1 text-gray-600'>
          <div>
            {t('预热模型')}: {status.model || '-'}
          </div>
          <div>
            {t('连续失败次数')}: {Number(status.consecutive_failures) || 0}
          </div>
          <div>
            {t('上次预热时间')}: {formatStatusTime(status.last_warm_at)}
          </div>
          {status.last_status_code ? (
            <div>
              {t('上次状态码')}: {status.last_status_code}
            </div>
          ) : null}
          {status.last_result ? (
            <div className='break-all'>
              {t('上次结果')}: {status.last_result}
            </div>
          ) : null}
          {status.breaker_active ? (
            <div className='text-orange-500'>
              {t('熔断恢复时间')}: {formatStatusTime(status.breaker_until)}
            </div>
          ) : null}
        </div>
      ) : (
        <div className='text-gray-500'>
          {t('暂无预热状态，保存并启用后由后端定时任务预热')}
        </div>
      )}
    </div>
  );
};

const ChannelQueueSettings = ({ inputs, models, channelId, onChange }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const queueEnabled = inputs?.queue_enabled === true;

  const queueError = getQueueSettingsError(t, inputs, models);

  useEffect(() => {
    if (!channelId) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    setStatusLoading(true);
    API.get('/api/channel/queue/status', { skipErrorHandler: true })
      .then((res) => {
        if (cancelled) {
          return;
        }
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        setStatus(
          list.find((item) => Number(item.channel_id) === Number(channelId)) ||
            null,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStatusLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const refreshStatus = () => {
    if (!channelId) {
      return;
    }
    setStatusLoading(true);
    API.get('/api/channel/queue/status', {
      skipErrorHandler: true,
      disableDuplicate: true,
    })
      .then((res) => {
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        setStatus(
          list.find((item) => Number(item.channel_id) === Number(channelId)) ||
            null,
        );
      })
      .catch(() => {
        setStatus(null);
      })
      .finally(() => {
        setStatusLoading(false);
      });
  };

  return (
    <div className='pt-3 border-t border-gray-100'>
      <Text className='text-sm font-medium text-gray-500 mb-3 block'>
        {t('排队预热')}
      </Text>

      <Space vertical align='start' spacing={8} style={{ width: '100%' }}>
        <Switch
          checked={queueEnabled}
          onChange={(value) => onChange('queue_enabled', value === true)}
          checkedText={t('开')}
          uncheckedText={t('关')}
        />
        <div className='text-xs text-gray-500'>
          {t(
            '开启后会按间隔持续向上游发送预热请求以保持排队位置；一个渠道只预热一个模型，需要预热多个模型时请配置多个渠道。',
          )}
        </div>
      </Space>

      {channelId ? (
        <div className='mt-3'>
          <QueueStatusPanel
            status={status}
            loading={statusLoading}
            onRefresh={refreshStatus}
          />
        </div>
      ) : null}

      {queueEnabled ? (
        <div className='mt-3 space-y-4'>
          <Row gutter={12}>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>{t('预热模型')}</div>
              <Input
                value={inputs.queue_model || ''}
                placeholder={t('需要保持排队的模型名')}
                onChange={(value) => onChange('queue_model', value)}
              />
            </Col>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>{t('端点类型')}</div>
              <Select
                value={normalizeQueueEndpointType(inputs.queue_endpoint_type)}
                style={{ width: '100%' }}
                onChange={(value) => onChange('queue_endpoint_type', value)}
              >
                {QUEUE_ENDPOINT_TYPES.map((option) => (
                  <Select.Option
                    key={option.value || 'auto'}
                    value={option.value}
                  >
                    {t(option.label)}
                  </Select.Option>
                ))}
              </Select>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>
                {t('预热间隔（秒）')}
              </div>
              <InputNumber
                value={inputs.queue_interval ?? ''}
                min={1}
                max={MAX_QUEUE_DURATION_SECONDS}
                step={1}
                precision={0}
                style={{ width: '100%' }}
                onChange={(value) =>
                  onChange('queue_interval', toIntegerOrNull(value))
                }
              />
            </Col>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>
                {t('单次超时（秒）')}
              </div>
              <InputNumber
                value={inputs.queue_timeout ?? ''}
                min={0}
                max={MAX_QUEUE_DURATION_SECONDS}
                step={1}
                precision={0}
                style={{ width: '100%' }}
                onChange={(value) =>
                  onChange('queue_timeout', toIntegerOrNull(value))
                }
              />
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>
                {t('最大 tokens')}
              </div>
              <InputNumber
                value={inputs.queue_max_tokens ?? ''}
                min={0}
                max={MAX_QUEUE_WARMUP_TOKENS}
                step={1}
                precision={0}
                placeholder={t('留空使用默认值')}
                style={{ width: '100%' }}
                onChange={(value) =>
                  onChange('queue_max_tokens', toIntegerOrNull(value))
                }
              />
            </Col>
            <Col span={12}>
              <div className='mb-1 text-xs text-gray-600'>{t('预热消息')}</div>
              <Input
                value={inputs.queue_warmup_message || ''}
                placeholder={t('留空使用默认测试消息')}
                onChange={(value) => onChange('queue_warmup_message', value)}
              />
            </Col>
          </Row>

          <div
            className='rounded-xl p-3'
            style={{
              backgroundColor: 'var(--semi-color-fill-0)',
              border: '1px solid var(--semi-color-fill-2)',
            }}
          >
            <div className='flex items-center justify-between mb-2'>
              <Text className='text-xs font-medium'>{t('熔断保护')}</Text>
              <Switch
                checked={inputs.queue_circuit_breaker_enabled !== false}
                onChange={(value) =>
                  onChange('queue_circuit_breaker_enabled', value === true)
                }
                checkedText={t('开')}
                uncheckedText={t('关')}
              />
            </div>
            <div className='text-xs text-gray-500 mb-3'>
              {t(
                '队列繁忙响应（如 429/503）不会触发熔断，仅真实失败会计入连续失败次数；熔断只暂停本渠道的预热，不影响正常请求。',
              )}
            </div>

            <Row gutter={12}>
              <Col span={12}>
                <div className='mb-1 text-xs text-gray-600'>
                  {t('连续失败阈值')}
                </div>
                <InputNumber
                  value={inputs.queue_max_consecutive_failures ?? ''}
                  min={0}
                  step={1}
                  precision={0}
                  style={{ width: '100%' }}
                  onChange={(value) =>
                    onChange(
                      'queue_max_consecutive_failures',
                      toIntegerOrNull(value),
                    )
                  }
                />
              </Col>
              <Col span={12}>
                <div className='mb-1 text-xs text-gray-600'>
                  {t('熔断冷却（秒）')}
                </div>
                <InputNumber
                  value={inputs.queue_cooldown_seconds ?? ''}
                  min={0}
                  max={MAX_QUEUE_DURATION_SECONDS}
                  step={1}
                  precision={0}
                  style={{ width: '100%' }}
                  onChange={(value) =>
                    onChange('queue_cooldown_seconds', toIntegerOrNull(value))
                  }
                />
              </Col>
            </Row>

            <Row gutter={12} className='mt-3'>
              <Col span={12}>
                <div className='mb-1 text-xs text-gray-600'>
                  {t('单轮最大排队尝试')}
                </div>
                <InputNumber
                  value={inputs.queue_max_queue_attempts ?? ''}
                  min={0}
                  step={1}
                  precision={0}
                  style={{ width: '100%' }}
                  onChange={(value) =>
                    onChange('queue_max_queue_attempts', toIntegerOrNull(value))
                  }
                />
                <div className='mt-1 text-xs text-gray-500'>
                  {t('0 表示单轮不限次数')}
                </div>
              </Col>
              <Col span={12}>
                <div className='mb-1 text-xs text-gray-600'>
                  {t('重试退避（秒）')}
                </div>
                <InputNumber
                  value={inputs.queue_backoff_seconds ?? ''}
                  min={0}
                  max={MAX_QUEUE_DURATION_SECONDS}
                  step={1}
                  precision={0}
                  style={{ width: '100%' }}
                  onChange={(value) =>
                    onChange('queue_backoff_seconds', toIntegerOrNull(value))
                  }
                />
              </Col>
            </Row>
          </div>

          <div>
            <div className='mb-1 text-xs text-gray-600'>
              {t('队列繁忙状态码')}
            </div>
            <Input
              value={inputs.queue_busy_status_codes || ''}
              placeholder='429,503'
              onChange={(value) => onChange('queue_busy_status_codes', value)}
            />
            <div className='mt-1 text-xs text-gray-500'>
              {t(
                '用英文逗号分隔，被判定为“排队繁忙”的状态码不会触发熔断；留空时默认 429,503。',
              )}
            </div>
          </div>

          {queueError ? (
            <Banner
              type='danger'
              description={queueError}
              closeIcon={null}
              className='!rounded-xl'
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default ChannelQueueSettings;
