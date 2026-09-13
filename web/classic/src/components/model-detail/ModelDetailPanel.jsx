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
import { Divider, Space, Tag, Typography } from '@douyinfe/semi-ui';
import ModelHeader from '../table/model-pricing/modal/components/ModelHeader';
import ModelBasicInfo from '../table/model-pricing/modal/components/ModelBasicInfo';
import ModelPricingTable from '../table/model-pricing/modal/components/ModelPricingTable';
import ModelEndpoints from '../table/model-pricing/modal/components/ModelEndpoints';
import ModelPricingBreakdown from './ModelPricingBreakdown';

const { Text } = Typography;

const CAPABILITY_LABELS = {
  function_calling: '函数调用',
  streaming: '流式输出',
  vision: '视觉',
  json_mode: 'JSON 模式',
  structured_output: '结构化输出',
  reasoning: '推理',
  tools: '工具调用',
  system_prompt: '系统提示词',
  web_search: '联网搜索',
  code_interpreter: '代码解释器',
  caching: '提示缓存',
  embeddings: '向量嵌入',
};

const MODALITY_LABELS = {
  text: '文本',
  image: '图片',
  audio: '音频',
  video: '视频',
  file: '文件',
};

const formatTokenCount = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
};

/**
 * 模型详情主面板：模型信息 + 计费价格 + 分组价格 + 端点。
 * 复用模型广场已有的详情块组件，保证展示与数据口径一致。
 */
const ModelDetailPanel = ({
  model,
  vendorsMap = {},
  groupRatio = {},
  usableGroup = {},
  endpointMap = {},
  autoGroups = [],
  currency,
  siteDisplayType,
  tokenUnit,
  displayPrice,
  showRatio = false,
  t,
}) => {
  if (!model) return null;

  const capabilities = Array.isArray(model.capabilities)
    ? model.capabilities.filter(Boolean)
    : [];
  const inputModalities = Array.isArray(model.input_modalities)
    ? model.input_modalities.filter(Boolean)
    : [];
  const outputModalities = Array.isArray(model.output_modalities)
    ? model.output_modalities.filter(Boolean)
    : [];
  const contextLength = formatTokenCount(model.context_length);
  const maxOutputTokens = formatTokenCount(model.max_output_tokens);
  const hasQuickStats =
    Boolean(contextLength) ||
    Boolean(maxOutputTokens) ||
    inputModalities.length > 0 ||
    outputModalities.length > 0;

  return (
    <div>
      <ModelHeader modelData={model} vendorsMap={vendorsMap} t={t} />

      {model.vendor_name && (
        <div className='mt-2 text-xs text-gray-600'>
          {t('供应商：')}
          {model.vendor_name}
        </div>
      )}

      <Divider margin={16} />

      <ModelBasicInfo modelData={model} vendorsMap={vendorsMap} t={t} />

      {capabilities.length > 0 && (
        <div className='mt-4'>
          <div className='mb-2 text-sm font-medium'>{t('能力标签')}</div>
          <Space wrap>
            {capabilities.map((capability) => (
              <Tag key={capability} color='blue' shape='circle' size='small'>
                {t(CAPABILITY_LABELS[capability] || capability)}
              </Tag>
            ))}
          </Space>
        </div>
      )}

      {hasQuickStats && (
        <div
          className='mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4'
          style={{ color: 'var(--semi-color-text-1)' }}
        >
          {contextLength && (
            <div className='rounded-lg border p-3'>
              <div className='text-xs text-gray-600'>{t('上下文长度')}</div>
              <div className='mt-1 font-semibold'>{contextLength}</div>
            </div>
          )}
          {maxOutputTokens && (
            <div className='rounded-lg border p-3'>
              <div className='text-xs text-gray-600'>{t('最大输出')}</div>
              <div className='mt-1 font-semibold'>{maxOutputTokens}</div>
            </div>
          )}
          {inputModalities.length > 0 && (
            <div className='rounded-lg border p-3'>
              <div className='text-xs text-gray-600'>{t('输入模态')}</div>
              <div className='mt-1 font-semibold'>
                {inputModalities
                  .map((item) => t(MODALITY_LABELS[item] || item))
                  .join(' / ')}
              </div>
            </div>
          )}
          {outputModalities.length > 0 && (
            <div className='rounded-lg border p-3'>
              <div className='text-xs text-gray-600'>{t('输出模态')}</div>
              <div className='mt-1 font-semibold'>
                {outputModalities
                  .map((item) => t(MODALITY_LABELS[item] || item))
                  .join(' / ')}
              </div>
            </div>
          )}
        </div>
      )}

      <Divider margin={16} />

      <ModelPricingBreakdown
        model={model}
        groupRatio={groupRatio}
        currency={currency}
        siteDisplayType={siteDisplayType}
        tokenUnit={tokenUnit}
        displayPrice={displayPrice}
        t={t}
      />

      <Divider margin={16} />

      <ModelPricingTable
        modelData={model}
        groupRatio={groupRatio}
        currency={currency}
        siteDisplayType={siteDisplayType}
        tokenUnit={tokenUnit}
        displayPrice={displayPrice}
        showRatio={showRatio}
        usableGroup={usableGroup}
        autoGroups={autoGroups}
        t={t}
      />

      <Divider margin={16} />

      <ModelEndpoints modelData={model} endpointMap={endpointMap} t={t} />

      <Text type='tertiary' size='small' className='block mt-4'>
        {t('以上价格与倍率仅供参考，实际计费以服务端结算为准。')}
      </Text>
    </div>
  );
};

export default ModelDetailPanel;
