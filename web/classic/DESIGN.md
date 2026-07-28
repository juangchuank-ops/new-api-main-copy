# Design System

## 设计系统概述

Classic UI 基于 **Semi Design** 组件库 + **Tailwind CSS** 构建。Semi Design 提供了完整的组件和设计 tokens，Tailwind 用于布局和自定义样式。

## Colors

### Semi Design Color System

项目通过 CSS 变量使用 Semi Design 的颜色系统：

**语义颜色：**
- Primary: `var(--semi-color-primary)` - 主色（蓝色系）
- Success: `var(--semi-color-success)` - 成功状态（绿色）
- Warning: `var(--semi-color-warning)` - 警告状态（橙色）
- Danger: `var(--semi-color-danger)` - 危险状态（红色）
- Info: `var(--semi-color-info)` - 信息状态（蓝色）

**背景色：**
- `--semi-color-bg-0` - 主背景
- `--semi-color-bg-1` - 次级背景
- `--semi-color-bg-2` - 三级背景
- `--semi-color-bg-3` - 四级背景
- `--semi-color-bg-4` - 五级背景

**填充色：**
- `--semi-color-fill-0` - 一级填充
- `--semi-color-fill-1` - 二级填充
- `--semi-color-fill-2` - 三级填充

**文本色：**
- `--semi-color-text-0` - 主文本（最深）
- `--semi-color-text-1` - 次级文本
- `--semi-color-text-2` - 三级文本
- `--semi-color-text-3` - 四级文本（最浅）

**边框色：**
- `--semi-color-border` - 标准边框色

### 自定义颜色变体（用于筛选按钮组）

**Light Mode:**
- Violet: `#6d28d9` (紫罗兰)
- Teal: `#0f766e` (青色)
- Amber: `#b45309` (琥珀色)
- Rose: `#be123c` (玫瑰红)
- Green: `#047857` (绿色)

**Dark Mode:**
- Violet: `#a78bfa`
- Teal: `#2dd4bf`
- Amber: `#fbbf24`
- Rose: `#fb7185`
- Green: `#34d399`

### 数据可视化颜色

Semi Design 提供了 20 个数据颜色：
- `--semi-color-data-0` 到 `--semi-color-data-19`

用于图表、统计卡片的颜色区分。

## Typography

### 字体家族

**主字体栈：**
```css
font-family: Lato, 'Helvetica Neue', Arial, Helvetica, 'Microsoft YaHei', sans-serif;
```

**代码字体栈：**
```css
font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace;
```

### 字体大小

Semi Design 提供标准字号体系（通过变量引用）：
- 默认正文：14px
- 小号文本：12px
- 大号标题：16px, 18px, 20px

## Spacing

### 布局间距

**侧边栏：**
- 展开宽度：`--sidebar-width: 180px`
- 折叠宽度：`--sidebar-width-collapsed: 60px`
- 当前宽度：`--sidebar-current-width`（动态切换）

**导航项间距：**
- `margin-bottom: 4px`
- `padding: 4px 12px`（导航项）
- `padding: 8px 12px`（自定义导航项）

**卡片内边距：**
- Header & Body: `padding: 10px`

## Border Radius

### 统一圆角

所有交互组件使用 `10px` 圆角：
```css
.semi-radio,
.semi-input-wrapper,
.semi-button,
.semi-select,
.semi-tabs-tab-button {
  border-radius: 10px !important;
}
```

### Semi Design 圆角变量

- `--semi-border-radius-extra-small`
- `--semi-border-radius-small`
- `--semi-border-radius-medium`
- `--semi-border-radius-large`
- `--semi-border-radius-circle`
- `--semi-border-radius-full`

## Layout

### 主布局结构

**固定布局（带侧边栏）：**
- 顶部导航栏：`height: 64px`
- 侧边栏：`height: calc(100vh - 64px)`
- 内容区：响应式填充

**响应式断点：**
- 移动端：`max-width: 767px`

### 视口单位

使用 `dvh`（动态视口高度）适配移动端浏览器：
```css
height: 100vh;
height: 100dvh; /* 备用 */
```

## Scrollbars

### 自定义滚动条样式

**表格滚动条：**
```css
width: 6px;
height: 6px;
background: rgba(var(--semi-grey-2), 0.3);
border-radius: 2px;
```

**隐藏滚动条（布局区域）：**
- `.scrollbar-hide` - 工具类
- 侧边栏、聊天区、内容区默认隐藏滚动条

## Components

### Sidebar（侧边栏）

**导航项样式：**
```css
.sidebar-nav-item {
  border-radius: 6px;
  margin: 3px 8px;
  padding: 8px 12px;
  transition: all 0.15s ease;
}

.sidebar-nav-item:hover {
  background-color: rgba(var(--semi-blue-0), 0.08);
  color: var(--semi-color-primary);
}

.sidebar-nav-item-selected {
  background-color: rgba(var(--semi-blue-0), 0.12);
  color: var(--semi-color-primary);
  font-weight: 500;
}
```

**图标容器：**
- 主图标：`22x22px`
- 子图标：`18x18px`
- 右侧间距：`10px`

**折叠按钮：**
- 固定在底部（`position: sticky; bottom: 0`）
- 带模糊背景：`backdrop-filter: blur(4px)`
- 顶部渐变阴影：`box-shadow: 0 -10px 10px -5px`

### Cards（卡片）

**基础样式：**
- Header & Body 内边距：`10px`
- 支持马卡龙模糊球背景（`.with-pastel-balls`）

**马卡龙模糊球（装饰性背景）：**
```css
.with-pastel-balls::before {
  background: radial-gradient(...);
  filter: blur(60px);
  opacity: 0.55; /* Light */
  opacity: 0.36; /* Dark */
}
```

颜色：粉色 `#ffd1dc`、薰衣草 `#e5d4ff`、薄荷 `#d1fff6`、桃色 `#ffe5d9`

### Buttons（按钮）

**可选按钮组（SelectableButtonGroup）：**

带计数 badge 的筛选按钮：
```css
.sbg-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  background-color: var(--semi-color-fill-0);
}

.sbg-badge-active {
  background-color: var(--semi-color-primary-light-active);
  color: var(--semi-color-primary);
}
```

支持颜色变体：`violet`, `teal`, `amber`, `rose`, `green`

### Tables（表格）

**表格卡片滚动：**
```css
.table-scroll-card {
  height: calc(100vh - 110px);
  max-height: calc(100vh - 110px);
}

.table-scroll-card .semi-card-body {
  flex: 1 1 auto;
  overflow-y: auto;
}
```

移动端：`height: calc(100vh - 77px)`

### Tabs（标签页）

**内容区域：**
```css
.semi-tabs-content {
  padding: 0 !important;
  height: calc(100% - 40px) !important;
  flex: 1 !important;
}
```

每个 tab pane 占满高度，避免内容溢出。

## Visual Effects

### Animations

**侧边栏滑入：**
```css
@keyframes slideInLeft {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

**未读通知闪光：**
```css
@keyframes sweep-shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.shine-text {
  background: linear-gradient(...);
  animation: sweep-shine 4s linear infinite;
}
```

### Blur Effects

**Banner 模糊球：**
- Indigo: `#6366f1`, `opacity: 0.5`（Dark）/ `0.25`（Light）
- Teal: `#14b8a6`, `opacity: 0.4`（Dark）/ `0.2`（Light）
- Filter: `blur(120px)`

## Accessibility

### 对比度

- 文本层级清晰（`text-0` 到 `text-3` 四级）
- 边框、填充色透明度合理
- 深色模式下保持可读性

### 交互反馈

- Hover 状态：`transition: all 0.15s ease`
- Focus 状态：`--semi-color-focus-border`
- Disabled 状态：`--semi-color-disabled-text/bg/border`

### 键盘导航

- 表格支持键盘导航
- 导航项使用语义化标签（`<a>`, `<li>`）
- Focus 环清晰可见

## Dark Mode

通过 `html.dark` 类切换：
```css
html.dark .some-element {
  /* 深色模式样式 */
}
```

Semi Design 的颜色变量自动适配深色模式。

## Mobile Responsiveness

**断点：**
```css
@media (max-width: 767px) {
  /* 移动端样式 */
}
```

**适配：**
- 侧边栏背景色调整（`bg-1` 替代 `bg-0`）
- 输入框后缀文本缩小（`font-size: 11px`, `max-width: 80px`）
- 表格卡片高度调整（`calc(100vh - 77px)`）
- 定价页面使用移动端专用容器（`.pricing-content-mobile`）
