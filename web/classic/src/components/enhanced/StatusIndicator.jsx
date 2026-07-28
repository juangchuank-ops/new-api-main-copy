/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { Tag } from '@douyinfe/semi-ui';
import {
  IconCheckCircle,
  IconStopCircle,
  IconAlertCircle,
  IconAlertTriangle,
  IconClock,
} from '@douyinfe/semi-icons';
import './StatusIndicator.css';

const STATUS_CONFIG = {
  active: {
    color: 'green',
    icon: IconCheckCircle,
    label: '启用',
  },
  inactive: {
    color: 'grey',
    icon: IconStopCircle,
    label: '禁用',
  },
  error: {
    color: 'red',
    icon: IconAlertCircle,
    label: '错误',
  },
  warning: {
    color: 'orange',
    icon: IconAlertTriangle,
    label: '警告',
  },
  pending: {
    color: 'blue',
    icon: IconClock,
    label: '等待中',
  },
  success: {
    color: 'green',
    icon: IconCheckCircle,
    label: '成功',
  },
};

/**
 * 统一的状态指示器组件
 * @param {Object} props
 * @param {string} props.status - 状态类型: active/inactive/error/warning/pending/success
 * @param {string} [props.label] - 自定义标签，覆盖默认文本
 * @param {string} [props.size='small'] - 尺寸: small/default/large
 * @param {boolean} [props.showIcon=true] - 是否显示图标
 * @param {string} [props.className] - 额外的类名
 */
const StatusIndicator = ({
  status = 'inactive',
  label,
  size = 'small',
  showIcon = true,
  className = '',
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.inactive;
  const Icon = config.icon;
  const displayLabel = label || config.label;

  return (
    <Tag
      color={config.color}
      size={size}
      className={`status-indicator ${className}`}
    >
      {showIcon && <Icon className="status-indicator-icon" />}
      <span className="status-indicator-text">{displayLabel}</span>
    </Tag>
  );
};

export default StatusIndicator;
