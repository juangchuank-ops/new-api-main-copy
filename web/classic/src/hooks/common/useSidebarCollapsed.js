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

import { useState, useCallback, useEffect } from 'react';

const KEY = 'default_collapse_sidebar';
const CHANGE_EVENT = 'sidebar-collapsed-change';

export const useSidebarCollapsed = () => {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(KEY) === 'true',
  );

  // 跨实例同步：PageLayout（布局模式）与 SiderBar（折叠按钮）各自持有实例，
  // 任一实例变化时通过自定义事件通知其它实例。同值更新会被 React 跳过，不会成环。
  useEffect(() => {
    localStorage.setItem(KEY, collapsed.toString());
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: collapsed }));
  }, [collapsed]);

  useEffect(() => {
    const handler = (event) => setCollapsed(event.detail === true);
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const set = useCallback((value) => {
    setCollapsed(Boolean(value));
  }, []);

  return [collapsed, toggle, set];
};
