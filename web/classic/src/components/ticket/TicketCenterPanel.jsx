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
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  Pagination,
} from '@douyinfe/semi-ui';
import {
  Plus,
  RefreshCw,
  Headphones,
  Filter,
  Search,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';
import {
  getTicketStatusLabel,
  getTicketStatusColor,
  getTicketStatusDotClass,
  formatTicketTime,
  TICKET_STATUS_KEYS,
} from './ticketStatus';
import TicketConversation from './TicketConversation';

const { Text, Title } = Typography;

const PAGE_SIZE = 20;

// 用户工单中心：顶栏（搜索/筛选/仅未读/刷新/新建）+ 左列表 + 右会话详情
const TicketCenterPanel = () => {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        p: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (statusFilter) params.set('status', statusFilter);
      if (keyword) params.set('keyword', keyword);
      if (unreadOnly) params.set('unread', 'true');
      const res = await API.get(`/api/ticket/self?${params.toString()}`);
      if (res.data.success) {
        setTickets(res.data.data?.items || []);
        setTotal(res.data.data?.total || 0);
        setStats(res.data.data?.stats || {});
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, keyword, unreadOnly]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleSelect = (ticket) => {
    setSelectedId(ticket.id);
    // 打开详情后端会记为已读，本地同步去掉未读点
    setTickets((prev) =>
      prev.map((item) => (item.id === ticket.id ? { ...item, unread: false } : item)),
    );
  };

  const applySearch = (value) => {
    setPage(1);
    setKeyword(value.trim());
  };

  const statusOptions = [
    { value: '', label: t('全部工单') },
    ...TICKET_STATUS_KEYS.map((key) => ({
      value: key,
      label: getTicketStatusLabel(key, t),
    })),
  ];

  const statPills = ['processing', 'waiting', 'resolved'].map((key) => (
    <div
      key={key}
      className='flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs'
    >
      <span className={`inline-block w-2 h-2 rounded-full ${getTicketStatusDotClass(key)}`} />
      <span>{getTicketStatusLabel(key, t)}</span>
      <Text type='tertiary'>{stats[key] || 0}</Text>
    </div>
  ));

  const submitCreate = async (values) => {
    setCreating(true);
    try {
      const res = await API.post('/api/ticket/', {
        title: values.title,
        content: values.content,
      });
      if (res.data.success) {
        showSuccess(t('工单提交成功'));
        setCreateVisible(false);
        setPage(1);
        loadTickets();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const emptyState = (
    <div className='h-full flex flex-col items-center justify-center gap-3 py-16'>
      <div className='w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center'>
        <Headphones size={28} className='text-gray-400' />
      </div>
      <Text strong style={{ fontSize: 16 }}>
        {t('暂无工单')}
      </Text>
      <Text type='tertiary' style={{ textAlign: 'center' }}>
        {t('当你遇到额度、API 错误、退款或平台问题时，可以创建工单。')}
      </Text>
      <Button icon={<Plus size={14} />} onClick={() => setCreateVisible(true)}>
        {t('新建工单')}
      </Button>
    </div>
  );

  const selectedTicket = tickets.find((item) => item.id === selectedId) || null;

  return (
    <div className='flex flex-col gap-4'>
      {/* 顶栏：标题 + 搜索/筛选/仅未读/刷新/新建 */}
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Title heading={5} style={{ margin: 0 }}>
          {t('工单中心')}
        </Title>
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            prefix={<Search size={14} />}
            placeholder={t('搜索工单')}
            value={searchKeyword}
            onChange={(v) => {
              setSearchKeyword(v);
              if (v === '') applySearch('');
            }}
            onEnterPress={() => applySearch(searchKeyword)}
            showClear
            style={{ width: 200 }}
          />
          <Select
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            optionList={statusOptions}
            style={{ width: 140 }}
          />
          <Button
            icon={<Filter size={14} />}
            theme={unreadOnly ? 'solid' : 'light'}
            type={unreadOnly ? 'primary' : 'tertiary'}
            onClick={() => {
              setUnreadOnly(!unreadOnly);
              setPage(1);
            }}
          >
            {t('仅未读')}
          </Button>
          <Button
            icon={<RefreshCw size={14} />}
            theme='light'
            type='tertiary'
            loading={loading}
            onClick={loadTickets}
          />
          <Button
            theme='solid'
            type='primary'
            icon={<Plus size={14} />}
            onClick={() => setCreateVisible(true)}
          >
            {t('新建工单')}
          </Button>
        </div>
      </div>

      {/* 双栏：左列表 + 右详情 */}
      <div className='grid grid-cols-1 lg:grid-cols-[minmax(320px,400px)_1fr] gap-4 items-start'>
        <Card className='!rounded-2xl shadow-sm border-0 overflow-hidden' bodyStyle={{ padding: 0 }}>
          <div className='px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between'>
            <Text strong>{t('我的工单')}</Text>
            <Tag size='small' color='grey' type='light'>
              {t('已加载')} {tickets.length} {t('条')}
            </Tag>
          </div>
          <div className='px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-wrap'>
            {statPills}
          </div>
          <div
            className='overflow-y-auto'
            style={{ height: 'calc(100vh - 350px)', minHeight: 380 }}
          >
            {tickets.length === 0 ? (
              emptyState
            ) : (
              tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => handleSelect(ticket)}
                  className='px-4 py-3 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                  style={{
                    background:
                      ticket.id === selectedId
                        ? 'var(--semi-color-primary-light-default)'
                        : undefined,
                  }}
                >
                  <div className='flex items-center justify-between gap-2'>
                    <div className='flex items-center gap-2 min-w-0'>
                      {ticket.unread && (
                        <span className='inline-block w-2 h-2 rounded-full bg-blue-500 shrink-0' />
                      )}
                      <Text
                        strong={!!ticket.unread}
                        ellipsis={{ showTooltip: true }}
                        style={{ maxWidth: 220 }}
                      >
                        {ticket.title}
                      </Text>
                    </div>
                    <Tag color={getTicketStatusColor(ticket.status)} size='small'>
                      {getTicketStatusLabel(ticket.status, t)}
                    </Tag>
                  </div>
                  <div className='mt-1'>
                    <Text type='tertiary' size='small'>
                      {formatTicketTime(ticket.updated_time)}
                    </Text>
                  </div>
                </div>
              ))
            )}
          </div>
          {total > PAGE_SIZE && (
            <div className='px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex justify-center'>
              <Pagination
                simple
                totalPages={Math.ceil(total / PAGE_SIZE)}
                currentPage={page}
                pageSize={PAGE_SIZE}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </Card>

        <Card
          className='!rounded-2xl shadow-sm border-0 overflow-hidden'
          bodyStyle={{ padding: 16, height: '100%' }}
        >
          {selectedTicket ? (
            <div
              className='flex flex-col gap-3'
              style={{ height: 'calc(100vh - 350px)', minHeight: 380 }}
            >
              <div className='flex items-center justify-between gap-2 pb-3 border-b border-gray-200 dark:border-gray-700'>
                <div className='flex items-center gap-2 min-w-0'>
                  <Text strong ellipsis={{ showTooltip: true }} style={{ maxWidth: 400 }}>
                    {selectedTicket.title}
                  </Text>
                  <Tag color={getTicketStatusColor(selectedTicket.status)} size='small'>
                    {getTicketStatusLabel(selectedTicket.status, t)}
                  </Tag>
                </div>
                <Text type='tertiary' size='small'>
                  {formatTicketTime(selectedTicket.created_time)}
                </Text>
              </div>
              <div className='flex-1 min-h-0'>
                <TicketConversation
                  ticketId={selectedId}
                  adminMode={false}
                  onUpdated={loadTickets}
                />
              </div>
            </div>
          ) : (
            emptyState
          )}
        </Card>
      </div>

      <Modal
        title={t('新建工单')}
        visible={createVisible}
        onCancel={() => setCreateVisible(false)}
        footer={null}
        closeOnEsc
      >
        <div className='flex items-center gap-2 mb-4 text-sm text-gray-500'>
          <Headphones size={16} />
          {t('当你遇到额度、API 错误、退款或平台问题时，可以提交工单')}
        </div>
        <Form onSubmit={submitCreate}>
          <Form.Input
            field='title'
            label={t('标题')}
            placeholder={t('请简要描述你的问题')}
            rules={[{ required: true, message: t('工单标题不能为空') }]}
            maxLength={200}
            showClear
          />
          <Form.TextArea
            field='content'
            label={t('内容')}
            placeholder={t('请详细描述问题、复现步骤或报错信息')}
            rows={6}
            maxLength={4000}
            rules={[{ required: true, message: t('工单内容不能为空') }]}
          />
          <div className='flex justify-end gap-2 mt-2'>
            <Button onClick={() => setCreateVisible(false)}>{t('取消')}</Button>
            <Button theme='solid' type='primary' htmlType='submit' loading={creating}>
              {t('提交工单')}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default TicketCenterPanel;
