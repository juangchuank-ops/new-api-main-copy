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

import React from 'react';
import { Navigate } from 'react-router-dom';
import { history } from './history';

export function authHeader() {
  // return authorization header with jwt token
  let user = JSON.parse(localStorage.getItem('user'));

  if (user && user.token) {
    return { Authorization: 'Bearer ' + user.token };
  } else {
    return {};
  }
}

// session-expired 由 showError 在 401 时设置。
// useSidebar 在整页刷新后可能用 access token 重新拉取 /api/user/self
// 把 user 写回 localStorage，因此所有路由守卫都必须检查此标记，
// 否则会与 AuthRedirect / PrivateRoute 形成无限重定向循环。
const isSessionExpired = () => sessionStorage.getItem('session-expired') === '1';

export const AuthRedirect = ({ children }) => {
  const user = localStorage.getItem('user');

  if (user && !isSessionExpired()) {
    return <Navigate to='/console' replace />;
  }

  return children;
};

function PrivateRoute({ children }) {
  if (!localStorage.getItem('user') || isSessionExpired()) {
    return <Navigate to='/login' state={{ from: history.location }} />;
  }
  return children;
}

export function AdminRoute({ children }) {
  const raw = localStorage.getItem('user');
  if (!raw || isSessionExpired()) {
    return <Navigate to='/login' state={{ from: history.location }} />;
  }
  try {
    const user = JSON.parse(raw);
    if (user && typeof user.role === 'number' && user.role >= 5) {
      return children;
    }
  } catch (e) {
    // ignore
  }
  return <Navigate to='/forbidden' replace />;
}

// 超级管理员专用守卫：部分接口（如任务插件）只允许 root 访问，
// 权限管理员（role 5~99）即使通过 AdminRoute 也会被后端拒绝。
export function RootRoute({ children }) {
  const raw = localStorage.getItem('user');
  if (!raw || isSessionExpired()) {
    return <Navigate to='/login' state={{ from: history.location }} />;
  }
  try {
    const user = JSON.parse(raw);
    if (user && typeof user.role === 'number' && user.role >= 100) {
      return children;
    }
  } catch (e) {
    // ignore
  }
  return <Navigate to='/forbidden' replace />;
}

export { PrivateRoute };
