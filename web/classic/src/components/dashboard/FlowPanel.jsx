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

import React, { useMemo, useState } from 'react';
import { Select, RadioGroup, Radio, Tag, Spin, Empty } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { Eye, EyeOff, Layers } from 'lucide-react';
import VChartErrorBoundary from '../common/VChartErrorBoundary';
import { ensureVChartBrowserEnv } from '../../helpers/vchart-env';
import { useChartTheme } from '../../hooks/useChartTheme';
import { isRoot } from '../../helpers';
import { buildDashboardFlowData, buildFlowSankeySpec, getFlowStages } from '../../helpers/flow';
import { CHART_CONFIG } from '../../constants/dashboard.constants';

const METRIC_OPTIONS = [
  { value: 'quota', labelKey: '按额度' },
  { value: 'tokens', labelKey: '按 Token' },
  { value: 'requests', labelKey: '按请求数' },
];

const TOP_LIMIT_OPTIONS = [10, 20, 50, 100];

const OVERFLOW_OPTIONS = [
  { value: 'aggregate', labelKey: '合并为其他' },
  { value: 'hide', labelKey: '隐藏' },
];

const STAGE_LABEL_KEYS = {
  user: '用户',
  node: '节点',
  token: '令牌',
  group: '分组',
  model: '模型',
  channel: '渠道',
};

const OTHER_NODE_LABEL_KEYS = {
  user: '其他用户',
  node: '其他节点',
  token: '其他令牌',
  group: '其他分组',
  model: '其他模型',
  channel: '其他渠道',
};

const MIN_VISIBLE_STAGES = 2;

const formatFlowNumber = (value) =>
  Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const FlowPanel = ({ flowData, flowLoading, t }) => {
  // VChart browser env 必须在首次渲染 VChart 组件前注册
  ensureVChartBrowserEnv();
  const { theme } = useChartTheme();

  const [metric, setMetric] = useState('quota');
  const [topNodeLimit, setTopNodeLimit] = useState(50);
  const [overflowMode, setOverflowMode] = useState('aggregate');
  const [sensitiveVisible, setSensitiveVisible] = useState(true);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [visibleStages, setVisibleStages] = useState(null);

  // tab 仅管理员可见；root 额外获得节点/令牌维度
  const flowRole = isRoot() ? 'root' : 'admin';
  const allStages = useMemo(() => getFlowStages(flowRole), [flowRole]);
  const activeStages = useMemo(
    () =>
      visibleStages && visibleStages.length >= MIN_VISIBLE_STAGES
        ? visibleStages
        : allStages,
    [visibleStages, allStages],
  );

  const deletedTokenLabel = (tokenId) => t('已删除 ({{id}})', { id: tokenId });

  const { flow, hasData } = useMemo(() => {
    if (!Array.isArray(flowData) || flowData.length === 0) {
      return { flow: null, hasData: false };
    }
    const result = buildDashboardFlowData(flowData, metric, {
      role: flowRole,
      visibleStages: activeStages,
      topNodeLimit,
      overflowMode,
      maskSensitive: !sensitiveVisible,
      selectedNodes: selectedNodes.length > 0 ? selectedNodes : undefined,
      otherNodeLabel: (kind) => t(OTHER_NODE_LABEL_KEYS[kind] || kind),
      deletedTokenLabel,
    });
    return {
      flow: result.flow,
      hasData: result.flow.nodes.length > 0 && result.flow.links.length > 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    flowData,
    metric,
    flowRole,
    activeStages,
    topNodeLimit,
    overflowMode,
    sensitiveVisible,
    selectedNodes,
    t,
  ]);

  const spec = useMemo(
    () =>
      flow && hasData
        ? {
            ...buildFlowSankeySpec(flow, t('分流'), formatFlowNumber, {
              quota: t('额度'),
              tokens: t('Token'),
              requests: t('请求数'),
              share: t('占比'),
            }),
            theme,
            background: { fill: 'transparent' },
          }
        : null,
    [flow, hasData, theme, t],
  );

  const nodeFilterOptions = useMemo(() => {
    if (!Array.isArray(flowData) || flowData.length === 0) return [];
    const result = buildDashboardFlowData(flowData, metric, {
      role: flowRole,
      visibleStages: activeStages,
    });
    return result.filterOptions.nodes.map((option) => ({
      value: `${option.kind}\u0000${option.value}`,
      label: `[${t(STAGE_LABEL_KEYS[option.kind] || option.kind)}] ${option.label} (${option.valueLabel})`,
      raw: option,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowData, metric, flowRole, activeStages, t]);

  const handleNodeFilterChange = (values) => {
    setSelectedNodes(
      (values || [])
        .map((value) => {
          const separatorIndex = value.indexOf('\u0000');
          if (separatorIndex < 0) return null;
          return {
            kind: value.slice(0, separatorIndex),
            id: value.slice(separatorIndex + 1),
          };
        })
        .filter(Boolean),
    );
  };

  const toggleStage = (stage) => {
    const current =
      visibleStages && visibleStages.length >= MIN_VISIBLE_STAGES
        ? visibleStages
        : allStages;
    const isVisible = current.includes(stage);
    if (isVisible && current.length <= MIN_VISIBLE_STAGES) return;
    const next = isVisible
      ? current.filter((item) => item !== stage)
      : allStages.filter((item) => current.includes(item) || item === stage);
    setVisibleStages(next);
  };

  if (flowLoading) {
    return (
      <div className='flex items-center justify-center h-full'>
        <Spin size='large' />
      </div>
    );
  }

  if (!Array.isArray(flowData) || flowData.length === 0) {
    return (
      <div className='flex items-center justify-center h-full'>
        <Empty description={t('暂无分流数据')} />
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full gap-2'>
      <div className='flex flex-wrap items-center gap-x-4 gap-y-2 px-2 pt-1'>
        <div className='flex items-center gap-2'>
          <span className='text-xs text-semi-color-text-2'>
            {t('计量口径')}
          </span>
          <RadioGroup
            type='button'
            buttonSize='small'
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {METRIC_OPTIONS.map((option) => (
              <Radio key={option.value} value={option.value}>
                {t(option.labelKey)}
              </Radio>
            ))}
          </RadioGroup>
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-xs text-semi-color-text-2'>
            {t('显示数量')}
          </span>
          <Select
            size='small'
            style={{ width: 90 }}
            value={topNodeLimit}
            onChange={setTopNodeLimit}
          >
            {TOP_LIMIT_OPTIONS.map((count) => (
              <Select.Option key={count} value={count}>
                {t('前 {{count}}', { count })}
              </Select.Option>
            ))}
          </Select>
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-xs text-semi-color-text-2'>{t('超出项')}</span>
          <Select
            size='small'
            style={{ width: 110 }}
            value={overflowMode}
            onChange={setOverflowMode}
          >
            {OVERFLOW_OPTIONS.map((option) => (
              <Select.Option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </Select.Option>
            ))}
          </Select>
        </div>
        <div className='flex items-center gap-2 min-w-[220px]'>
          <span className='text-xs text-semi-color-text-2 whitespace-nowrap'>
            {t('节点筛选')}
          </span>
          <Select
            size='small'
            style={{ width: 260 }}
            multiple
            filter
            placeholder={t('全部节点')}
            value={selectedNodes.map(
              (node) => `${node.kind}\u0000${node.id}`,
            )}
            onChange={handleNodeFilterChange}
            emptyContent={t('无节点')}
          >
            {nodeFilterOptions.map((option) => (
              <Select.Option key={option.value} value={option.value}>
                {option.label}
              </Select.Option>
            ))}
          </Select>
        </div>
        <div
          className='flex items-center gap-1.5 cursor-pointer select-none'
          onClick={() => setSensitiveVisible((visible) => !visible)}
        >
          {sensitiveVisible ? (
            <Eye size={14} className='text-semi-color-text-2' />
          ) : (
            <EyeOff size={14} className='text-semi-color-text-2' />
          )}
          <span className='text-xs text-semi-color-text-2'>
            {sensitiveVisible ? t('隐藏敏感数据') : t('显示敏感数据')}
          </span>
        </div>
      </div>

      <div className='flex flex-wrap items-center gap-1.5 px-2'>
        <span className='flex items-center gap-1 text-xs text-semi-color-text-2'>
          <Layers size={12} />
          {t('显示或隐藏分流列')}
        </span>
        {allStages.map((stage) => {
          const isActive = activeStages.includes(stage);
          return (
            <Tag
              key={stage}
              size='small'
              type={isActive ? 'solid' : 'light'}
              color={isActive ? 'blue' : 'grey'}
              className='cursor-pointer'
              onClick={() => toggleStage(stage)}
            >
              {t(STAGE_LABEL_KEYS[stage] || stage)}
            </Tag>
          );
        })}
      </div>

      <div className='flex-1 min-h-0 p-1'>
        {spec ? (
          <VChartErrorBoundary>
            <VChart key={`flow-${theme}`} spec={spec} option={CHART_CONFIG} />
          </VChartErrorBoundary>
        ) : (
          <div className='flex items-center justify-center h-full'>
            <Empty description={t('暂无分流数据')} />
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowPanel;
