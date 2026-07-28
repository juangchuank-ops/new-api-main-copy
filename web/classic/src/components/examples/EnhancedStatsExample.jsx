/*
Copyright (C) 2025 QuantumNous

Enhanced Stats Cards Example - 展示如何使用新的 StatCard 组件
这是一个示例文件，展示优化后的统计卡片用法
*/

import React from 'react';
import { StatCard } from '../enhanced';
import {
  IconActivity,
  IconUser,
  IconDollar,
  IconClock,
} from '@douyinfe/semi-icons';

/**
 * 使用新 StatCard 组件的示例
 * 可以替换 StatsCards.jsx 中的旧实现
 */
const EnhancedStatsExample = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <StatCard
        label="总请求数"
        value={stats.totalRequests || 0}
        icon={IconActivity}
        trend="positive"
        change={{
          value: 12.5,
          period: '较上周',
        }}
      />

      <StatCard
        label="活跃用户"
        value={stats.activeUsers || 0}
        icon={IconUser}
        trend="positive"
        change={{
          value: 8.3,
          period: '较上周',
        }}
      />

      <StatCard
        label="当前余额"
        value={`$${(stats.balance || 0).toFixed(2)}`}
        icon={IconDollar}
        trend="neutral"
      />

      <StatCard
        label="响应时间"
        value={`${stats.avgResponseTime || 0}ms`}
        icon={IconClock}
        trend="negative"
        change={{
          value: -5.2,
          period: '较上周',
        }}
      />
    </div>
  );
};

export default EnhancedStatsExample;
