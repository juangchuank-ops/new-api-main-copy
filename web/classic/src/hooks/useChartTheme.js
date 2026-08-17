import { useActualTheme } from '../context/Theme';

/**
 * 返回当前应用实际生效的主题（light / dark），供 `<VChart>` 显式指定
 * `theme` 字段，避免依赖仅在 `useEffect` 中初始化的全局 `initVChartSemiTheme`
 * 而导致首次渲染时图表退回浅色（白底）主题。
 *
 * 调用方应像默认前端那样渲染：
 *   <VChart spec={{ ...spec, theme, background: { fill: 'transparent' } }} />
 */
export function useChartTheme() {
  const actualTheme = useActualTheme();
  return {
    theme: actualTheme === 'dark' ? 'dark' : 'light',
  };
}

