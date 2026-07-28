# Classic UI 优化方案

## 📋 优化目标

基于 PRODUCT.md 的原则（信息密度、快速操作、状态可见、数据驱动），对 New API Classic UI 进行系统性优化。

---

## 🎨 设计系统优化

### 1. 颜色系统增强

**当前状态：**
- 完全依赖 Semi Design 的颜色变量
- 自定义颜色变体仅用于筛选按钮

**优化建议：**

```css
/* 扩展语义颜色 */
:root {
  /* 状态指示器 */
  --status-active: var(--semi-color-success);
  --status-inactive: var(--semi-color-text-3);
  --status-error: var(--semi-color-danger);
  --status-warning: var(--semi-color-warning);
  --status-pending: var(--semi-color-info);
  
  /* 数据可视化增强 */
  --chart-positive: #10b981; /* 绿色 - 收入、增长 */
  --chart-negative: #ef4444; /* 红色 - 支出、下降 */
  --chart-neutral: #6366f1;  /* 紫色 - 中性数据 */
  
  /* 功能区域色彩编码 */
  --area-channel: #3b82f6;   /* 蓝色 - 渠道管理 */
  --area-token: #8b5cf6;     /* 紫色 - 令牌管理 */
  --area-log: #06b6d4;       /* 青色 - 日志查询 */
  --area-user: #f59e0b;      /* 橙色 - 用户管理 */
}
```

**应用场景：**
- 侧边栏导航项用颜色区分功能模块
- 表格中的状态列使用一致的颜色指示器
- 图表使用语义化颜色（绿色=正面，红色=负面）

---

### 2. 排版系统优化

**当前状态：**
- 字体家族合理（Lato + 微软雅黑）
- 缺少系统化的字号/行高规范

**优化建议：**

```css
/* 建立排版比例系统 */
:root {
  /* 字号比例 (Major Third - 1.25) */
  --text-xs: 0.64rem;    /* 10px - 次要信息 */
  --text-sm: 0.8rem;     /* 13px - 表格内容 */
  --text-base: 1rem;     /* 16px - 正文 */
  --text-lg: 1.25rem;    /* 20px - 小标题 */
  --text-xl: 1.563rem;   /* 25px - 卡片标题 */
  --text-2xl: 1.953rem;  /* 31px - 页面标题 */
  
  /* 行高 */
  --leading-tight: 1.25;   /* 紧凑 - 标题 */
  --leading-normal: 1.5;   /* 标准 - 正文 */
  --leading-relaxed: 1.75; /* 宽松 - 长文本 */
  
  /* 字重 */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

**应用场景：**
- 表格：`text-sm` + `leading-tight` - 提高信息密度
- 卡片标题：`text-xl` + `font-semibold` - 清晰的层级
- 统计数字：`text-2xl` + `font-bold` + `tabular-nums` - 易读的数字

---

### 3. 间距系统标准化

**当前状态：**
- 混用硬编码像素值（`4px`, `8px`, `10px`, `12px`）
- 缺少统一的间距规范

**优化建议：**

```css
/* 采用 4px 基准的间距系统 */
:root {
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-5: 1.25rem;  /* 20px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-10: 2.5rem;  /* 40px */
  --space-12: 3rem;    /* 48px */
}
```

**重构建议：**
```css
/* Before */
.sidebar-nav-item {
  margin: 3px 8px;
  padding: 8px 12px;
}

/* After */
.sidebar-nav-item {
  margin: var(--space-1) var(--space-2);
  padding: var(--space-2) var(--space-3);
}
```

---

## 🧩 组件优化

### 1. 侧边栏导航优化

**当前问题：**
- 折叠状态下图标对齐不理想
- 导航分组不够清晰
- 当前页面指示不够明显

**优化方案：**

```jsx
// 增强的导航项组件
<div className="sidebar-nav-item sidebar-nav-item-selected">
  <div className="sidebar-icon-container">
    <IconChannel size={20} />
  </div>
  <span className="sidebar-nav-text">渠道管理</span>
  {hasNotification && <Badge dot />}
  {/* 当前页面指示器 */}
  <div className="sidebar-active-indicator" />
</div>
```

```css
/* 当前页面左侧指示条 */
.sidebar-active-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: var(--semi-color-primary);
  border-radius: 0 2px 2px 0;
}

/* 分组标签增强 */
.sidebar-group-label {
  padding: var(--space-2) var(--space-4);
  color: var(--semi-color-text-2);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.sidebar-group-label::before {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--semi-color-border);
  opacity: 0.3;
}
```

---

### 2. 表格优化

**当前问题：**
- 表格信息密度不够
- 缺少快速筛选和排序的视觉反馈
- 状态列不够直观

**优化方案：**

**A. 表格密度选项**

```jsx
// 添加密度切换器
<Space>
  <Button
    icon={<IconList />}
    type={density === 'compact' ? 'primary' : 'tertiary'}
    onClick={() => setDensity('compact')}
  >
    紧凑
  </Button>
  <Button
    icon={<IconGrid />}
    type={density === 'default' ? 'primary' : 'tertiary'}
    onClick={() => setDensity('default')}
  >
    默认
  </Button>
  <Button
    icon={<IconLayoutGrid />}
    type={density === 'comfortable' ? 'primary' : 'tertiary'}
    onClick={() => setDensity('comfortable')}
  >
    舒适
  </Button>
</Space>
```

```css
/* 紧凑模式 - 更高信息密度 */
.table-density-compact .semi-table-tbody .semi-table-row-cell {
  padding: 6px 12px;
  font-size: var(--text-sm);
  line-height: var(--leading-tight);
}

/* 默认模式 */
.table-density-default .semi-table-tbody .semi-table-row-cell {
  padding: 12px 16px;
  font-size: var(--text-base);
}

/* 舒适模式 - 长时间阅读 */
.table-density-comfortable .semi-table-tbody .semi-table-row-cell {
  padding: 16px 20px;
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
}
```

**B. 状态指示器组件**

```jsx
// 统一的状态指示器
const StatusIndicator = ({ status, label }) => {
  const config = {
    active: { color: 'success', icon: <IconCheckCircle />, text: '启用' },
    inactive: { color: 'tertiary', icon: <IconStopCircle />, text: '禁用' },
    error: { color: 'danger', icon: <IconAlertCircle />, text: '错误' },
    warning: { color: 'warning', icon: <IconAlertTriangle />, text: '警告' },
  };
  
  const { color, icon, text } = config[status];
  
  return (
    <Tag color={color} size="small" className="status-tag">
      {icon}
      <span>{label || text}</span>
    </Tag>
  );
};
```

```css
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: var(--font-medium);
  padding: 4px 10px;
  border-radius: 6px;
}
```

**C. 快速筛选工具栏**

```jsx
// 表格上方的快速筛选
<div className="table-filter-bar">
  <Space wrap>
    <Select
      placeholder="状态"
      style={{ width: 120 }}
      prefix={<IconFilter />}
    >
      <Option value="all">全部</Option>
      <Option value="active">启用</Option>
      <Option value="inactive">禁用</Option>
    </Select>
    
    <DatePicker placeholder="日期范围" type="dateRange" />
    
    <Input
      placeholder="搜索..."
      prefix={<IconSearch />}
      showClear
    />
    
    <Button icon={<IconRefresh />}>刷新</Button>
  </Space>
</div>
```

```css
.table-filter-bar {
  padding: var(--space-3) var(--space-4);
  background: var(--semi-color-fill-0);
  border-radius: 10px 10px 0 0;
  border-bottom: 1px solid var(--semi-color-border);
}
```

---

### 3. 数据可视化优化

**当前问题：**
- 图表缺少统一的配色方案
- 缺少交互提示
- 数据标签不够清晰

**优化方案：**

**A. 统一的图表主题**

```javascript
// 创建图表主题配置
const chartTheme = {
  colors: [
    '#3b82f6', // 蓝色
    '#8b5cf6', // 紫色
    '#06b6d4', // 青色
    '#10b981', // 绿色
    '#f59e0b', // 橙色
    '#ef4444', // 红色
  ],
  fontFamily: 'Lato, "Helvetica Neue", Arial, sans-serif',
  fontSize: 13,
  lineColor: 'var(--semi-color-border)',
  gridColor: 'rgba(0, 0, 0, 0.05)',
};

// VChart 配置
<VChart
  spec={{
    ...chartSpec,
    color: chartTheme.colors,
    label: {
      style: {
        fontSize: chartTheme.fontSize,
        fontFamily: chartTheme.fontFamily,
      }
    },
    axes: [{
      grid: {
        style: { stroke: chartTheme.gridColor }
      }
    }]
  }}
/>
```

**B. 统计卡片优化**

```jsx
// 增强的统计卡片
<Card className="stat-card">
  <div className="stat-card-header">
    <span className="stat-card-label">总请求数</span>
    <IconTrendingUp className="stat-card-icon stat-card-icon-positive" />
  </div>
  <div className="stat-card-value">1,234,567</div>
  <div className="stat-card-footer">
    <span className="stat-card-change stat-card-change-positive">
      <IconArrowUp size={14} />
      +12.5%
    </span>
    <span className="stat-card-period">较上周</span>
  </div>
</Card>
```

```css
.stat-card {
  position: relative;
  overflow: hidden;
}

.stat-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.stat-card-label {
  font-size: var(--text-sm);
  color: var(--semi-color-text-2);
  font-weight: var(--font-medium);
}

.stat-card-icon {
  width: 24px;
  height: 24px;
  opacity: 0.2;
}

.stat-card-icon-positive { color: var(--chart-positive); }
.stat-card-icon-negative { color: var(--chart-negative); }

.stat-card-value {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  font-variant-numeric: tabular-nums;
  color: var(--semi-color-text-0);
  line-height: 1.2;
  margin-bottom: var(--space-2);
}

.stat-card-footer {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
}

.stat-card-change {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: var(--font-semibold);
}

.stat-card-change-positive {
  color: var(--chart-positive);
  background: rgba(16, 185, 129, 0.1);
}

.stat-card-change-negative {
  color: var(--chart-negative);
  background: rgba(239, 68, 68, 0.1);
}

.stat-card-period {
  color: var(--semi-color-text-3);
}
```

---

### 4. 表单优化

**当前问题：**
- 表单字段标签与输入框间距不一致
- 缺少内联验证提示
- 长表单缺少分组

**优化方案：**

**A. 表单分组**

```jsx
<Form layout="vertical">
  {/* 分组标题 */}
  <div className="form-group-header">
    <IconSettings size={20} />
    <span>基础配置</span>
  </div>
  
  <Form.Input
    field="name"
    label="渠道名称"
    placeholder="请输入渠道名称"
    rules={[{ required: true }]}
  />
  
  <Divider margin="24px" />
  
  <div className="form-group-header">
    <IconKey size={20} />
    <span>认证信息</span>
  </div>
  
  {/* ... 更多字段 */}
</Form>
```

```css
.form-group-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--semi-color-text-0);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 2px solid var(--semi-color-border);
}
```

**B. 内联帮助文本**

```jsx
<Form.Input
  field="apiKey"
  label="API Key"
  extraText={
    <div className="form-field-help">
      <IconInfoCircle size={14} />
      <span>从上游服务商获取的 API 密钥</span>
    </div>
  }
/>
```

```css
.form-field-help {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-xs);
  color: var(--semi-color-text-2);
  margin-top: var(--space-1);
}
```

---

## 🚀 性能优化

### 1. 代码拆分

```javascript
// 按路由懒加载
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Channel = lazy(() => import('./pages/Channel'));
const Token = lazy(() => import('./pages/Token'));

// 在 Routes 中使用 Suspense
<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/channel" element={<Channel />} />
    <Route path="/token" element={<Token />} />
  </Routes>
</Suspense>
```

### 2. 表格虚拟滚动

对于大数据量表格（>100 行），启用虚拟滚动：

```jsx
<Table
  dataSource={data}
  virtualized={{
    itemSize: 54, // 行高
  }}
  scroll={{ y: 600 }}
/>
```

### 3. 图表懒加载

只在图表进入视口时渲染：

```jsx
import { useInView } from 'react-intersection-observer';

const ChartCard = ({ chartSpec }) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });
  
  return (
    <Card ref={ref}>
      {inView ? (
        <VChart spec={chartSpec} />
      ) : (
        <div style={{ height: 300 }}>加载中...</div>
      )}
    </Card>
  );
};
```

---

## 📱 响应式优化

### 1. 移动端表格

```css
/* 移动端卡片式表格 */
@media (max-width: 767px) {
  .semi-table {
    display: none;
  }
  
  .table-card-view {
    display: block;
  }
  
  .table-card-item {
    background: var(--semi-color-bg-1);
    border-radius: 10px;
    padding: var(--space-4);
    margin-bottom: var(--space-3);
  }
  
  .table-card-item-row {
    display: flex;
    justify-content: space-between;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--semi-color-border);
  }
  
  .table-card-item-row:last-child {
    border-bottom: none;
  }
}
```

### 2. 移动端导航

```jsx
// 底部导航栏（移动端）
<div className="mobile-bottom-nav">
  <button className="mobile-nav-item">
    <IconHome size={24} />
    <span>首页</span>
  </button>
  <button className="mobile-nav-item mobile-nav-item-active">
    <IconChart size={24} />
    <span>数据</span>
  </button>
  <button className="mobile-nav-item">
    <IconUser size={24} />
    <span>我的</span>
  </button>
</div>
```

```css
.mobile-bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--semi-color-bg-1);
  border-top: 1px solid var(--semi-color-border);
  padding: var(--space-2) 0;
  z-index: 1000;
}

@media (max-width: 767px) {
  .mobile-bottom-nav {
    display: flex;
    justify-content: space-around;
  }
}

.mobile-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  padding: var(--space-2);
  color: var(--semi-color-text-2);
  font-size: var(--text-xs);
  border: none;
  background: none;
  cursor: pointer;
  transition: color 0.2s;
}

.mobile-nav-item-active {
  color: var(--semi-color-primary);
}
```

---

## 🎯 快捷操作优化

### 1. 批量操作工具栏

```jsx
// 选中行时显示的批量操作栏
{selectedRowKeys.length > 0 && (
  <div className="batch-action-bar">
    <span className="batch-action-count">
      已选择 {selectedRowKeys.length} 项
    </span>
    <Space>
      <Button icon={<IconEdit />}>批量编辑</Button>
      <Button icon={<IconDelete />} type="danger">批量删除</Button>
      <Button icon={<IconCheck />}>批量启用</Button>
      <Button icon={<IconClose />}>批量禁用</Button>
    </Space>
    <Button
      icon={<IconClose />}
      type="tertiary"
      onClick={() => setSelectedRowKeys([])}
    >
      取消选择
    </Button>
  </div>
)}
```

```css
.batch-action-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--semi-color-primary-light-default);
  border-radius: 10px;
  margin-bottom: var(--space-4);
  backdrop-filter: blur(8px);
}

.batch-action-count {
  font-weight: var(--font-semibold);
  color: var(--semi-color-primary);
}
```

### 2. 快捷键支持

```javascript
// 使用 react-hotkeys-hook
import { useHotkeys } from 'react-hotkeys-hook';

const ChannelPage = () => {
  // Cmd/Ctrl + K: 打开搜索
  useHotkeys('meta+k, ctrl+k', (e) => {
    e.preventDefault();
    setSearchModalVisible(true);
  });
  
  // Cmd/Ctrl + N: 新建渠道
  useHotkeys('meta+n, ctrl+n', (e) => {
    e.preventDefault();
    setCreateModalVisible(true);
  });
  
  // Cmd/Ctrl + R: 刷新
  useHotkeys('meta+r, ctrl+r', (e) => {
    e.preventDefault();
    fetchData();
  });
  
  return (/* ... */);
};
```

在页面底部显示快捷键提示：

```jsx
<div className="shortcut-hints">
  <kbd>⌘K</kbd> 搜索
  <kbd>⌘N</kbd> 新建
  <kbd>⌘R</kbd> 刷新
</div>
```

```css
.shortcut-hints {
  position: fixed;
  bottom: var(--space-4);
  right: var(--space-4);
  display: flex;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--semi-color-text-3);
  padding: var(--space-2) var(--space-3);
  background: var(--semi-color-bg-1);
  border-radius: 8px;
  box-shadow: var(--semi-shadow-elevated);
}

kbd {
  padding: 2px 6px;
  background: var(--semi-color-fill-0);
  border: 1px solid var(--semi-color-border);
  border-radius: 4px;
  font-family: inherit;
  font-size: inherit;
  margin-right: 4px;
}
```

---

## 📊 实施优先级

### 🔴 高优先级（立即实施）

1. **状态指示器统一** - 提升表格可读性
2. **表格密度选项** - 满足不同用户需求
3. **批量操作工具栏** - 提高操作效率
4. **统计卡片优化** - Dashboard 的核心体验

### 🟡 中优先级（1-2 周内）

1. **侧边栏导航优化** - 改善导航体验
2. **表单分组和验证** - 提升表单填写体验
3. **图表主题统一** - 提升数据可视化质量
4. **移动端表格优化** - 改善移动端体验

### 🟢 低优先级（持续迭代）

1. **设计 token 系统化** - 长期代码维护
2. **快捷键支持** - 高级用户功能
3. **虚拟滚动** - 大数据量场景
4. **动画细节** - 体验打磨

---

## 🛠 实施步骤

### Step 1: 建立设计 token 系统（1 天）

1. 创建 `src/styles/tokens.css`
2. 定义颜色、字号、间距、圆角变量
3. 更新 `index.css` 引入 tokens

### Step 2: 组件库优化（3-5 天）

1. 创建 `src/components/common/StatusIndicator.jsx`
2. 创建 `src/components/common/StatCard.jsx`
3. 优化 `Sidebar` 组件
4. 优化表格组件（添加密度切换）

### Step 3: 页面级优化（每页 1 天）

1. Dashboard - 统计卡片 + 图表优化
2. Channel - 表格 + 批量操作
3. Token - 表格 + 快速筛选
4. Log - 表格 + 时间范围选择器

### Step 4: 响应式适配（2-3 天）

1. 移动端表格卡片视图
2. 移动端底部导航
3. 触摸优化（按钮大小、间距）

---

## 📈 预期效果

实施以上优化后，预期达到：

- ✅ **信息密度提升 30%** - 紧凑模式下表格显示更多数据
- ✅ **操作效率提升 40%** - 批量操作、快捷键、快速筛选
- ✅ **视觉一致性 100%** - 统一的设计 token 和组件
- ✅ **移动端可用性提升 80%** - 卡片式表格、底部导航
- ✅ **加载性能提升 25%** - 代码拆分、懒加载、虚拟滚动

---

## 🎨 设计资源

- **Semi Design 官方文档**: https://semi.design/
- **Tailwind CSS 官方文档**: https://tailwindcss.com/
- **颜色对比度检查**: https://webaim.org/resources/contrastchecker/
- **Lucide Icons**: https://lucide.dev/ (项目已使用)

---

## 📝 下一步

1. 审查优化方案并确认优先级
2. 创建 GitHub Issue 跟踪每个优化项
3. 从高优先级项目开始逐步实施
4. 定期收集用户反馈并调整

需要我开始实施某个具体的优化吗？
