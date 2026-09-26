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
  useEffect,
  useMemo,
  useState,
} from 'react';

// 外观个性化设置（移植自新版主题设置抽屉），纯本地偏好，不走后端。
// 密度通过 html 根字号缩放 rem 工具类；其余项由 body data 属性驱动
// appearance.css 中的 CSS 变量覆盖。

export const APPEARANCE_DEFAULTS = {
  font: 'default', // default | sans | serif
  radius: 'default', // default | none | sm | md | lg | xl
  scale: 'default', // default | sm | lg | xl
  sidebarVariant: 'sidebar', // sidebar | inset | floating
  layoutMode: 'default', // default | compact | fullscreen
  contentWidth: 'full', // full | centered
};

const STORAGE_KEYS = {
  font: 'theme-font',
  radius: 'theme-radius',
  scale: 'theme-scale',
  sidebarVariant: 'theme-sidebar-variant',
  layoutMode: 'theme-layout-mode',
  contentWidth: 'theme-content-width',
};

const FONT_SCALES = { sm: '15px', lg: '17px', xl: '18px' };

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
    /* ignore */
  }
};

const removeLocalStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

const normalize = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

const AppearanceContext = createContext(APPEARANCE_DEFAULTS);
export const useAppearance = () => useContext(AppearanceContext);

const SetAppearanceContext = createContext(() => {});
export const useSetAppearance = () => useContext(SetAppearanceContext);

const ResetAppearanceContext = createContext(() => {});
export const useResetAppearance = () => useContext(ResetAppearanceContext);

export const ThemeAppearanceProvider = ({ children }) => {
  const [appearance, setAppearance] = useState(() => ({
    font: normalize(
      readLocalStorage(STORAGE_KEYS.font),
      ['default', 'sans', 'serif'],
      APPEARANCE_DEFAULTS.font,
    ),
    radius: normalize(
      readLocalStorage(STORAGE_KEYS.radius),
      ['default', 'none', 'sm', 'md', 'lg', 'xl'],
      APPEARANCE_DEFAULTS.radius,
    ),
    scale: normalize(
      readLocalStorage(STORAGE_KEYS.scale),
      ['default', 'sm', 'lg', 'xl'],
      APPEARANCE_DEFAULTS.scale,
    ),
    sidebarVariant: normalize(
      readLocalStorage(STORAGE_KEYS.sidebarVariant),
      ['sidebar', 'inset', 'floating'],
      APPEARANCE_DEFAULTS.sidebarVariant,
    ),
    layoutMode: normalize(
      readLocalStorage(STORAGE_KEYS.layoutMode),
      ['default', 'compact', 'fullscreen'],
      APPEARANCE_DEFAULTS.layoutMode,
    ),
    contentWidth: normalize(
      readLocalStorage(STORAGE_KEYS.contentWidth),
      ['full', 'centered'],
      APPEARANCE_DEFAULTS.contentWidth,
    ),
  }));

  const setAppearanceValue = useCallback((key, value) => {
    setAppearance((prev) => {
      if (!(key in APPEARANCE_DEFAULTS) || prev[key] === value) {
        return prev;
      }
      const storageKey = STORAGE_KEYS[key];
      if (value === APPEARANCE_DEFAULTS[key]) {
        removeLocalStorage(storageKey);
      } else {
        writeLocalStorage(storageKey, value);
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const resetAppearance = useCallback(() => {
    setAppearance((prev) => {
      Object.values(STORAGE_KEYS).forEach((storageKey) =>
        removeLocalStorage(storageKey),
      );
      return { ...APPEARANCE_DEFAULTS };
    });
  }, []);

  // 把设置镜像到 DOM：body data 属性 + html 根字号（密度）
  useEffect(() => {
    const body = document.body;
    const apply = (attr, value, defaultValue) => {
      if (value === defaultValue) {
        body.removeAttribute(attr);
      } else {
        body.setAttribute(attr, value);
      }
    };
    apply('data-theme-font', appearance.font, APPEARANCE_DEFAULTS.font);
    apply('data-theme-radius', appearance.radius, APPEARANCE_DEFAULTS.radius);
    apply(
      'data-sidebar-variant',
      appearance.sidebarVariant,
      APPEARANCE_DEFAULTS.sidebarVariant,
    );
    apply(
      'data-content-width',
      appearance.contentWidth,
      APPEARANCE_DEFAULTS.contentWidth,
    );
    // 密度即使默认也写属性，便于 CSS/调试定位；缩放只在非默认时设置
    body.setAttribute('data-theme-scale', appearance.scale);
    const root = document.documentElement;
    const fontSize = FONT_SCALES[appearance.scale];
    if (fontSize) {
      root.style.fontSize = fontSize;
    } else {
      root.style.fontSize = '';
    }
  }, [appearance]);

  const memo = useMemo(() => appearance, [appearance]);

  return (
    <AppearanceContext.Provider value={memo}>
      <SetAppearanceContext.Provider value={setAppearanceValue}>
        <ResetAppearanceContext.Provider value={resetAppearance}>
          {children}
        </ResetAppearanceContext.Provider>
      </SetAppearanceContext.Provider>
    </AppearanceContext.Provider>
  );
};
