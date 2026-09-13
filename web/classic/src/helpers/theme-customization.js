/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/**
 * classic 主题定制：预设主色表、颜色派生与 Semi 变量应用。
 *
 * 只移植主色（accent）部分：classic 的品牌色完全来自 Semi CSS 变量，
 * 因此在 body 上覆盖 --semi-color-primary 系列即可全局生效，
 * 中性背景（bg/border/text 等）保持 classic 现状不变。
 */

// 与后端 setting.theme_setting.go 的 preset 白名单保持一致
export const DEFAULT_THEME_PRESET = 'default';
export const CUSTOM_THEME_PRESET = 'custom';
// 与后端 DefaultThemeSettings.CustomColor 保持一致
export const DEFAULT_CUSTOM_THEME_COLOR = '#6366f1';

// preset 主色（oklch → sRGB 已换算完毕，直接使用）
export const THEME_PRESETS = [
  { value: 'default', label: '默认', light: '#3ea4ec', dark: '#0e72bc' },
  { value: 'anthropic', label: 'Anthropic', light: '#e37756', dark: '#eb8561' },
  {
    value: 'simple-large',
    label: '简约大字号',
    light: '#1b1b1b',
    dark: '#ebebeb',
  },
  { value: 'underground', label: '地下', light: '#49785b', dark: '#58946d' },
  { value: 'rose-garden', label: '玫瑰园', light: '#e60053', dark: '#fb2f6c' },
  { value: 'lake-view', label: '湖景', light: '#00d492', dark: '#00d492' },
  { value: 'sunset-glow', label: '日落余晖', light: '#cb3435', dark: '#e55354' },
  {
    value: 'forest-whisper',
    label: '森林私语',
    light: '#007f70',
    dark: '#009883',
  },
  {
    value: 'ocean-breeze',
    label: '海洋微风',
    light: '#2563eb',
    dark: '#3b82f6',
  },
  {
    value: 'lavender-dream',
    label: '薰衣草之梦',
    light: '#9453c9',
    dark: '#a76ad9',
  },
];

// preset 次要色（对应 A 版 theme-presets.css 的 --secondary，oklch → sRGB）。
// default 与 custom 不列出：前者保持 Semi 原生次要色，后者只由用户主色驱动。
const PRESET_SECONDARY = {
  anthropic: { light: '#e8e6e0', dark: '#312f2d' },
  'simple-large': { light: '#e8e8e8', dark: '#313131' },
  underground: { light: '#99658c', dark: '#b47fa8' },
  'rose-garden': { light: '#ffa3b7', dark: '#ffa3b7' },
  'lake-view': { light: '#138187', dark: '#138187' },
  'sunset-glow': { light: '#ffa07a', dark: '#ffa07a' },
  'forest-whisper': { light: '#546c86', dark: '#7a95ae' },
  'ocean-breeze': { light: '#6366f1', dark: '#6366f1' },
  'lavender-dream': { light: '#94cdd1', dark: '#94cdd1' },
};

// preset 为 default 且无自定义色时必须清空这些变量，避免污染 Semi 原生主题
export const ACCENT_CSS_VARIABLES = [
  '--semi-color-primary',
  '--semi-color-primary-hover',
  '--semi-color-primary-active',
  '--semi-color-primary-light-default',
  '--semi-color-primary-light-hover',
  '--semi-color-primary-light-active',
  '--semi-color-link',
  '--semi-color-link-hover',
  '--semi-color-link-active',
  '--semi-color-focus-border',
];

export const SECONDARY_CSS_VARIABLES = [
  '--semi-color-secondary',
  '--semi-color-secondary-hover',
  '--semi-color-secondary-active',
  '--semi-color-secondary-light-default',
  '--semi-color-secondary-light-hover',
  '--semi-color-secondary-light-active',
];

const SHORT_HEX_PATTERN = /^#([\da-f]{3})$/;
const FULL_HEX_PATTERN = /^#([\da-f]{6})$/;

/**
 * 归一化用户/历史存储的明暗模式。
 * 历史版本可能把布尔语义写成 'true'/'false'（true 表示深色），
 * 归一化结果只可能是 light/dark/auto，异常值回退 auto。
 */
export function normalizeThemeMode(value) {
  if (typeof value === 'boolean') {
    return value ? 'dark' : 'light';
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'light' || normalized === 'dark' || normalized === 'auto') {
      return normalized;
    }
    if (normalized === 'true') return 'dark';
    if (normalized === 'false') return 'light';
  }
  return 'auto';
}

// 全局默认使用 system，classic 沿用既有 auto 语义
export function normalizeGlobalThemeMode(mode) {
  if (mode === 'light' || mode === 'dark') return mode;
  return 'auto';
}

/**
 * 只接受 #rgb / #rrggbb（大小写不敏感），统一输出小写 6 位十六进制；
 * 其它输入返回 null，避免任意字符串进入内联样式。
 */
export function normalizeCustomColor(value) {
  if (typeof value !== 'string') return null;
  const color = value.trim().toLowerCase();
  const shortMatch = color.match(SHORT_HEX_PATTERN);
  if (shortMatch) {
    const channels = shortMatch[1];
    return `#${channels[0].repeat(2)}${channels[1].repeat(2)}${channels[2].repeat(2)}`;
  }
  return FULL_HEX_PATTERN.test(color) ? color : null;
}

/**
 * 解析当前生效的主色 HEX：
 * - preset=custom：使用自定义色（非法时用后端默认自定义色）
 * - 命名 preset：按明暗取表内主色
 * - default / 未知 preset：返回 null，表示需要清空变量、回到 Semi 原生主题
 */
export function resolveAccentColor(preset, customColor, isDark) {
  if (preset === CUSTOM_THEME_PRESET) {
    return normalizeCustomColor(customColor) ?? DEFAULT_CUSTOM_THEME_COLOR;
  }
  const entry = THEME_PRESETS.find((item) => item.value === preset);
  if (!entry || entry.value === DEFAULT_THEME_PRESET) return null;
  return isDark ? entry.dark : entry.light;
}

/**
 * preset 次要色：default 与 custom 返回 null，表示清除覆盖、回到 Semi 原生次要色。
 */
export function resolveSecondaryColor(preset, isDark) {
  const entry = PRESET_SECONDARY[preset];
  if (!entry) return null;
  return isDark ? entry.dark : entry.light;
}

// 对 sRGB 分量做线性混色：from 向 to 混入 weight（0~1）
function mixHexColors(from, to, weight) {
  const readChannel = (hex, offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16);
  const mixChannel = (offset) =>
    Math.round(
      readChannel(from, offset) * (1 - weight) + readChannel(to, offset) * weight,
    )
      .toString(16)
      .padStart(2, '0');
  return `#${mixChannel(1)}${mixChannel(3)}${mixChannel(5)}`;
}

// 8 位十六进制（#rrggbbaa）表达透明度，不依赖 color-mix 的浏览器支持
function withAlpha(hex, alpha) {
  const channel = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${channel}`;
}

/**
 * 由主色派生 Semi 变量值：
 * - hover/active：明色模式向黑加深，暗色模式向白提亮
 * - light-*：主色叠加极低透明度，保证与明暗背景都能自然融合
 */
export function buildAccentPalette(accentColor, isDark) {
  const primary = normalizeCustomColor(accentColor);
  if (!primary) return null;
  const shiftTarget = isDark ? '#ffffff' : '#000000';
  return {
    primary,
    hover: mixHexColors(primary, shiftTarget, isDark ? 0.16 : 0.12),
    active: mixHexColors(primary, shiftTarget, isDark ? 0.28 : 0.24),
    lightDefault: withAlpha(primary, isDark ? 0.2 : 0.12),
    lightHover: withAlpha(primary, isDark ? 0.3 : 0.2),
    lightActive: withAlpha(primary, isDark ? 0.4 : 0.3),
  };
}

/**
 * 在 document.body 上设置/清除 Semi 主题色变量（主色 + 次要色）。
 * 颜色为 null 时清空对应的覆盖变量，回到 Semi 原生主题。
 */
export function applyAccentVariables(accentColor, secondaryColor, isDark) {
  if (typeof document === 'undefined' || !document.body) return;
  const bodyStyle = document.body.style;
  const palette = accentColor ? buildAccentPalette(accentColor, isDark) : null;
  if (!palette) {
    ACCENT_CSS_VARIABLES.forEach((name) => bodyStyle.removeProperty(name));
  } else {
    bodyStyle.setProperty('--semi-color-primary', palette.primary);
    bodyStyle.setProperty('--semi-color-primary-hover', palette.hover);
    bodyStyle.setProperty('--semi-color-primary-active', palette.active);
    bodyStyle.setProperty(
      '--semi-color-primary-light-default',
      palette.lightDefault,
    );
    bodyStyle.setProperty(
      '--semi-color-primary-light-hover',
      palette.lightHover,
    );
    bodyStyle.setProperty(
      '--semi-color-primary-light-active',
      palette.lightActive,
    );
    bodyStyle.setProperty('--semi-color-link', palette.primary);
    bodyStyle.setProperty('--semi-color-link-hover', palette.hover);
    bodyStyle.setProperty('--semi-color-link-active', palette.active);
    bodyStyle.setProperty('--semi-color-focus-border', palette.primary);
  }

  const secondaryPalette = secondaryColor
    ? buildAccentPalette(secondaryColor, isDark)
    : null;
  if (!secondaryPalette) {
    SECONDARY_CSS_VARIABLES.forEach((name) => bodyStyle.removeProperty(name));
    return;
  }
  bodyStyle.setProperty('--semi-color-secondary', secondaryPalette.primary);
  bodyStyle.setProperty('--semi-color-secondary-hover', secondaryPalette.hover);
  bodyStyle.setProperty(
    '--semi-color-secondary-active',
    secondaryPalette.active,
  );
  bodyStyle.setProperty(
    '--semi-color-secondary-light-default',
    secondaryPalette.lightDefault,
  );
  bodyStyle.setProperty(
    '--semi-color-secondary-light-hover',
    secondaryPalette.lightHover,
  );
  bodyStyle.setProperty(
    '--semi-color-secondary-light-active',
    secondaryPalette.lightActive,
  );
}

/**
 * 清洗 GET /api/status 返回的 default_theme，字段缺失/非法时回退内置默认，
 * 接口异常时由调用方保持个人偏好不变。
 */
export function normalizeGlobalThemeSettings(raw) {
  const presets = new Set([
    ...THEME_PRESETS.map((item) => item.value),
    CUSTOM_THEME_PRESET,
  ]);
  if (!raw || typeof raw !== 'object') {
    return {
      mode: 'auto',
      preset: DEFAULT_THEME_PRESET,
      customColor: DEFAULT_CUSTOM_THEME_COLOR,
    };
  }
  return {
    mode: normalizeGlobalThemeMode(raw.mode),
    preset: presets.has(raw.preset) ? raw.preset : DEFAULT_THEME_PRESET,
    customColor:
      normalizeCustomColor(raw.custom_color) ?? DEFAULT_CUSTOM_THEME_COLOR,
  };
}
