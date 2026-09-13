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

import { storeAuthBundle } from './auth-session';

// 新版后端登录/注册/oauth 可能返回三种载荷：
//   1. AuthBundle：登录成功，携带访问令牌与会话
//   2. LoginChallenge：需要二次验证（2FA / Passkey）
//       { require_verification: true, flow_token, expires_at, methods }
//   3. PendingRegistrationChallenge：需要注册码才能完成注册
//       { require_registration_code: true, flow_token, expires_at }
// 下面的判定函数与官方前端 flow 判定保持一致。

export function isLoginChallenge(value) {
  if (!value || typeof value !== 'object') return false;
  return (
    value.require_verification === true &&
    typeof value.flow_token === 'string' &&
    value.flow_token.length > 0 &&
    typeof value.expires_at === 'number'
  );
}

export function isPendingRegistrationChallenge(value) {
  if (!value || typeof value !== 'object') return false;
  return (
    value.require_registration_code === true &&
    typeof value.flow_token === 'string' &&
    value.flow_token.length > 0 &&
    typeof value.expires_at === 'number'
  );
}

// 展平 AuthBundle、写入本地存储，并同步 React 用户上下文。
// 返回扁平 user；若载荷不是合法 AuthBundle 则返回 null。
export function applyLoginBundle(bundle, userDispatch) {
  const user = storeAuthBundle(bundle);
  if (!user) return null;
  if (typeof userDispatch === 'function') {
    userDispatch({ type: 'login', payload: user });
  }
  return user;
}
