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

export function setStatusData(data) {
  localStorage.setItem('status', JSON.stringify(data));
  localStorage.setItem('system_name', data.system_name);
  localStorage.setItem('logo', data.logo);
  localStorage.setItem('footer_html', data.footer_html);
  localStorage.setItem('quota_per_unit', data.quota_per_unit);
  // 兼容：保留旧字段，同时写入新的额度展示类型
  localStorage.setItem('display_in_currency', data.display_in_currency);
  localStorage.setItem('quota_display_type', data.quota_display_type || 'USD');
  localStorage.setItem('enable_drawing', data.enable_drawing);
  localStorage.setItem('enable_task', data.enable_task);
  localStorage.setItem('enable_data_export', data.enable_data_export);
  localStorage.setItem('chats', JSON.stringify(data.chats));
  localStorage.setItem(
    'data_export_default_time',
    data.data_export_default_time,
  );
  localStorage.setItem(
    'default_collapse_sidebar',
    data.default_collapse_sidebar,
  );
  localStorage.setItem('mj_notify_enabled', data.mj_notify_enabled);
  if (data.chat_link) {
    // localStorage.setItem('chat_link', data.chat_link);
  } else {
    localStorage.removeItem('chat_link');
  }
  if (data.chat_link2) {
    // localStorage.setItem('chat_link2', data.chat_link2);
  } else {
    localStorage.removeItem('chat_link2');
  }
  if (data.docs_link) {
    localStorage.setItem('docs_link', data.docs_link);
  } else {
    localStorage.removeItem('docs_link');
  }
}

// 鉴权字段（访问令牌与会话）只在登录/刷新时由服务端下发，
// 而 /api/user/self 等接口返回的 user 不含这些字段。
// 因此更新 user 时必须保留既有鉴权字段，否则会把访问令牌冲掉。
const AUTH_FIELDS = ['token', 'token_type', 'access_expires_at', 'session'];

export function getStoredUser() {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function setUserData(data) {
  if (!data || typeof data !== 'object') return;
  const existing = getStoredUser();
  const next = { ...data };
  if (existing && typeof existing === 'object') {
    for (const key of AUTH_FIELDS) {
      if (next[key] === undefined && existing[key] !== undefined) {
        next[key] = existing[key];
      }
    }
  }
  localStorage.setItem('user', JSON.stringify(next));
}

export function clearUserData() {
  localStorage.removeItem('user');
}
