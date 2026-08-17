/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { Button, Space, Tooltip } from '@douyinfe/semi-ui';
import {
  IconList,
  IconGridView,
  IconListView,
} from '@douyinfe/semi-icons';
import './TableToolbar.css';

/**
 * 表格密度切换器
 * @param {Object} props
 * @param {'compact'|'default'|'comfortable'} props.density - 当前密度
 * @param {Function} props.onChange - 密度变化回调
 */
export const TableDensitySwitcher = ({ density = 'default', onChange }) => {
  const options = [
    { value: 'compact', icon: IconList, tooltip: '紧凑模式 - 显示更多数据' },
    { value: 'default', icon: IconGridView, tooltip: '默认模式' },
    { value: 'comfortable', icon: IconListView, tooltip: '舒适模式 - 长时间阅读' },
  ];

  return (
    <Space spacing={4}>
      {options.map(({ value, icon: Icon, tooltip }) => (
        <Tooltip key={value} content={tooltip}>
          <Button
            icon={<Icon />}
            type={density === value ? 'primary' : 'tertiary'}
            size="small"
            onClick={() => onChange(value)}
          />
        </Tooltip>
      ))}
    </Space>
  );
};

/**
 * 批量操作工具栏
 * @param {Object} props
 * @param {number} props.selectedCount - 选中数量
 * @param {Function} props.onClear - 清除选择回调
 * @param {Array} props.actions - 操作按钮配置 [{label, icon, onClick, type}]
 */
export const BatchActionBar = ({ selectedCount, onClear, actions = [] }) => {
  if (selectedCount === 0) return null;

  return (
    <div className="batch-action-bar">
      <span className="batch-action-count">
        已选择 {selectedCount} 项
      </span>
      
      <Space className="batch-action-buttons">
        {actions.map((action, index) => (
          <Button
            key={index}
            icon={action.icon}
            type={action.type || 'tertiary'}
            size="small"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
      </Space>
      
      <Button
        type="tertiary"
        size="small"
        onClick={onClear}
        className="batch-action-clear"
      >
        取消选择
      </Button>
    </div>
  );
};
