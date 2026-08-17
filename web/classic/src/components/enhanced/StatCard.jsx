/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { Card } from '@douyinfe/semi-ui';
import { IconArrowUp, IconArrowDown } from '@douyinfe/semi-icons';
import './StatCard.css';

/**
 * 增强的统计卡片组件
 * @param {Object} props
 * @param {string} props.label - 统计标签
 * @param {string|number} props.value - 统计值
 * @param {React.ReactNode} props.icon - 图标组件
 * @param {Object} [props.change] - 变化数据
 * @param {number} props.change.value - 变化百分比
 * @param {string} [props.change.period='较上周'] - 对比周期
 * @param {'positive'|'negative'|'neutral'} [props.trend='neutral'] - 趋势类型
 * @param {string} [props.className] - 额外的类名
 */
const StatCard = ({
  label,
  value,
  icon: Icon,
  change,
  trend = 'neutral',
  className = '',
}) => {
  const trendClass = trend === 'positive' 
    ? 'stat-card-icon-positive' 
    : trend === 'negative' 
    ? 'stat-card-icon-negative' 
    : 'stat-card-icon-neutral';

  const changeTrendClass = change?.value >= 0
    ? 'stat-card-change-positive'
    : 'stat-card-change-negative';

  return (
    <Card className={`stat-card ${className}`}>
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        {Icon && <Icon className={`stat-card-icon ${trendClass}`} />}
      </div>
      
      <div className="stat-card-value">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      
      {change && (
        <div className="stat-card-footer">
          <span className={`stat-card-change ${changeTrendClass}`}>
            {change.value >= 0 ? (
              <IconArrowUp size={14} />
            ) : (
              <IconArrowDown size={14} />
            )}
            {Math.abs(change.value)}%
          </span>
          <span className="stat-card-period">{change.period || '较上周'}</span>
        </div>
      )}
    </Card>
  );
};

export default StatCard;
