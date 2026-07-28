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

export const INVITATION_CODE_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
  USED: 3,
};

// Invitation code status display mapping
export const INVITATION_CODE_STATUS_MAP = {
  [INVITATION_CODE_STATUS.ENABLED]: {
    color: 'green',
    text: '已启用',
  },
  [INVITATION_CODE_STATUS.DISABLED]: {
    color: 'red',
    text: '已禁用',
  },
  [INVITATION_CODE_STATUS.USED]: {
    color: 'grey',
    text: '已使用',
  },
};

// Action type constants
export const INVITATION_CODE_ACTIONS = {
  DELETE: 'delete',
  ENABLE: 'enable',
  DISABLE: 'disable',
};
