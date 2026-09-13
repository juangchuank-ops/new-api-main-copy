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

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from 'react';
import { API } from '../../helpers';
import {
  DEFAULT_CUSTOM_THEME_COLOR,
  DEFAULT_THEME_PRESET,
  applyAccentVariables,
  normalizeCustomColor,
  normalizeGlobalThemeSettings,
  normalizeThemeMode,
  resolveAccentColor,
  resolveSecondaryColor,
} from '../../helpers/theme-customization';

const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);

const ActualThemeContext = createContext(null);
export const useActualTheme = () => useContext(ActualThemeContext);

const SetThemeContext = createContext(null);
export const useSetTheme = () => useContext(SetThemeContext);

/* 主题色（preset + 自定义色）个人偏好，独立于明暗模式上下文 */
const ThemePresetContext = createContext(DEFAULT_THEME_PRESET);
export const useThemePreset = () => useContext(ThemePresetContext);

const SetThemePresetContext = createContext(() => {});
export const useSetThemePreset = () => useContext(SetThemePresetContext);

const CustomThemeColorContext = createContext(DEFAULT_CUSTOM_THEME_COLOR);
export const useCustomThemeColor = () => useContext(CustomThemeColorContext);

const SetCustomThemeColorContext = createContext(() => {});
export const useSetCustomThemeColor = () =>
  useContext(SetCustomThemeColorContext);

// 检测系统主题偏好
const getSystemTheme = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return 'light';
};

const readLocalStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 隐私模式等写入失败时忽略，内存状态仍然生效
  }
};

/**
 * 读取历史 theme-mode 并迁移：'true'/'false' 归一化为 dark/light，
 * 其它异常值回退 auto，归一化结果写回存储（幂等）。
 */
const readStoredThemeMode = () => {
  const stored = readLocalStorage('theme-mode');
  if (stored === null) return null;
  const normalized = normalizeThemeMode(stored);
  if (normalized !== stored) {
    writeLocalStorage('theme-mode', normalized);
  }
  return normalized;
};

const readStoredThemePreset = () => readLocalStorage('theme-preset');

const readStoredCustomColor = () => {
  const stored = readLocalStorage('theme-custom-color');
  return stored === null ? null : normalizeCustomColor(stored);
};

export const ThemeProvider = ({ children }) => {
  const [theme, _setTheme] = useState(() => readStoredThemeMode() ?? 'auto');

  const [systemTheme, setSystemTheme] = useState(getSystemTheme());

  // 个人偏好（null 表示未设置，回退全局默认）
  const [preset, _setPreset] = useState(readStoredThemePreset);
  const [customColor, _setCustomColor] = useState(readStoredCustomColor);
  // 全局默认来自 GET /api/status 的 default_theme
  const [globalTheme, setGlobalTheme] = useState(null);

  // 计算实际应用的主题
  const actualTheme = theme === 'auto' ? systemTheme : theme;

  const resolvedPreset = preset ?? globalTheme?.preset ?? DEFAULT_THEME_PRESET;
  const resolvedCustomColor =
    customColor ?? globalTheme?.customColor ?? DEFAULT_CUSTOM_THEME_COLOR;

  // 全局默认只在个人偏好未设置时生效（不写回 localStorage，保持"未设置"状态）
  useEffect(() => {
    if (!globalTheme) return;
    if (readLocalStorage('theme-mode') !== null) return;
    _setTheme(globalTheme.mode);
  }, [globalTheme]);

  // 读取全局默认主题；失败（404/网络错误）时保持个人偏好与内置默认
  useEffect(() => {
    let cancelled = false;
    const loadGlobalTheme = async () => {
      try {
        const res = await API.get('/api/status');
        if (cancelled) return;
        const { success, data } = res?.data ?? {};
        if (success && data?.default_theme) {
          setGlobalTheme(normalizeGlobalThemeSettings(data.default_theme));
        }
      } catch {
        // 忽略：不影响明暗模式与个人偏好
      }
    };
    loadGlobalTheme();
    return () => {
      cancelled = true;
    };
  }, []);

  // 监听系统主题变化
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleSystemThemeChange = (e) => {
        setSystemTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);

      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }
  }, []);

  // 应用主题到DOM
  useEffect(() => {
    const body = document.body;
    if (actualTheme === 'dark') {
      body.setAttribute('theme-mode', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      body.removeAttribute('theme-mode');
      document.documentElement.classList.remove('dark');
    }
  }, [actualTheme]);

  // 应用主题色变量（主色 + 次要色）：default preset 且无自定义色时清空覆盖变量
  useEffect(() => {
    const isDark = actualTheme === 'dark';
    applyAccentVariables(
      resolveAccentColor(resolvedPreset, resolvedCustomColor, isDark),
      resolveSecondaryColor(resolvedPreset, isDark),
      isDark,
    );
  }, [actualTheme, resolvedPreset, resolvedCustomColor]);

  const setTheme = useCallback((newTheme) => {
    let themeValue;

    if (typeof newTheme === 'boolean') {
      // 向后兼容原有的 boolean 参数
      themeValue = newTheme ? 'dark' : 'light';
    } else if (typeof newTheme === 'string') {
      // 新的字符串参数支持 'light', 'dark', 'auto'
      themeValue = normalizeThemeMode(newTheme);
    } else {
      themeValue = 'auto';
    }

    _setTheme(themeValue);
    writeLocalStorage('theme-mode', themeValue);
  }, []);

  const setThemePreset = useCallback((newPreset) => {
    const presetValue =
      typeof newPreset === 'string' && newPreset ? newPreset : DEFAULT_THEME_PRESET;
    _setPreset(presetValue);
    writeLocalStorage('theme-preset', presetValue);
  }, []);

  const setCustomColor = useCallback((newColor) => {
    const normalized = normalizeCustomColor(newColor);
    if (!normalized) return;
    _setCustomColor(normalized);
    writeLocalStorage('theme-custom-color', normalized);
  }, []);

  return (
    <SetThemeContext.Provider value={setTheme}>
      <ActualThemeContext.Provider value={actualTheme}>
        <ThemeContext.Provider value={theme}>
          <ThemePresetContext.Provider value={resolvedPreset}>
            <SetThemePresetContext.Provider value={setThemePreset}>
              <CustomThemeColorContext.Provider value={resolvedCustomColor}>
                <SetCustomThemeColorContext.Provider value={setCustomColor}>
                  {children}
                </SetCustomThemeColorContext.Provider>
              </CustomThemeColorContext.Provider>
            </SetThemePresetContext.Provider>
          </ThemePresetContext.Provider>
        </ThemeContext.Provider>
      </ActualThemeContext.Provider>
    </SetThemeContext.Provider>
  );
};
