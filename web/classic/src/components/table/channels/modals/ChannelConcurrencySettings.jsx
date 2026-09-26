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
import { useTranslation } from 'react-i18next';
import {
  Button,
  InputNumber,
  Select,
  Space,
  Typography,
} from '@douyinfe/semi-ui';
import { IconDelete, IconPlus } from '@douyinfe/semi-icons';

const { Text } = Typography;

// 与后端 setting.MaxChannelConcurrency 保持一致。
export const MAX_MODEL_CONCURRENCY = 1000000;

// 表单默认值。按模型并发是对象，这里用「数组 + 稳定 id」承载，便于增删改。
export const MODEL_CONCURRENCY_FORM_DEFAULTS = {
  model_concurrency: [],
};

let rowIdSeed = 0;
const nextRowId = () => {
  rowIdSeed += 1;
  return `mc-${rowIdSeed}`;
};

// 从已保存的 setting JSON 中还原按模型并发配置。
export function extractModelConcurrencyRows(rawSetting) {
  let parsed = rawSetting;
  if (typeof rawSetting === 'string') {
    if (!rawSetting.trim()) {
      return [];
    }
    try {
      parsed = JSON.parse(rawSetting);
    } catch (error) {
      return [];
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return [];
  }
  const raw = parsed.model_concurrency;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return [];
  }
  return Object.entries(raw).map(([model, limit]) => ({
    id: nextRowId(),
    model,
    limit,
  }));
}

// 数组 -> 后端需要的 map[string]int，空模型名与非法上限直接丢弃。
export function buildModelConcurrencyMap(rows) {
  const result = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const model = String(row?.model || '').trim();
    const limit = Number(row?.limit);
    if (!model) {
      return;
    }
    if (!Number.isInteger(limit) || limit <= 0) {
      return;
    }
    result[model] = limit;
  });
  return result;
}

// 与后端 ValidateChannelModelConcurrency 保持一致的本地校验。
export function getModelConcurrencyError(t, rows, models) {
  const list = Array.isArray(rows) ? rows : [];
  const modelList = Array.isArray(models)
    ? models.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const seen = new Set();

  for (const row of list) {
    const model = String(row?.model || '').trim();
    const rawLimit = row?.limit;
    if (!model) {
      return t('按模型并发中存在未选择模型的条目');
    }
    if (seen.has(model)) {
      return t('按模型并发中模型 {{model}} 重复', { model });
    }
    seen.add(model);
    if (
      rawLimit === '' ||
      rawLimit === null ||
      rawLimit === undefined ||
      !Number.isInteger(Number(rawLimit)) ||
      Number(rawLimit) <= 0 ||
      Number(rawLimit) > MAX_MODEL_CONCURRENCY
    ) {
      return t('模型 {{model}} 的并发必须是 1-1000000 之间的整数', { model });
    }
    if (modelList.length > 0 && !modelList.includes(model)) {
      return t('模型 {{model}} 不在该渠道的模型列表中', { model });
    }
  }
  return null;
}

const ChannelConcurrencySettings = ({ rows, models, onChange }) => {
  const { t } = useTranslation();

  const modelOptions = (Array.isArray(models) ? models : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((model) => ({ value: model, label: model }));

  const updateRow = (id, patch) => {
    onChange(
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (id) => {
    onChange(rows.filter((row) => row.id !== id));
  };

  const addRow = () => {
    onChange([...rows, { id: nextRowId(), model: '', limit: 10 }]);
  };

  return (
    <div className='pt-3 border-t border-gray-100'>
      <Text className='text-sm font-medium text-gray-500 mb-3 block'>
        {t('按模型细分并发')}
      </Text>
      <Text type='tertiary' size='small'>
        {t(
          '默认留空即可。单独设置的模型使用自己的并发上限并独立计数，不再受渠道级并发约束；未单独设置的模型共用渠道级并发。',
        )}
      </Text>

      <div className='mt-3 flex flex-col gap-2'>
        {rows.length === 0 && (
          <Text type='tertiary' size='small'>
            {t('尚未单独设置任何模型')}
          </Text>
        )}
        {rows.map((row) => (
          <Space key={row.id} spacing={8} align='center'>
            <Select
              style={{ width: 260 }}
              placeholder={t('选择或输入模型名')}
              filter
              allowCreate
              value={row.model || undefined}
              optionList={modelOptions}
              onChange={(value) => updateRow(row.id, { model: value || '' })}
            />
            <InputNumber
              style={{ width: 140 }}
              min={1}
              max={MAX_MODEL_CONCURRENCY}
              step={1}
              value={row.limit}
              placeholder={t('并发上限')}
              onChange={(value) => updateRow(row.id, { limit: value })}
            />
            <Button
              icon={<IconDelete />}
              theme='borderless'
              type='danger'
              onClick={() => removeRow(row.id)}
            />
          </Space>
        ))}
      </div>

      <Button
        className='mt-3'
        icon={<IconPlus />}
        theme='light'
        onClick={addRow}
      >
        {t('添加模型并发')}
      </Button>
    </div>
  );
};

export default ChannelConcurrencySettings;
