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

import React, { useState } from 'react';
import {
  SideSheet,
  Tag,
  Button,
  Modal,
  Typography,
} from '@douyinfe/semi-ui';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';
import {
  getTicketStatusLabel,
  getTicketStatusColor,
} from './ticketStatus';
import TicketConversation from './TicketConversation';

const { Text } = Typography;

// 工单详情抽屉：内嵌共享会话组件；adminMode 下提供状态操作按钮
const TicketDetailDrawer = ({
  visible,
  ticket,
  adminMode = false,
  onClose,
  onChanged,
}) => {
  const { t } = useTranslation();
  const [acting, setActing] = useState(false);

  if (!ticket) return null;

  const changeStatus = async (status) => {
    setActing(true);
    try {
      const res = await API.post(`/api/ticket/admin/${ticket.id}/status`, {
        status,
      });
      if (res.data.success) {
        showSuccess(t('操作成功'));
        onChanged?.();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setActing(false);
    }
  };

  const deleteTicket = () => {
    Modal.confirm({
      title: t('删除工单'),
      content: t('确定删除该工单吗？删除后不可恢复'),
      onOk: async () => {
        try {
          const res = await API.delete(`/api/ticket/admin/${ticket.id}`);
          if (res.data.success) {
            showSuccess(t('删除成功'));
            onClose?.();
            onChanged?.();
          } else {
            showError(res.data.message);
          }
        } catch (e) {
          showError(e.message);
        }
      },
    });
  };

  // 已关闭的工单为终态：不再提供任何状态变更按钮，仅保留删除
  const adminButtons = adminMode ? (
    <div className='flex flex-wrap gap-2 mb-4'>
      {ticket.status !== 'closed' && (
        <>
          {ticket.status !== 'resolved' && (
            <Button
              size='small'
              theme='solid'
              type='primary'
              icon={<CheckCircle2 size={14} />}
              loading={acting}
              onClick={() => changeStatus('resolved')}
            >
              {t('标记完成')}
            </Button>
          )}
          <Button
            size='small'
            type='warning'
            icon={<XCircle size={14} />}
            loading={acting}
            onClick={() => changeStatus('closed')}
          >
            {t('关闭工单')}
          </Button>
          {ticket.status !== 'processing' && (
            <Button
              size='small'
              icon={<RotateCcw size={14} />}
              loading={acting}
              onClick={() => changeStatus('processing')}
            >
              {t('重新打开')}
            </Button>
          )}
        </>
      )}
      <Button
        size='small'
        type='danger'
        icon={<Trash2 size={14} />}
        onClick={deleteTicket}
      >
        {t('删除')}
      </Button>
    </div>
  ) : null;

  return (
    <SideSheet
      title={
        <div className='flex items-center gap-2'>
          <span className='truncate max-w-[320px]'>{ticket.title}</span>
          <Tag color={getTicketStatusColor(ticket.status)} size='small'>
            {getTicketStatusLabel(ticket.status, t)}
          </Tag>
        </div>
      }
      visible={visible}
      onCancel={onClose}
      width={typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : 520}
      footer={null}
    >
      {adminButtons}
      <div style={{ height: adminMode ? 'calc(100% - 48px)' : '100%' }}>
        <TicketConversation
          ticketId={ticket.id}
          adminMode={adminMode}
          onUpdated={onChanged}
        />
      </div>
    </SideSheet>
  );
};

export default TicketDetailDrawer;
