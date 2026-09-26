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

import React, { useState } from 'react';
import { Button, SideSheet, Tooltip } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { Check, Palette, RotateCcw } from 'lucide-react';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import {
  useActualTheme,
  useSetTheme,
  useTheme,
  useThemePreset,
  useSetThemePreset,
} from '../../../context/Theme';
import {
  useAppearance,
  useResetAppearance,
  useSetAppearance,
} from '../../../context/ThemeAppearance';
import {
  IconThemeDark,
  IconThemeLight,
  IconThemeSystem,
  IconSidebarInset,
  IconSidebarFloating,
  IconSidebarSidebar,
  IconLayoutDefault,
  IconLayoutCompact,
  IconLayoutFull,
} from './config-icons';

/* ---------- 通用瓦片（对齐新版：预览区 + 右上角选中角标 + 下方标签） ---------- */
/* previewClassName 默认 h-12 固定高度，适合 absolute 定位的纯 CSS 预览；
   SVG 示意图标会按 viewBox 比例撑高，必须传 h-auto，否则会溢出边框。 */

const OptionTile = ({
  selected,
  onClick,
  label,
  children,
  previewClassName = 'h-12',
}) => (
  <button
    type='button'
    onClick={onClick}
    className='group flex flex-col items-stretch outline-none cursor-pointer select-none'
  >
    <div
      className={`relative rounded-md transition shadow-sm ${previewClassName} ${
        selected
          ? 'border-[1.5px] border-[var(--semi-color-primary)] shadow-md'
          : 'border-[1.5px] border-[var(--semi-color-border)] hover:border-[var(--semi-color-primary)]'
      }`}
    >
      {selected && (
        <span
          className='absolute top-0 right-0 z-10 flex items-center justify-center w-5 h-5 rounded-full -translate-y-1/2 translate-x-1/2'
          style={{ background: 'var(--semi-color-primary)' }}
        >
          <Check size={12} strokeWidth={3} style={{ color: '#fff' }} />
        </span>
      )}
      {children}
    </div>
    <div
      className='mt-1 text-xs text-center leading-4'
      style={{ color: 'var(--semi-color-text-1)' }}
    >
      {label}
    </div>
  </button>
);

const Section = ({ title, showReset, onReset, children }) => (
  <div className='mb-6'>
    <div className='flex items-center gap-2 mb-2'>
      <span
        className='text-sm font-semibold'
        style={{ color: 'var(--semi-color-text-2)' }}
      >
        {title}
      </span>
      {showReset && onReset && (
        <Button
          theme='borderless'
          type='tertiary'
          aria-label='Reset'
          icon={<RotateCcw size={12} />}
          onClick={onReset}
          className='!p-0.5 !w-4 !h-4'
        />
      )}
    </div>
    {children}
  </div>
);

/* 预览元素着色：选中用主题色，未选中用次要文字色 */
const previewColor = (selected) =>
  selected
    ? 'fill-[var(--semi-color-primary)] stroke-[var(--semi-color-primary)]'
    : 'fill-[var(--semi-color-text-2)] stroke-[var(--semi-color-text-2)]';

/* ---------- 主题 ---------- */

const MODE_TILES = [
  { value: 'auto', label: '系统', Icon: IconThemeSystem },
  { value: 'light', label: '浅色', Icon: IconThemeLight },
  { value: 'dark', label: '深色', Icon: IconThemeDark },
];

const ThemeSection = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const setTheme = useSetTheme();
  return (
    <Section
      title={t('主题')}
      showReset={theme !== 'auto'}
      onReset={() => setTheme('auto')}
    >
      <div className='grid grid-cols-3 gap-4'>
        {MODE_TILES.map(({ value, label, Icon }) => {
          const selected = theme === value;
          return (
            <OptionTile
              key={value}
              selected={selected}
              onClick={() => setTheme(value)}
              label={label}
              previewClassName='h-auto'
            >
              <Icon
                className={`block w-full h-auto ${previewColor(selected)}`}
              />
            </OptionTile>
          );
        })}
      </div>
    </Section>
  );
};

/* ---------- 颜色预设（渐变色板取自新版 THEME_PRESETS） ---------- */

const PRESET_SWATCHES = {
  anthropic: ['oklch(0.984 0.005 95)', 'oklch(0.685 0.142 38)'],
  'simple-large': ['oklch(0.15 0 0)', 'oklch(0.99 0 0)'],
  underground: ['oklch(0.5315 0.0694 156.19)', 'oklch(0.5748 0.0862 336.52)'],
  'rose-garden': ['oklch(0.5827 0.2418 12.23)', 'oklch(0.8131 0.1129 5.67)'],
  'lake-view': ['oklch(0.765 0.177 163.22)', 'oklch(0.551 0.0899 200.52)'],
  'sunset-glow': ['oklch(0.5591 0.1882 25.33)', 'oklch(0.7938 0.1248 42.42)'],
  'forest-whisper': [
    'oklch(0.5276 0.1072 182.22)',
    'oklch(0.5236 0.0505 250.18)',
  ],
  'ocean-breeze': [
    'oklch(0.5461 0.2152 262.88)',
    'oklch(0.5854 0.2041 277.12)',
  ],
  'lavender-dream': [
    'oklch(0.5709 0.1808 306.89)',
    'oklch(0.811 0.0589 201.14)',
  ],
};

const PRESET_LABELS = {
  default: '默认',
  anthropic: 'Anthropic',
  'simple-large': '简约大字号',
  underground: '地下',
  'rose-garden': '玫瑰园',
  'lake-view': '湖景',
  'sunset-glow': '日落余晖',
  'forest-whisper': '森林私语',
  'ocean-breeze': '海洋微风',
  'lavender-dream': '薰衣草之梦',
};

const PresetSection = () => {
  const { t } = useTranslation();
  const preset = useThemePreset();
  const setPreset = useSetThemePreset();
  return (
    <Section
      title={t('颜色预设')}
      showReset={preset !== 'default'}
      onReset={() => setPreset('default')}
    >
      <div className='grid grid-cols-4 gap-3'>
        {PRESET_LABELS &&
          Object.keys(PRESET_LABELS).map((value) => {
            const selected = preset === value;
            const background =
              value === 'default'
                ? 'linear-gradient(135deg, var(--semi-color-bg-0) 0%, var(--semi-color-fill-0) 50%, var(--semi-color-text-0) 100%)'
                : `linear-gradient(135deg, ${PRESET_SWATCHES[value][0]} 0%, ${PRESET_SWATCHES[value][1]} 100%)`;
            return (
              <OptionTile
                key={value}
                selected={selected}
                onClick={() => setPreset(value)}
                label={t(PRESET_LABELS[value])}
              >
                <span
                  aria-hidden='true'
                  className='absolute inset-0 rounded-md'
                  style={{ background }}
                />
              </OptionTile>
            );
          })}
      </div>
    </Section>
  );
};

/* ---------- 字体 ---------- */

const FONT_TILES = [
  { value: 'default', label: '自动', preview: null },
  { value: 'sans', label: 'Sans', preview: 'var(--font-sans)' },
  { value: 'serif', label: 'Serif', preview: 'var(--font-serif)' },
];

const FontSection = () => {
  const { t } = useTranslation();
  const appearance = useAppearance();
  const setAppearance = useSetAppearance();
  return (
    <Section
      title={t('字体')}
      showReset={appearance.font !== 'default'}
      onReset={() => setAppearance('font', 'default')}
    >
      <div className='grid grid-cols-3 gap-4'>
        {FONT_TILES.map(({ value, label, preview }) => {
          const selected = appearance.font === value;
          return (
            <OptionTile
              key={value}
              selected={selected}
              onClick={() => setAppearance('font', value)}
              label={label}
            >
              <span
                className='absolute inset-0 flex items-center justify-center text-xl'
                style={{
                  fontFamily: preview || undefined,
                  color: 'var(--semi-color-text-0)',
                }}
              >
                Aa
              </span>
            </OptionTile>
          );
        })}
      </div>
    </Section>
  );
};

/* ---------- 圆角（左上角弧线预览，取自新版） ---------- */

const RADIUS_TILES = [
  { value: 'default', label: '自动', preview: '1rem' },
  { value: 'none', label: '0', preview: '0' },
  { value: 'sm', label: '0.3', preview: '0.3rem' },
  { value: 'md', label: '0.5', preview: '0.5rem' },
  { value: 'lg', label: '0.75', preview: '0.75rem' },
  { value: 'xl', label: '1.0', preview: '1rem' },
];

const RadiusSection = () => {
  const { t } = useTranslation();
  const appearance = useAppearance();
  const setAppearance = useSetAppearance();
  return (
    <Section
      title={t('圆角')}
      showReset={appearance.radius !== 'default'}
      onReset={() => setAppearance('radius', 'default')}
    >
      <div className='grid grid-cols-6 gap-3'>
        {RADIUS_TILES.map(({ value, label, preview }) => {
          const selected = appearance.radius === value;
          return (
            <OptionTile
              key={value}
              selected={selected}
              onClick={() => setAppearance('radius', value)}
              label={label}
            >
              <span
                aria-hidden='true'
                className='absolute top-2.5 left-2.5 w-3.5 h-3.5 border-t-[1.5px] border-l-[1.5px] opacity-70'
                style={{
                  borderTopLeftRadius: preview,
                  borderColor: 'var(--semi-color-text-0)',
                }}
              />
            </OptionTile>
          );
        })}
      </div>
    </Section>
  );
};

/* ---------- 密度（行数 + 行距预览，取自新版） ---------- */

const SCALE_TILES = [
  { value: 'sm', label: '紧凑', rows: 4, rowGap: '3px' },
  { value: 'default', label: '默认', rows: 3, rowGap: '6px' },
  { value: 'lg', label: '宽松', rows: 2, rowGap: '10px' },
  { value: 'xl', label: '超大', rows: 1, rowGap: '14px' },
];

const ScaleSection = () => {
  const { t } = useTranslation();
  const appearance = useAppearance();
  const setAppearance = useSetAppearance();
  return (
    <Section
      title={t('密度')}
      showReset={appearance.scale !== 'default'}
      onReset={() => setAppearance('scale', 'default')}
    >
      <div className='grid grid-cols-4 gap-3'>
        {SCALE_TILES.map(({ value, label, rows, rowGap }) => {
          const selected = appearance.scale === value;
          return (
            <OptionTile
              key={value}
              selected={selected}
              onClick={() => setAppearance('scale', value)}
              label={label}
            >
              <span
                aria-hidden='true'
                className='absolute inset-2.5 flex flex-col justify-center'
                style={{ gap: rowGap }}
              >
                {Array.from({ length: rows }).map((_, i) => (
                  <span
                    key={i}
                    className='block h-[2px] rounded-full opacity-60'
                    style={{
                      width: `${85 - i * 10}%`,
                      background: 'var(--semi-color-text-0)',
                    }}
                  />
                ))}
              </span>
            </OptionTile>
          );
        })}
      </div>
    </Section>
  );
};

/* ---------- 侧边栏 / 布局（SVG 示意图标） ---------- */

const SIDEBAR_TILES = [
  { value: 'inset', label: '内嵌', Icon: IconSidebarInset },
  { value: 'floating', label: '浮动', Icon: IconSidebarFloating },
  { value: 'sidebar', label: '侧边栏', Icon: IconSidebarSidebar },
];

const SidebarVariantSection = () => {
  const { t } = useTranslation();
  const appearance = useAppearance();
  const setAppearance = useSetAppearance();
  return (
    <Section
      title={t('侧边栏')}
      showReset={appearance.sidebarVariant !== 'sidebar'}
      onReset={() => setAppearance('sidebarVariant', 'sidebar')}
    >
      <div className='grid grid-cols-3 gap-4'>
        {SIDEBAR_TILES.map(({ value, label, Icon }) => {
          const selected = appearance.sidebarVariant === value;
          return (
            <OptionTile
              key={value}
              selected={selected}
              onClick={() => setAppearance('sidebarVariant', value)}
              label={label}
              previewClassName='h-auto'
            >
              <Icon
                className={`block w-full h-auto ${previewColor(selected)}`}
              />
            </OptionTile>
          );
        })}
      </div>
    </Section>
  );
};

const LAYOUT_TILES = [
  { value: 'default', label: '默认', Icon: IconLayoutDefault },
  { value: 'compact', label: '紧凑', Icon: IconLayoutCompact },
  { value: 'fullscreen', label: '全屏布局', Icon: IconLayoutFull },
];

const LayoutModeSection = () => {
  const { t } = useTranslation();
  const appearance = useAppearance();
  const setAppearance = useSetAppearance();
  return (
    <Section
      title={t('布局')}
      showReset={appearance.layoutMode !== 'default'}
      onReset={() => setAppearance('layoutMode', 'default')}
    >
      <div className='grid grid-cols-3 gap-4'>
        {LAYOUT_TILES.map(({ value, label, Icon }) => {
          const selected = appearance.layoutMode === value;
          return (
            <OptionTile
              key={value}
              selected={selected}
              onClick={() => setAppearance('layoutMode', value)}
              label={label}
              previewClassName='h-auto'
            >
              <Icon
                className={`block w-full h-auto ${previewColor(selected)}`}
              />
            </OptionTile>
          );
        })}
      </div>
    </Section>
  );
};

/* ---------- 内容宽度 ---------- */

const CONTENT_WIDTH_TILES = [
  { value: 'full', label: '全宽' },
  { value: 'centered', label: '居中' },
];

const ContentWidthSection = () => {
  const { t } = useTranslation();
  const appearance = useAppearance();
  const setAppearance = useSetAppearance();
  return (
    <Section
      title={t('内容宽度')}
      showReset={appearance.contentWidth !== 'full'}
      onReset={() => setAppearance('contentWidth', 'full')}
    >
      <div className='grid grid-cols-2 gap-4'>
        {CONTENT_WIDTH_TILES.map(({ value, label }) => {
          const selected = appearance.contentWidth === value;
          return (
            <OptionTile
              key={value}
              selected={selected}
              onClick={() => setAppearance('contentWidth', value)}
              label={label}
            >
              <span className='absolute inset-2.5 flex items-center'>
                {value === 'full' ? (
                  <span
                    className='block w-full h-2 rounded-full'
                    style={{
                      background: 'var(--semi-color-text-2)',
                      opacity: 0.6,
                    }}
                  />
                ) : (
                  <span
                    className='block w-2/3 h-2 rounded-full mx-auto'
                    style={{
                      background: 'var(--semi-color-text-2)',
                      opacity: 0.6,
                    }}
                  />
                )}
              </span>
            </OptionTile>
          );
        })}
      </div>
    </Section>
  );
};

/* ---------- 抽屉 + 顶栏按钮 ---------- */

const ThemeSettingsDrawer = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const setTheme = useSetTheme();
  const setPreset = useSetThemePreset();
  const resetAppearance = useResetAppearance();

  const handleResetAll = () => {
    resetAppearance();
    setTheme('auto');
    setPreset('default');
  };

  return (
    <>
      <Tooltip content={t('主题设置')} position='bottom'>
        <Button
          theme='borderless'
          type='tertiary'
          aria-label={t('打开主题设置')}
          icon={<Palette size={18} />}
          onClick={() => setVisible(true)}
          className='!p-1.5 !text-current focus:!bg-semi-color-fill-1 !rounded-full !bg-semi-color-fill-0 hover:!bg-semi-color-fill-1'
        />
      </Tooltip>
      <SideSheet
        visible={visible}
        onCancel={() => setVisible(false)}
        title={
          <div>
            <div className='text-base font-medium'>{t('主题设置')}</div>
            <div
              className='text-xs font-normal mt-0.5'
              style={{ color: 'var(--semi-color-text-2)' }}
            >
              {t('调整外观和布局以适应您的偏好。')}
            </div>
          </div>
        }
        placement='right'
        width={isMobile ? '100%' : 400}
        footer={
          <div className='flex justify-end'>
            <Button type='danger' onClick={handleResetAll}>
              {t('重置')}
            </Button>
          </div>
        }
        bodyStyle={{ padding: '20px 24px' }}
      >
        <ThemeSection />
        <PresetSection />
        <FontSection />
        <RadiusSection />
        <ScaleSection />
        <SidebarVariantSection />
        <LayoutModeSection />
        <ContentWidthSection />
      </SideSheet>
    </>
  );
};

export default ThemeSettingsDrawer;
