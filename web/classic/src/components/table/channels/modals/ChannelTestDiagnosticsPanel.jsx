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
import { Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

// 渲染 POST /api/channel/test/:id 返回的 diagnostics 明细。
// result: { success, message, time, errorCode, diagnostics, testType }
const ChannelTestDiagnosticsPanel = ({ result }) => {
  const { t } = useTranslation();

  if (!result) {
    return null;
  }

  const diagnostics = result.diagnostics || null;
  const status = diagnostics?.status || (result.success ? 'passed' : 'failed');
  const statusMeta = {
    passed: { color: 'green', label: t('通过') },
    degraded: { color: 'orange', label: t('降级通过') },
    skipped: { color: 'grey', label: t('不适用') },
    failed: { color: 'red', label: t('失败') },
  }[status] || { color: 'grey', label: status };

  const reasonLabels = {
    request_failed: t('请求失败'),
    invalid_endpoint: t('无法解析测试端点'),
    not_applicable: t('当前端点不支持该测试类型'),
    upstream_error: t('上游返回错误'),
    empty_response: t('上游返回空响应'),
    invalid_json: t('响应不是合法的 JSON'),
    invalid_response: t('响应结构不正确'),
    invalid_stream: t('流式响应格式不正确'),
    incomplete_stream: t('流式响应未正常结束'),
    stream_timeout: t('流式响应超时'),
    stream_interrupted: t('流式响应中断'),
    empty_output: t('响应没有有效输出'),
    output_incomplete: t('输出未完整生成'),
    output_blocked: t('输出被上游拦截'),
    response_too_large: t('响应内容过大'),
    tool_not_called: t('模型未调用工具'),
    unexpected_tool: t('模型调用了非预期工具'),
    invalid_tool_arguments: t('工具参数不正确'),
    tool_validated: t('工具调用校验通过'),
    response_validated: t('响应校验通过'),
    compatibility_stream: t('请求流式但上游返回非流式'),
  };

  const boolText = (value) => {
    if (value === undefined || value === null) {
      return t('未知');
    }
    return value ? t('是') : t('否');
  };

  const testType = diagnostics?.test_type || result.testType || '';
  const isToolCall = testType === 'tool_call';
  const durationMs =
    diagnostics?.duration_ms ??
    (result.time ? Math.round(result.time * 1000) : null);
  const reason = diagnostics?.reason
    ? reasonLabels[diagnostics.reason] || diagnostics.reason
    : '';
  const detail = (diagnostics?.detail || result.message || '').trim();

  const rows = [
    {
      label: t('测试类型'),
      value: isToolCall ? t('工具调用测试') : t('基础测试'),
    },
    {
      label: t('端点类型'),
      value:
        [diagnostics?.endpoint_type, diagnostics?.endpoint_path]
          .filter(Boolean)
          .join(' ') || t('未知'),
    },
    {
      label: t('耗时'),
      value:
        durationMs === null || durationMs === undefined
          ? t('未知')
          : `${durationMs} ms`,
    },
    ...(diagnostics?.first_response_ms !== undefined &&
    diagnostics?.first_response_ms !== null
      ? [
          {
            label: t('首字节耗时'),
            value: `${diagnostics.first_response_ms} ms`,
          },
        ]
      : []),
    ...(diagnostics
      ? [
          { label: t('事件数'), value: String(diagnostics.event_count ?? 0) },
          {
            label: t('请求流式'),
            value: boolText(diagnostics.requested_stream),
          },
          {
            label: t('上游流式'),
            value: boolText(diagnostics.upstream_stream),
          },
        ]
      : []),
    ...(diagnostics && isToolCall
      ? [
          { label: t('工具数量'), value: String(diagnostics.tool_count ?? 0) },
          {
            label: t('工具名合法'),
            value: boolText(diagnostics.tool_name_valid),
          },
          {
            label: t('工具参数合法'),
            value: boolText(diagnostics.tool_arguments_valid),
          },
        ]
      : []),
  ];

  return (
    <div className='flex flex-col gap-1 rounded-md border border-[var(--semi-color-border)] px-2 py-1.5 mt-1'>
      <div className='flex items-center gap-2 flex-wrap'>
        <Tag color={statusMeta.color} shape='circle' size='small'>
          {statusMeta.label}
        </Tag>
        <Typography.Text type='tertiary' size='small'>
          {t('能力诊断')}
        </Typography.Text>
        {reason && (
          <Typography.Text
            size='small'
            type={status === 'failed' ? 'danger' : 'tertiary'}
          >
            {t('原因')}: {reason}
          </Typography.Text>
        )}
      </div>
      <div className='flex flex-wrap gap-x-3 gap-y-1'>
        {rows.map((row) => (
          <span key={row.label} className='inline-flex items-start gap-1'>
            <Typography.Text type='tertiary' size='small'>
              {row.label}:
            </Typography.Text>
            <Typography.Text size='small' className='break-all'>
              {row.value}
            </Typography.Text>
          </span>
        ))}
      </div>
      {detail && (
        <Typography.Text
          size='small'
          className='break-all'
          style={{ maxWidth: '400px', fontSize: '12px' }}
        >
          {t('详情')}: {detail}
        </Typography.Text>
      )}
    </div>
  );
};

export default ChannelTestDiagnosticsPanel;
