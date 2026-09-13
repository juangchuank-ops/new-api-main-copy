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
import { Avatar, Tag, Typography } from '@douyinfe/semi-ui';
import { IconPriceTag } from '@douyinfe/semi-icons';
import { calculateModelPrice, getModelPriceItems } from '../../helpers';
import DynamicPricingBreakdown from '../table/model-pricing/modal/components/DynamicPricingBreakdown';

const { Text } = Typography;

const getBillingModeLabel = (model, t) => {
  if (model?.billing_mode === 'tiered_expr') return t('动态计费');
  if (model?.quota_type === 0) return t('按量计费');
  if (model?.quota_type === 1) return t('按次计费');
  return t('未知计费');
};

const getBillingModeColor = (model) => {
  if (model?.billing_mode === 'tiered_expr') return 'amber';
  if (model?.quota_type === 0) return 'violet';
  if (model?.quota_type === 1) return 'teal';
  return 'white';
};

/**
 * 单个模型的计费与基础价格展示。
 * - 分级表达式（tiered_expr）复用 DynamicPricingBreakdown 做可读展示
 * - 其它计费模式展示基础价格（按 token 或按次，取可用分组中的最优倍率）
 */
const ModelPricingBreakdown = ({
  model,
  groupRatio = {},
  currency,
  siteDisplayType,
  tokenUnit,
  displayPrice,
  t,
}) => {
  if (!model) return null;

  const isDynamic =
    model.billing_mode === 'tiered_expr' && Boolean(model.billing_expr);

  const priceData = calculateModelPrice({
    record: model,
    selectedGroup: 'all',
    groupRatio,
    tokenUnit,
    displayPrice,
    currency,
    quotaDisplayType: siteDisplayType,
  });

  const priceItems = isDynamic
    ? []
    : getModelPriceItems(priceData, t, siteDisplayType);
  const priceHint = priceData.isTokensDisplay
    ? t('按倍率计费')
    : tokenUnit === 'K'
      ? t('价格按 1K Tokens 计')
      : t('价格按 1M Tokens 计');

  return (
    <div>
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='orange' className='mr-2 shadow-md'>
          <IconPriceTag size={16} />
        </Avatar>
        <div>
          <Text className='text-lg font-medium'>{t('计费与价格')}</Text>
          <div className='text-xs text-gray-600'>
            {t('模型的基础价格与计费模式')}
          </div>
        </div>
        <Tag
          color={getBillingModeColor(model)}
          size='small'
          shape='circle'
          className='ml-auto'
        >
          {getBillingModeLabel(model, t)}
        </Tag>
      </div>

      {isDynamic ? (
        <DynamicPricingBreakdown billingExpr={model.billing_expr} t={t} />
      ) : priceItems.length > 0 ? (
        <div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
            {priceItems.map((item) => (
              <div
                key={item.key}
                className='rounded-lg border p-3'
                style={{ borderColor: 'var(--semi-color-border)' }}
              >
                <div className='text-xs text-gray-600'>{item.label}</div>
                <div className='mt-1 font-semibold text-orange-600'>
                  {item.value}
                  {item.suffix && (
                    <span className='ml-1 text-xs font-normal text-gray-500'>
                      {item.suffix}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {priceData.isPerToken && !priceData.isTokensDisplay && (
            <div className='mt-2 text-xs text-gray-400'>{priceHint}</div>
          )}
        </div>
      ) : (
        <Text type='tertiary' size='small'>
          {t('暂无价格信息')}
        </Text>
      )}
    </div>
  );
};

export default ModelPricingBreakdown;
