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

import React, { useMemo } from 'react';
import { Button, Dropdown } from '@douyinfe/semi-ui';
import { Sun, Moon, Monitor } from 'lucide-react';
import {
  useActualTheme,
  useCustomThemeColor,
  useSetCustomThemeColor,
  useSetThemePreset,
  useThemePreset,
} from '../../../context/Theme';
import {
  CUSTOM_THEME_PRESET,
  THEME_PRESETS,
  normalizeCustomColor,
  resolveAccentColor,
} from '../../../helpers/theme-customization';

const { Title, Divider } = Dropdown;

const ThemeToggle = ({ theme, onThemeToggle, t }) => {
  const actualTheme = useActualTheme();
  const isDark = actualTheme === 'dark';
  const preset = useThemePreset();
  const setPreset = useSetThemePreset();
  const customColor = useCustomThemeColor();
  const setCustomColor = useSetCustomThemeColor();

  const themeOptions = useMemo(
    () => [
      {
        key: 'light',
        icon: <Sun size={18} />,
        buttonIcon: <Sun size={18} />,
        label: t('浅色模式'),
        description: t('始终使用浅色主题'),
      },
      {
        key: 'dark',
        icon: <Moon size={18} />,
        buttonIcon: <Moon size={18} />,
        label: t('深色模式'),
        description: t('始终使用深色主题'),
      },
      {
        key: 'auto',
        icon: <Monitor size={18} />,
        buttonIcon: <Monitor size={18} />,
        label: t('自动模式'),
        description: t('跟随系统主题设置'),
      },
    ],
    [t],
  );

  const getItemClassName = (isSelected) =>
    isSelected
      ? '!bg-semi-color-primary-light-default !font-semibold'
      : 'hover:!bg-semi-color-fill-1';

  const currentButtonIcon = useMemo(() => {
    const currentOption = themeOptions.find((option) => option.key === theme);
    return currentOption?.buttonIcon || themeOptions[2].buttonIcon;
  }, [theme, themeOptions]);

  // preset 为 default 时没有覆盖主色，用 Semi 原生变量作为预览色
  const getPresetSwatch = (presetValue) =>
    resolveAccentColor(presetValue, customColor, isDark) ||
    'var(--semi-color-primary)';

  const handlePresetSelect = (presetValue) => {
    setPreset(presetValue);
  };

  const handleCustomColorChange = (event) => {
    const value = event.target.value;
    if (!normalizeCustomColor(value)) return;
    setCustomColor(value);
    setPreset(CUSTOM_THEME_PRESET);
  };

  return (
    <Dropdown
      position='bottomRight'
      render={
        <Dropdown.Menu>
          {themeOptions.map((option) => (
            <Dropdown.Item
              key={option.key}
              icon={option.icon}
              onClick={() => onThemeToggle(option.key)}
              className={getItemClassName(theme === option.key)}
            >
              <div className='flex flex-col'>
                <span>{option.label}</span>
                <span className='text-xs text-semi-color-text-2'>
                  {option.description}
                </span>
              </div>
            </Dropdown.Item>
          ))}

          {theme === 'auto' && (
            <>
              <Divider />
              <div className='px-3 py-2 text-xs text-semi-color-text-2'>
                {t('当前跟随系统')}：
                {actualTheme === 'dark' ? t('深色') : t('浅色')}
              </div>
            </>
          )}

          <Divider />
          <Title>
            <div className='text-xs text-semi-color-text-2'>{t('主题色')}</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 8,
                marginTop: 8,
              }}
            >
              {THEME_PRESETS.map((item) => (
                <button
                  key={item.value}
                  type='button'
                  title={t(item.label)}
                  aria-label={t(item.label)}
                  aria-pressed={preset === item.value}
                  onClick={() => handlePresetSelect(item.value)}
                  style={{
                    width: 24,
                    height: 24,
                    padding: 0,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    background: getPresetSwatch(item.value),
                    border:
                      preset === item.value
                        ? '2px solid var(--semi-color-text-0)'
                        : '1px solid var(--semi-color-border)',
                    boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 10,
              }}
            >
              <button
                type='button'
                aria-pressed={preset === CUSTOM_THEME_PRESET}
                onClick={() => handlePresetSelect(CUSTOM_THEME_PRESET)}
                className='hover:!bg-semi-color-fill-1'
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                  padding: '4px 6px',
                  border: 0,
                  borderRadius: 4,
                  cursor: 'pointer',
                  textAlign: 'left',
                  background:
                    preset === CUSTOM_THEME_PRESET
                      ? 'var(--semi-color-primary-light-default)'
                      : 'transparent',
                  color: 'var(--semi-color-text-0)',
                  fontWeight: preset === CUSTOM_THEME_PRESET ? 600 : 400,
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: customColor,
                    border: '1px solid var(--semi-color-border)',
                  }}
                />
                {t('自定义颜色')}
              </button>
              <input
                type='color'
                value={customColor}
                onChange={handleCustomColorChange}
                aria-label={t('自定义主题色')}
                title={t('自定义主题色')}
                style={{
                  width: 32,
                  height: 24,
                  padding: 0,
                  cursor: 'pointer',
                  background: 'transparent',
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: 4,
                }}
              />
            </div>
          </Title>
        </Dropdown.Menu>
      }
    >
      <span className='inline-flex'>
        <Button
          icon={currentButtonIcon}
          aria-label={t('切换主题')}
          theme='borderless'
          type='tertiary'
          className='!p-1.5 !text-current focus:!bg-semi-color-fill-1 !rounded-full !bg-semi-color-fill-0 hover:!bg-semi-color-fill-1'
        />
      </span>
    </Dropdown>
  );
};

export default ThemeToggle;
