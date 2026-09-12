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

import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Empty,
  Input,
  Select,
  Typography,
} from '@douyinfe/semi-ui';
import { RefreshCw, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';
import {
  getTicketStatusLabel,
  getTicketStatusColor,
  formatTicketTime,
  TICKET_STATUS_KEYS,
} from './ticketStatus';
import TicketDetailDrawer from './TicketDetailDrawer';

const { Text } = Typography;

// 管理工单面板：查看全部用户工单，回复 / 完成 / 关闭 / 重新打开 / 删除
const AdminTicketPanel = () => {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailTicket, setDetailTicket] = useState(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        p: String(page),
        page_size: String(pageSize),
      });
      if (statusFilter) params.set('status', statusFilter);
      if (usernameFilter) params.set('username', usernameFilter);
      const res = await API.get(`/api/ticket/admin/?${params.toString()}`);
      if (res.data.success) {
        const data = res.data.data;
        setTickets(data?.items || []);
        setTotal(data?.total || 0);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, usernameFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const updateStatus = async (ticket, status, successMsg) => {
    try {
      const res = await API.post(`/api/ticket/admin/${ticket.id}/status`, {
        status,
      });
      if (res.data.success) {
        showSuccess(successMsg);
        loadTickets();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    }
  };

  const statusOptions = [
    { value: '', label: t('全部状态') },
    ...TICKET_STATUS_KEYS.map((key) => ({
      value: key,
      label: getTicketStatusLabel(key, t),
    })),
  ];

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
    },
    {
      title: t('标题'),
      dataIndex: 'title',
      render: (text) => (
        <Text strong ellipsis={{ showTooltip: true }} style={{ maxWidth: 260 }}>
          {text}
        </Text>
      ),
    },
    {
      title: t('用户'),
      dataIndex: 'username',
      width: 130,
      render: (text) => <Text>{text}</Text>,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 130,
      render: (status) => (
        <Tag color={getTicketStatusColor(status)}>
          {getTicketStatusLabel(status, t)}
        </Tag>
      ),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_time',
      width: 170,
      render: (v) => formatTicketTime(v),
    },
    {
      title: t('更新时间'),
      dataIndex: 'updated_time',
      width: 170,
      render: (v) => formatTicketTime(v),
    },
    {
      title: t('操作'),
      dataIndex: 'op',
      width: 220,
      render: (_, record) => (
        <div className='flex flex-wrap gap-1'>
          <Button size='small' onClick={() => setDetailTicket(record)}>
            {t('查看')}
          </Button>
          {record.status !== 'resolved' && record.status !== 'closed' && (
            <Button
              size='small'
              type='primary'
              onClick={() =>
                updateStatus(record, 'resolved', t('已标记为完成'))
              }
            >
              {t('完成')}
            </Button>
          )}
          {record.status !== 'closed' && (
            <Button
              size='small'
              type='warning'
              onClick={() => updateStatus(record, 'closed', t('已关闭'))}
            >
              {t('关闭')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      <div className='flex flex-wrap items-center gap-2 mb-4'>
        <Input
          prefix={<Search size={14} />}
          placeholder={t('按用户名搜索')}
          value={searchKeyword}
          onChange={(v) => setSearchKeyword(v)}
          onEnterPress={() => {
            setPage(1);
            setUsernameFilter(searchKeyword.trim());
          }}
          showClear
          style={{ width: 220 }}
        />
        <Select
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          optionList={statusOptions}
          style={{ width: 150 }}
        />
        <Button
          icon={<RefreshCw size={14} />}
          onClick={loadTickets}
          loading={loading}
        >
          {t('刷新')}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={tickets}
        loading={loading}
        rowKey='id'
        pagination={{
          currentPage: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          pageSizeOpts: [10, 20, 50],
          onPageChange: (p) => setPage(p),
          onPageSizeChange: (s) => {
            setPageSize(s);
            setPage(1);
          },
        }}
        empty={
          <Empty
            image={<Search size={56} className='text-gray-300' />}
            darkModeImage={<Search size={56} className='text-gray-600' />}
            description={t('暂无工单')}
            style={{ padding: 30 }}
          />
        }
      />

      <TicketDetailDrawer
        visible={!!detailTicket}
        ticket={detailTicket}
        adminMode={true}
        onClose={() => setDetailTicket(null)}
        onChanged={loadTickets}
      />
    </Card>
  );
};

export default AdminTicketPanel;
