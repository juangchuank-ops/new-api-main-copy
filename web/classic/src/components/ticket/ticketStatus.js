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

// 工单状态常量与展示元数据，供工单中心各组件共享

export const TICKET_STATUS_KEYS = ['processing', 'waiting', 'resolved', 'closed'];

export function getTicketStatusLabel(status, t) {
  switch (status) {
    case 'processing':
      return t('平台处理中');
    case 'waiting':
      return t('等待你回复');
    case 'resolved':
      return t('已处理');
    case 'closed':
      return t('已关闭');
    default:
      return status;
  }
}

export function getTicketStatusColor(status) {
  switch (status) {
    case 'processing':
      return 'blue';
    case 'waiting':
      return 'red';
    case 'resolved':
      return 'green';
    case 'closed':
      return 'grey';
    default:
      return 'grey';
  }
}

// 截图样式中统计胶囊使用的小圆点颜色
export function getTicketStatusDotClass(status) {
  switch (status) {
    case 'processing':
      return 'bg-blue-500';
    case 'waiting':
      return 'bg-red-500';
    case 'resolved':
      return 'bg-green-500';
    case 'closed':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
}

export function formatTicketTime(value) {
  if (!value) return '—';
  const d = new Date(value * 1000);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}
