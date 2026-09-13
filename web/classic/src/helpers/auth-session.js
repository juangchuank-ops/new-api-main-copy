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

import axios from 'axios';
import { getStoredUser, setUserData, clearUserData } from './data';

// 官方新版鉴权把登录态拆成 AuthBundle：
//   { access_token, token_type, access_expires_at, session, user }
// classic 前端大量读取扁平 user（user.id / user.role / user.token），
// 因此这里把 AuthBundle 展平成扁平 user 写入 localStorage，
// 并把 access_token 映射成 user.token，以兼容既有读取点。

const AUTH_REFRESH_PATH = '/api/user/auth/refresh';
const AUTH_LOGOUT_PATH = '/api/user/auth/logout';
const REFRESH_RACE_DELAYS = [80, 200, 500];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object';
}

function isAuthUser(value) {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.id) &&
    value.id > 0 &&
    typeof value.username === 'string' &&
    typeof value.role === 'number'
  );
}

function isLoginSession(value) {
  if (!isRecord(value)) return false;
  return (
    typeof value.sid === 'string' &&
    value.sid.length > 0 &&
    typeof value.current === 'boolean' &&
    typeof value.login_method === 'string' &&
    typeof value.ip === 'string' &&
    typeof value.user_agent === 'string' &&
    typeof value.created_at === 'number' &&
    typeof value.last_active_at === 'number' &&
    typeof value.expires_at === 'number'
  );
}

function hasValidTokenFields(value) {
  return (
    isRecord(value) &&
    typeof value.access_token === 'string' &&
    value.access_token.length > 0 &&
    typeof value.token_type === 'string' &&
    value.token_type.length > 0 &&
    typeof value.access_expires_at === 'number' &&
    Number.isFinite(value.access_expires_at) &&
    value.access_expires_at > 0
  );
}

export function isAuthBundle(value) {
  return (
    hasValidTokenFields(value) &&
    isAuthUser(value.user) &&
    isLoginSession(value.session)
  );
}

export function getAccessToken() {
  const user = getStoredUser();
  return user && typeof user.token === 'string' ? user.token : '';
}

export function getAccessExpiresAt() {
  const user = getStoredUser();
  return user && typeof user.access_expires_at === 'number'
    ? user.access_expires_at
    : 0;
}

export function getSessionSID() {
  const user = getStoredUser();
  return user && isRecord(user.session) && typeof user.session.sid === 'string'
    ? user.session.sid
    : '';
}

export function getAuthHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function flattenAuthBundle(bundle) {
  if (!isAuthBundle(bundle)) return null;
  return {
    ...bundle.user,
    token: bundle.access_token,
    token_type: bundle.token_type,
    access_expires_at: bundle.access_expires_at,
    session: bundle.session,
  };
}

export function storeAuthBundle(bundle) {
  const flat = flattenAuthBundle(bundle);
  if (!flat) return null;
  setUserData(flat);
  sessionStorage.removeItem('session-expired');
  return flat;
}

export function applyAuthRotation(value) {
  if (
    !hasValidTokenFields(value) ||
    value.token_type !== 'Bearer' ||
    !isLoginSession(value.session) ||
    !value.session.current
  ) {
    throw new Error('Invalid authentication rotation response');
  }

  const user = getStoredUser();
  if (!user || !isRecord(user.session) || user.session.sid !== value.session.sid) {
    throw new Error('Authentication rotation session mismatch');
  }

  const next = {
    ...user,
    token: value.access_token,
    token_type: value.token_type,
    access_expires_at: value.access_expires_at,
    session: value.session,
  };
  setUserData(next);
  return next;
}

export function clearAuthentication() {
  clearUserData();
}

const authClient = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_SERVER_URL
    ? import.meta.env.VITE_REACT_APP_SERVER_URL
    : '',
  withCredentials: true,
  headers: {
    'Cache-Control': 'no-cache, no-store',
  },
});

let refreshPromise = null;

function waitForRefreshRace(delay) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function requestRefresh(expectedSID) {
  try {
    const response = await authClient.post(AUTH_REFRESH_PATH, undefined, {
      headers: expectedSID ? { 'X-Auth-Session': expectedSID } : undefined,
    });
    return { status: response.status, data: response.data };
  } catch (error) {
    if (!axios.isAxiosError(error)) return { status: 0, error };
    return {
      status: error.response?.status ?? 0,
      data: error.response?.data,
      error,
    };
  }
}

async function runRefresh() {
  let raceAttempt = 0;
  let allowMismatchRetry = true;

  for (;;) {
    const response = await requestRefresh(getSessionSID());
    const body = isRecord(response.data) ? response.data : undefined;
    const code = typeof body?.code === 'string' ? body.code : undefined;

    if (body?.success === true && isAuthBundle(body.data)) {
      return { kind: 'authenticated', user: storeAuthBundle(body.data) };
    }

    if (response.status === 409 && code === 'AUTH_REFRESH_RACE') {
      const delay = REFRESH_RACE_DELAYS[raceAttempt];
      if (delay !== undefined) {
        await waitForRefreshRace(delay);
        raceAttempt += 1;
        continue;
      }
      clearAuthentication();
      return { kind: 'out_of_sync', code };
    }

    if (response.status === 409 && code === 'AUTH_SESSION_MISMATCH') {
      if (allowMismatchRetry) {
        allowMismatchRetry = false;
        clearAuthentication();
        raceAttempt = 0;
        continue;
      }
      clearAuthentication();
      return { kind: 'out_of_sync', code };
    }

    if (response.status === 401) {
      clearAuthentication();
      return { kind: 'anonymous' };
    }

    if (!response.status || response.status >= 500 || response.status === 429) {
      return {
        kind: 'transient_error',
        error: response.error ?? response.data,
      };
    }

    clearAuthentication();
    return { kind: 'out_of_sync', code: code ?? 'AUTH_INVALID_REFRESH_RESPONSE' };
  }
}

export function refreshAuthentication() {
  if (!refreshPromise) {
    refreshPromise = runRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function logoutAuthentication() {
  const sid = getSessionSID();
  const token = getAccessToken();
  const headers = {};
  if (sid) headers['X-Auth-Session'] = sid;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    await authClient.post(AUTH_LOGOUT_PATH, undefined, { headers });
  } catch (error) {
    // 网络异常不阻塞本地登出
  }

  clearAuthentication();
  sessionStorage.removeItem('session-expired');
}
