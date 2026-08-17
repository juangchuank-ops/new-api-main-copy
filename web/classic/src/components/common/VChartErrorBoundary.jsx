import React, { Component } from 'react';

/**
 * VChart 的 createCanvas 在特定条件下会因 envContribution 未注册而抛出
 * TypeError: Cannot read properties of undefined (reading 'createCanvas')
 * 该组件作为局部错误边界防止单个图表崩溃导致整个 Dashboard 白屏。
 */
class VChartErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[VChartErrorBoundary]', error?.message || error);
  }

  render() {
    if (this.state.hasError) {
      // 图表渲染失败时显示空占位，不影响页面其他部分
      return this.props.fallback || <div />;
    }
    return this.props.children;
  }
}

export default VChartErrorBoundary;
