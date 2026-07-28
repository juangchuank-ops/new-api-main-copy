# 增强组件使用指南

## 📚 概述

本指南展示如何使用新创建的增强组件来优化 Classic UI 的界面体验。

---

## 🎨 可用组件

### 1. StatusIndicator - 状态指示器

统一的状态显示组件，用于表格、卡片中的状态展示。

#### 使用方法

```jsx
import { StatusIndicator } from '../components/enhanced';

// 基础用法
<StatusIndicator status="active" />
<StatusIndicator status="inactive" />
<StatusIndicator status="error" />
<StatusIndicator status="warning" />
<StatusIndicator status="pending" />

// 自定义标签
<StatusIndicator status="active" label="运行中" />

// 不显示图标
<StatusIndicator status="active" showIcon={false} />

// 不同尺寸
<StatusIndicator status="active" size="small" />
<StatusIndicator status="active" size="default" />
<StatusIndicator status="active" size="large" />
```

#### 在表格中使用

```jsx
const columns = [
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status) => <StatusIndicator status={status} />,
  },
  // ... 其他列
];
```

---

### 2. StatCard - 统计卡片

增强的统计卡片，支持趋势显示和变化百分比。

#### 使用方法

```jsx
import { StatCard } from '../components/enhanced';
import { IconActivity } from '@douyinfe/semi-icons';

// 基础用法
<StatCard
  label="总请求数"
  value={123456}
  icon={IconActivity}
/>

// 带趋势和变化
<StatCard
  label="总请求数"
  value={123456}
  icon={IconActivity}
  trend="positive"  // positive/negative/neutral
  change={{
    value: 12.5,  // 百分比
    period: '较上周',
  }}
/>

// 字符串值
<StatCard
  label="响应时间"
  value="245ms"
  icon={IconClock}
  trend="negative"
  change={{
    value: -5.2,
    period: '较昨日',
  }}
/>
```

#### Dashboard 集成示例

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <StatCard
    label="总请求数"
    value={stats.totalRequests}
    icon={IconActivity}
    trend="positive"
    change={{ value: 12.5, period: '较上周' }}
  />
  
  <StatCard
    label="活跃用户"
    value={stats.activeUsers}
    icon={IconUser}
    trend="positive"
    change={{ value: 8.3, period: '较上周' }}
  />
  
  <StatCard
    label="当前余额"
    value={`$${stats.balance.toFixed(2)}`}
    icon={IconDollar}
    trend="neutral"
  />
  
  <StatCard
    label="响应时间"
    value={`${stats.avgResponseTime}ms`}
    icon={IconClock}
    trend="negative"
    change={{ value: -5.2, period: '较上周' }}
  />
</div>
```

---

### 3. TableDensitySwitcher - 表格密度切换器

允许用户在紧凑、默认、舒适三种表格密度之间切换。

#### 使用方法

```jsx
import { TableDensitySwitcher } from '../components/enhanced';

const [density, setDensity] = useState('default');

<TableDensitySwitcher 
  density={density} 
  onChange={setDensity} 
/>

// 将密度应用到表格容器
<div className={`table-density-${density}`}>
  <Table {...props} />
</div>
```

#### 完整示例

```jsx
const ChannelPage = () => {
  const [density, setDensity] = useState(
    localStorage.getItem('table-density') || 'default'
  );

  useEffect(() => {
    localStorage.setItem('table-density', density);
  }, [density]);

  return (
    <div>
      {/* 工具栏 */}
      <div className="flex justify-between mb-4">
        <Space>
          <Input prefix={<IconSearch />} placeholder="搜索..." />
          <Button icon={<IconRefresh />}>刷新</Button>
        </Space>
        
        <TableDensitySwitcher density={density} onChange={setDensity} />
      </div>

      {/* 表格 */}
      <div className={`table-density-${density}`}>
        <Table dataSource={data} columns={columns} />
      </div>
    </div>
  );
};
```

---

### 4. BatchActionBar - 批量操作工具栏

在选中表格行时显示批量操作按钮。

#### 使用方法

```jsx
import { BatchActionBar } from '../components/enhanced';
import { IconEdit, IconDelete, IconCheck } from '@douyinfe/semi-icons';

const [selectedRowKeys, setSelectedRowKeys] = useState([]);

const batchActions = [
  {
    label: '批量编辑',
    icon: <IconEdit />,
    onClick: () => handleBatchEdit(selectedRowKeys),
  },
  {
    label: '批量删除',
    icon: <IconDelete />,
    type: 'danger',
    onClick: () => handleBatchDelete(selectedRowKeys),
  },
  {
    label: '批量启用',
    icon: <IconCheck />,
    onClick: () => handleBatchEnable(selectedRowKeys),
  },
];

<BatchActionBar
  selectedCount={selectedRowKeys.length}
  onClear={() => setSelectedRowKeys([])}
  actions={batchActions}
/>
```

#### 完整集成示例

```jsx
const TokenPage = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const handleBatchDelete = async (keys) => {
    try {
      await API.post('/api/token/batch-delete', { ids: keys });
      Toast.success('删除成功');
      setSelectedRowKeys([]);
      fetchData();
    } catch (error) {
      Toast.error('删除失败');
    }
  };

  const batchActions = [
    {
      label: '批量删除',
      icon: <IconDelete />,
      type: 'danger',
      onClick: handleBatchDelete,
    },
    {
      label: '批量启用',
      icon: <IconCheck />,
      onClick: (keys) => handleBatchUpdateStatus(keys, true),
    },
    {
      label: '批量禁用',
      icon: <IconClose />,
      onClick: (keys) => handleBatchUpdateStatus(keys, false),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  return (
    <div>
      <BatchActionBar
        selectedCount={selectedRowKeys.length}
        onClear={() => setSelectedRowKeys([])}
        actions={batchActions}
      />

      <Table
        dataSource={tokens}
        columns={columns}
        rowSelection={rowSelection}
      />
    </div>
  );
};
```

---

## 🎯 实施建议

### 优先级 1：高频使用页面

立即在以下页面应用增强组件：

1. **Dashboard (数据看板)**
   - 使用 `StatCard` 替换现有统计卡片
   - 统一数据展示风格

2. **Channel (渠道管理)**
   - 添加 `TableDensitySwitcher`
   - 添加 `BatchActionBar`
   - 状态列使用 `StatusIndicator`

3. **Token (令牌管理)**
   - 添加 `TableDensitySwitcher`
   - 添加 `BatchActionBar`
   - 状态列使用 `StatusIndicator`

4. **Log (使用日志)**
   - 添加 `TableDensitySwitcher`
   - 状态列使用 `StatusIndicator`

### 优先级 2：管理页面

1. **User (用户管理)**
   - 批量操作（启用/禁用/删除）
   - 状态指示器

2. **Setting (系统设置)**
   - 状态指示器统一

### 实施步骤

```bash
# 1. 更新 Channel 页面
1. 导入增强组件
2. 添加 density state 和 TableDensitySwitcher
3. 添加 selectedRowKeys state 和 BatchActionBar
4. 在状态列使用 StatusIndicator
5. 测试功能

# 2. 更新 Token 页面
# 同上

# 3. 更新 Dashboard 页面
1. 导入 StatCard
2. 替换现有统计卡片
3. 添加趋势和变化数据
4. 测试显示效果
```

---

## 🎨 设计 Token 使用

新组件已经使用 `tokens.css` 中定义的设计变量：

```css
/* 间距 */
padding: var(--space-3);
gap: var(--space-4);

/* 字号 */
font-size: var(--text-sm);
font-size: var(--text-2xl);

/* 圆角 */
border-radius: var(--radius-md);
border-radius: var(--radius-xl);

/* 字重 */
font-weight: var(--font-medium);
font-weight: var(--font-bold);

/* 过渡 */
transition: all var(--transition-fast);
```

### 在自定义样式中使用 Token

```css
.my-custom-component {
  padding: var(--space-4);
  margin-bottom: var(--space-3);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
}

.my-custom-component:hover {
  box-shadow: var(--shadow-lg);
}
```

---

## 📱 响应式支持

所有增强组件都内置了移动端适配：

- `StatCard` - 在小屏幕上自适应宽度
- `BatchActionBar` - 移动端自动换行
- `TableDensitySwitcher` - 移动端保持可用性

---

## 🔧 扩展建议

### 添加新的状态类型

```jsx
// 在 StatusIndicator.jsx 中添加
const STATUS_CONFIG = {
  // ... 现有状态
  custom: {
    color: 'purple',
    icon: IconCustom,
    label: '自定义状态',
  },
};
```

### 添加新的统计卡片样式

```css
/* 在 StatCard.css 中添加 */
.stat-card-large {
  padding: var(--space-6);
}

.stat-card-large .stat-card-value {
  font-size: var(--text-3xl);
}
```

---

## ✅ 检查清单

实施后检查：

- [ ] 所有状态显示使用 StatusIndicator
- [ ] Dashboard 使用 StatCard
- [ ] 主要表格页面添加 TableDensitySwitcher
- [ ] 需要批量操作的页面添加 BatchActionBar
- [ ] 组件在浅色/深色模式下都正常显示
- [ ] 移动端显示正常
- [ ] 表格密度切换正常工作
- [ ] 批量操作功能正常

---

## 🐛 常见问题

### Q: 状态指示器颜色不显示？
A: 确保已导入组件的 CSS 文件。Semi Design 的颜色需要正确加载。

### Q: 表格密度切换不生效？
A: 确保在表格外层容器添加了 `table-density-${density}` 类名。

### Q: BatchActionBar 不显示？
A: 检查 `selectedCount` 是否大于 0，组件只在有选中项时显示。

---

## 📞 需要帮助？

查看示例文件：
- `src/components/examples/EnhancedStatsExample.jsx`
- `src/components/examples/EnhancedTableExample.jsx`
