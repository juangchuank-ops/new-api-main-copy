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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banner,
  Button,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconDelete, IconPlus } from '@douyinfe/semi-icons';
import { API, showError, showSuccess, showWarning } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

// 与后端 setting.UpstreamInterceptionOptionKey 保持一致
const OPTION_KEY = 'UpstreamInterceptionConfig';

const ACTION_REMOVE = 'remove';
const ACTION_BLOCK = 'block';
const RULE_TYPE_KEYWORD = 'keyword';
const RULE_TYPE_REGEX = 'regex';

const MAX_RULES = 100;
const MAX_RULE_NAME_LENGTH = 64;
const MAX_EXPRESSION_LENGTH = 512;
const MAX_ERROR_CODE_LENGTH = 64;
const MAX_ERROR_MESSAGE_LENGTH = 500;
const ERROR_CODE_PATTERN = /^[A-Za-z0-9_.:-]+$/;
const CHANNEL_ID_TOKEN_PATTERN = /^\d+$/;

const DEFAULT_ERROR_STATUS = 502;
const DEFAULT_ERROR_CODE = 'upstream_response_intercepted';
const DEFAULT_ERROR_MESSAGE = '上游响应被内容策略拦截';

const runeLength = (value) => Array.from(String(value ?? '')).length;

const toInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

// 与后端 setting.DefaultUpstreamInterceptionConfig 的默认值保持一致
const buildFormState = (rawValue) => {
  let parsed = {};
  if (typeof rawValue === 'string' && rawValue.trim() !== '') {
    try {
      const decoded = JSON.parse(rawValue);
      if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
        parsed = decoded;
      }
    } catch (error) {
      parsed = {};
    }
  }
  return {
    enabled: !!parsed.enabled,
    action: parsed.action === ACTION_BLOCK ? ACTION_BLOCK : ACTION_REMOVE,
    retry_on_block: !!parsed.retry_on_block,
    error_status: toInteger(parsed.error_status, DEFAULT_ERROR_STATUS),
    error_code:
      typeof parsed.error_code === 'string'
        ? parsed.error_code
        : DEFAULT_ERROR_CODE,
    error_message:
      typeof parsed.error_message === 'string'
        ? parsed.error_message
        : DEFAULT_ERROR_MESSAGE,
    excluded_channel_ids: Array.isArray(parsed.excluded_channel_ids)
      ? parsed.excluded_channel_ids.join(', ')
      : '',
    rules: Array.isArray(parsed.rules)
      ? parsed.rules.map((rule) => ({
          name: typeof rule?.name === 'string' ? rule.name : '',
          type:
            rule?.type === RULE_TYPE_REGEX
              ? RULE_TYPE_REGEX
              : RULE_TYPE_KEYWORD,
          expression:
            typeof rule?.expression === 'string' ? rule.expression : '',
          enabled: !!rule?.enabled,
        }))
      : [],
  };
};

// 后端要求正整数、去重升序；非法输入返回 null，由保存前校验给出明确提示
const parseChannelIds = (text) => {
  const tokens = String(text ?? '')
    .split(/[\s,，]+/)
    .filter((token) => token !== '');
  const ids = [];
  for (const token of tokens) {
    const value = Number(token);
    if (!CHANNEL_ID_TOKEN_PATTERN.test(token) || value <= 0) return null;
    if (!ids.includes(value)) ids.push(value);
  }
  ids.sort((a, b) => a - b);
  return ids;
};

// 提交给后端的始终是 JSON 字符串（字段顺序与后端结构体一致）
const buildOptionValue = (form) =>
  JSON.stringify({
    enabled: !!form.enabled,
    action: form.action === ACTION_BLOCK ? ACTION_BLOCK : ACTION_REMOVE,
    retry_on_block: !!form.retry_on_block,
    error_status: toInteger(form.error_status, 0),
    error_code: String(form.error_code ?? '').trim(),
    error_message: String(form.error_message ?? '').trim(),
    excluded_channel_ids: parseChannelIds(form.excluded_channel_ids) ?? [],
    rules: (form.rules || []).map((rule) => ({
      name: String(rule.name ?? '').trim(),
      type: rule.type === RULE_TYPE_REGEX ? RULE_TYPE_REGEX : RULE_TYPE_KEYWORD,
      expression: String(rule.expression ?? '').trim(),
      enabled: !!rule.enabled,
    })),
  });

// 与后端 compileUpstreamInterceptionConfig 的校验规则保持一致
const validateForm = (form, t) => {
  if (form.action !== ACTION_REMOVE && form.action !== ACTION_BLOCK) {
    return t('拦截动作不合法');
  }
  const errorStatus = toInteger(form.error_status, 0);
  if (errorStatus < 400 || errorStatus > 599) {
    return t('错误状态码必须是 400-599 之间的整数');
  }
  const errorCode = String(form.error_code ?? '').trim();
  if (errorCode === '') return t('错误码不能为空');
  if (
    runeLength(errorCode) > MAX_ERROR_CODE_LENGTH ||
    !ERROR_CODE_PATTERN.test(errorCode)
  ) {
    return t(
      '错误码最长 64 个字符，且仅支持字母、数字、下划线、点、冒号与短横线',
    );
  }
  const errorMessage = String(form.error_message ?? '').trim();
  if (errorMessage === '') return t('错误信息不能为空');
  if (runeLength(errorMessage) > MAX_ERROR_MESSAGE_LENGTH) {
    return t('错误信息最长 500 个字符');
  }
  if (parseChannelIds(form.excluded_channel_ids) === null) {
    return t('排除的渠道 ID 必须是正整数，可使用逗号、空格或换行分隔');
  }
  const rules = form.rules || [];
  if (rules.length > MAX_RULES) return t('最多支持 100 条拦截规则');
  const names = new Set();
  for (let index = 0; index < rules.length; index++) {
    const rule = rules[index];
    const name = String(rule.name ?? '').trim();
    if (name === '') {
      return t('第 {{index}} 条规则的名称不能为空', { index: index + 1 });
    }
    if (runeLength(name) > MAX_RULE_NAME_LENGTH) {
      return t('第 {{index}} 条规则的名称最长 64 个字符', { index: index + 1 });
    }
    if (names.has(name)) return t('规则名称重复：{{name}}', { name });
    names.add(name);
    if (rule.type !== RULE_TYPE_KEYWORD && rule.type !== RULE_TYPE_REGEX) {
      return t('第 {{index}} 条规则的匹配类型不合法', { index: index + 1 });
    }
    const expression = String(rule.expression ?? '').trim();
    if (expression === '') {
      return t('第 {{index}} 条规则的匹配表达式不能为空', {
        index: index + 1,
      });
    }
    if (runeLength(expression) > MAX_EXPRESSION_LENGTH) {
      return t('第 {{index}} 条规则的匹配表达式最长 512 个字符', {
        index: index + 1,
      });
    }
    if (!rule.enabled || rule.type !== RULE_TYPE_REGEX) continue;
    try {
      if (new RegExp(expression, 'i').test('')) {
        return t('第 {{index}} 条规则的正则表达式不能匹配空文本', {
          index: index + 1,
        });
      }
    } catch (error) {
      return t('第 {{index}} 条规则的正则表达式不合法', { index: index + 1 });
    }
  }
  return '';
};

export default function SettingsUpstreamInterception(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(() => buildFormState(''));
  const [savedValue, setSavedValue] = useState('');
  const refForm = useRef();
  const optionValue = useMemo(() => buildOptionValue(form), [form]);

  const actionOptions = useMemo(
    () => [
      { value: ACTION_REMOVE, label: t('移除匹配内容') },
      { value: ACTION_BLOCK, label: t('直接返回错误') },
    ],
    [t],
  );
  const ruleTypeOptions = useMemo(
    () => [
      { value: RULE_TYPE_KEYWORD, label: t('关键词') },
      { value: RULE_TYPE_REGEX, label: t('正则表达式') },
    ],
    [t],
  );

  useEffect(() => {
    const next = buildFormState(props.options?.[OPTION_KEY]);
    setForm(next);
    setSavedValue(buildOptionValue(next));
    if (refForm.current) refForm.current.setValues(next);
  }, [props.options]);

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const updateRule = (index, patch) =>
    setForm((prev) => ({
      ...prev,
      rules: prev.rules.map((rule, i) =>
        i === index ? { ...rule, ...patch } : rule,
      ),
    }));

  const addRule = () =>
    setForm((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        {
          name: '',
          type: RULE_TYPE_KEYWORD,
          expression: '',
          enabled: true,
        },
      ],
    }));

  const removeRule = (index) =>
    setForm((prev) => ({
      ...prev,
      rules: prev.rules.filter((rule, i) => i !== index),
    }));

  async function onSubmit() {
    if (optionValue === savedValue) {
      return showWarning(t('你似乎并没有修改什么'));
    }
    const validationMessage = validateForm(form, t);
    if (validationMessage) return showError(validationMessage);
    setLoading(true);
    try {
      const res = await API.put('/api/option/', {
        key: OPTION_KEY,
        value: optionValue,
      });
      const { success, message } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      showSuccess(t('保存成功'));
      props.refresh();
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  const ruleColumns = [
    {
      title: t('规则名称'),
      dataIndex: 'name',
      width: 200,
      render: (text, record, index) => (
        <Input
          value={record.name}
          placeholder={t('例如：拦截内容策略命中')}
          aria-label={t('规则名称')}
          onChange={(value) => updateRule(index, { name: value })}
        />
      ),
    },
    {
      title: t('匹配类型'),
      dataIndex: 'type',
      width: 150,
      render: (text, record, index) => (
        <Select
          value={record.type}
          optionList={ruleTypeOptions}
          style={{ width: '100%' }}
          aria-label={t('匹配类型')}
          onChange={(value) => updateRule(index, { type: value })}
        />
      ),
    },
    {
      title: t('匹配表达式'),
      dataIndex: 'expression',
      render: (text, record, index) => (
        <Input
          value={record.expression}
          placeholder={
            record.type === RULE_TYPE_REGEX
              ? t('例如：content_filter')
              : t('例如：内容策略')
          }
          aria-label={t('匹配表达式')}
          onChange={(value) => updateRule(index, { expression: value })}
        />
      ),
    },
    {
      title: t('启用'),
      dataIndex: 'enabled',
      width: 80,
      render: (text, record, index) => (
        <Switch
          checked={record.enabled}
          size='small'
          aria-label={t('启用')}
          onChange={(checked) => updateRule(index, { enabled: checked })}
        />
      ),
    },
    {
      title: t('操作'),
      width: 80,
      render: (text, record, index) => (
        <Button
          icon={<IconDelete />}
          theme='borderless'
          type='danger'
          title={t('删除规则')}
          aria-label={t('删除规则')}
          onClick={() => removeRule(index)}
        />
      ),
    },
  ];

  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={form}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('上游拦截设置')}>
            <Banner
              fullMode={false}
              type='info'
              description={t(
                '上游拦截会检查上游返回的响应内容，命中规则后可移除匹配片段或直接返回错误；请谨慎编写匹配表达式，避免误伤正常响应。',
              )}
            />
            <Divider style={{ marginTop: 12, marginBottom: 12 }} />
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'enabled'}
                  label={t('启用上游拦截')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={(value) => updateForm({ enabled: value })}
                />
                <Text type='tertiary' size='small'>
                  {t('未启用时不会检查上游响应，规则也不会生效。')}
                </Text>
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Select
                  field={'action'}
                  label={t('命中后的处理方式')}
                  optionList={actionOptions}
                  style={{ width: '100%' }}
                  extraText={t(
                    '移除匹配内容：仅从响应中删除命中片段；直接返回错误：中断响应并返回下方配置的错误。',
                  )}
                  onChange={(value) => updateForm({ action: value })}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'retry_on_block'}
                  label={t('拦截后允许重试其他渠道')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={(value) => updateForm({ retry_on_block: value })}
                />
                <Text type='tertiary' size='small'>
                  {t(
                    '仅在返回错误时生效（包括移除后没有剩余内容的情况）：允许本次请求重试其他渠道。',
                  )}
                </Text>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 12 }}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'error_status'}
                  label={t('错误状态码')}
                  step={1}
                  min={400}
                  max={599}
                  placeholder={''}
                  extraText={t(
                    '命中拦截时返回给客户端的 HTTP 状态码，取值范围 400-599。',
                  )}
                  onChange={(value) => updateForm({ error_status: value })}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Input
                  field={'error_code'}
                  label={t('错误码')}
                  placeholder={DEFAULT_ERROR_CODE}
                  extraText={t(
                    '返回给客户端的错误码，最长 64 个字符，仅支持字母、数字、下划线、点、冒号与短横线。',
                  )}
                  onChange={(value) => updateForm({ error_code: value })}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Input
                  field={'error_message'}
                  label={t('错误信息')}
                  placeholder={DEFAULT_ERROR_MESSAGE}
                  extraText={t('返回给客户端的错误提示，最长 500 个字符。')}
                  onChange={(value) => updateForm({ error_message: value })}
                />
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 12 }}>
              <Col xs={24} sm={16}>
                <Form.Input
                  field={'excluded_channel_ids'}
                  label={t('排除的渠道 ID')}
                  placeholder={'1, 2, 3…'}
                  extraText={t(
                    '这些渠道不参与上游拦截；多个 ID 可使用逗号、空格或换行分隔。',
                  )}
                  onChange={(value) =>
                    updateForm({ excluded_channel_ids: value })
                  }
                />
              </Col>
            </Row>
            <Divider style={{ marginTop: 12, marginBottom: 12 }} />
            <Space style={{ marginBottom: 8 }}>
              <Text strong>{t('拦截规则')}</Text>
              <Tag>{`${form.rules.length} / ${MAX_RULES}`}</Tag>
              <Button
                icon={<IconPlus />}
                disabled={form.rules.length >= MAX_RULES}
                onClick={addRule}
              >
                {t('新增规则')}
              </Button>
            </Space>
            <Text
              type='tertiary'
              size='small'
              style={{ display: 'block', marginBottom: 8 }}
            >
              {t(
                '仅启用的规则参与拦截：关键词类型按不区分大小写的子串匹配，正则表达式类型按不区分大小写的正则匹配；规则名称需全局唯一。',
              )}
            </Text>
            <Table
              columns={ruleColumns}
              dataSource={form.rules.map((rule, index) => ({
                ...rule,
                id: index,
              }))}
              rowKey='id'
              pagination={false}
              size='small'
              empty={t('暂无拦截规则')}
            />
            <Row style={{ marginTop: 12 }}>
              <Button size='default' onClick={onSubmit}>
                {t('保存上游拦截设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
