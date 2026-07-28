import { registerBrowserEnv } from '@visactor/vchart';

/**
 * 确保 VChart 的 browser env contribution 已注册到 DI 容器。
 *
 * 根因: VChart 初始化内部调用 registerBrowserEnv()，即 loadBrowserEnv(container)，
 * 该函数使用模块级 __loaded 标记防止重复注册。在 React StrictMode（开发模式）
 * 的 double-invoke effects 场景下，或在 bundle splitting 导致多次实例化时，
 * __loaded 标记可能为 true 但实际 DI 绑定未生效，导致 VChart 构造函数中
 * application.global.envContribution 为 undefined，
 * 触发 TypeError: Cannot read properties of undefined (reading 'createCanvas')。
 *
 * 修复: 在模块首次被 import 时立即执行 registerBrowserEnv()，而不是延迟到
 * 组件渲染阶段调用。这确保 DI 绑定在任何 React 组件树 mount 之前完成，
 * 避免渲染时序竞争。
 *
 * loadBrowserEnv.__loaded 标记保证调用是幂等的。
 */

// 模块级副作用：在 import 时立即注册 browser env
registerBrowserEnv();

export function ensureVChartBrowserEnv() {
  // 保留函数以保持向后兼容，但实际注册已在模块 import 时完成
  // loadBrowserEnv.__loaded 标记保证幂等
  registerBrowserEnv();
}
