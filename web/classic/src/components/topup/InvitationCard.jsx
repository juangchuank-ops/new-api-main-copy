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
  Avatar,
  Button,
  Card,
  Empty,
  Modal,
  Pagination,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { Copy, Gift, RefreshCw, Ticket, Trash2, Zap } from 'lucide-react';
import {
  API,
  copy,
  showError,
  showSuccess,
  timestamp2string,
} from '../../helpers';
import { INVITATION_CODE_STATUS } from '../../constants/invitation_code.constants';
import BuyInvitationCodesCard from './BuyInvitationCodesCard';

const { Text } = Typography;

function getInvitationLink(key) {
  if (typeof window === 'undefined') {
    return key;
  }
  const url = new URL('/register', window.location.origin);
  url.searchParams.set('invitation_code', key);
  return url.toString();
}

function getStatusConfig(status, t) {
  if (status === INVITATION_CODE_STATUS.ENABLED) {
    return { color: 'green', label: t('未使用') };
  }
  if (status === INVITATION_CODE_STATUS.USED) {
    return { color: 'grey', label: t('已使用') };
  }
  return { color: 'red', label: t('已禁用') };
}

const InvitationCard = ({
  t,
  userState,
  renderQuota,
  setOpenTransfer,
  statusState,
  payMethods,
  enableOnlineTopUp,
  enableStripeTopUp,
  enableCreemTopUp,
  enableWaffoTopUp,
  waffoPayMethods,
  enableWaffoPancakeTopUp,
  complianceConfirmed = true,
}) => {
  const [invitationCodes, setInvitationCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  const loadInvitationCodes = useCallback(
    async (nextPage = page, nextPageSize = pageSize) => {
      setLoading(true);
      try {
        const response = await API.get(
          `/api/user/invitation-code/?p=${nextPage}&page_size=${nextPageSize}`,
        );
        const { success, message, data } = response.data;
        if (!success) {
          showError(message || t('邀请码列表加载失败'));
          return;
        }
        setInvitationCodes(data?.items || []);
        setTotal(Number(data?.total) || 0);
        if (data?.page) {
          setPage(Number(data.page));
        }
      } catch (error) {
        showError(t('邀请码列表加载失败'));
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, t],
  );

  useEffect(() => {
    void loadInvitationCodes(page, pageSize);
  }, [loadInvitationCodes, page, pageSize]);

  const copyText = async (text, successMessage) => {
    if (await copy(text)) {
      showSuccess(successMessage);
    } else {
      showError(t('无法复制到剪贴板，请手动复制'));
    }
  };

  const copyAllUnused = async () => {
    try {
      const response = await API.get('/api/user/invitation-code/available');
      const { success, message, data } = response.data;
      if (!success) {
        showError(message || t('邀请码列表加载失败'));
        return;
      }
      if (!Array.isArray(data) || data.length === 0) {
        showError(t('暂无未使用的邀请码'));
        return;
      }
      await copyText(data.join('\n'), t('邀请码已复制到剪贴板'));
    } catch (error) {
      showError(t('邀请码列表加载失败'));
    }
  };

  const deleteInvitationCodes = async (ids) => {
    setActionLoading(true);
    try {
      const response = await API.post(
        '/api/user/invitation-code/batch-delete',
        {
          ids,
        },
      );
      const { success, message } = response.data;
      if (!success) {
        showError(message || t('邀请码删除失败'));
        return;
      }
      showSuccess(t('邀请码删除成功'));
      setSelectedIds([]);
      await loadInvitationCodes(page, pageSize);
    } catch (error) {
      showError(t('邀请码删除失败'));
    } finally {
      setActionLoading(false);
    }
  };

  const deleteUsedInvitationCodes = async () => {
    setActionLoading(true);
    try {
      const response = await API.delete('/api/user/invitation-code/used');
      const { success, message } = response.data;
      if (!success) {
        showError(message || t('邀请码删除失败'));
        return;
      }
      showSuccess(t('邀请码删除成功'));
      setSelectedIds([]);
      await loadInvitationCodes(page, pageSize);
    } catch (error) {
      showError(t('邀请码删除失败'));
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = (options) => {
    Modal.confirm({
      ...options,
      onOk: async () => {
        if (!actionLoading) {
          await options.onOk();
        }
      },
    });
  };

  const columns = [
    {
      title: t('邀请码'),
      dataIndex: 'key',
      width: 230,
      render: (value) => (
        <code className='block break-all font-mono text-xs'>{value}</code>
      ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
      render: (value) => {
        const status = getStatusConfig(value, t);
        return <Tag color={status.color}>{status.label}</Tag>;
      },
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_time',
      width: 170,
      render: (value) => timestamp2string(value),
    },
    {
      title: t('操作'),
      dataIndex: 'operate',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            theme='borderless'
            size='small'
            icon={<Copy size={14} />}
            onClick={() =>
              void copyText(
                getInvitationLink(record.key),
                t('邀请码链接已复制到剪贴板'),
              )
            }
          >
            {t('复制链接')}
          </Button>
          <Tooltip content={t('删除邀请码')}>
            <Button
              theme='borderless'
              type='danger'
              size='small'
              icon={<Trash2 size={14} />}
              aria-label={t('删除邀请码')}
              onClick={() =>
                confirmDelete({
                  title: t('确认删除此邀请码？'),
                  content: t('删除后无法恢复，是否继续？'),
                  onOk: () => deleteInvitationCodes([record.id]),
                })
              }
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);
  const pendingRewards = userState?.user?.aff_quota || 0;

  return (
    <Card className='!rounded-none border-0 shadow-sm'>
      <div className='flex flex-wrap items-start justify-between gap-3 p-4 pb-3'>
        <div className='flex items-center'>
          <Avatar size='small' color='green' className='mr-3'>
            <Ticket size={16} />
          </Avatar>
          <div>
            <Typography.Text className='text-lg font-medium'>
              {t('我的邀请码')}
            </Typography.Text>
            <div className='text-xs'>{t('管理用于邀请好友注册的邀请码')}</div>
          </div>
        </div>
        {pendingRewards > 0 && (
          <div className='flex flex-wrap items-center gap-2'>
            <Text type='tertiary' size='small'>
              {t('待转奖励')}: {renderQuota(pendingRewards)}
            </Text>
            <Button
              theme='outline'
              size='small'
              icon={<Zap size={14} />}
              onClick={() => setOpenTransfer(true)}
              disabled={!complianceConfirmed}
            >
              {t('划转到余额')}
            </Button>
          </div>
        )}
      </div>

      <div className='px-4'>
        <BuyInvitationCodesCard
          t={t}
          statusState={statusState}
          payMethods={payMethods}
          enableOnlineTopUp={enableOnlineTopUp}
          enableStripeTopUp={enableStripeTopUp}
          enableCreemTopUp={enableCreemTopUp}
          enableWaffoTopUp={enableWaffoTopUp}
          waffoPayMethods={waffoPayMethods}
          enableWaffoPancakeTopUp={enableWaffoPancakeTopUp}
          paymentComplianceConfirmed={complianceConfirmed}
          onPaymentStarted={() => void loadInvitationCodes(page, pageSize)}
        />
      </div>

      <div className='flex flex-wrap items-center gap-2 px-4 py-3'>
        <Button
          theme='outline'
          size='small'
          icon={<Copy size={14} />}
          onClick={() => void copyAllUnused()}
          disabled={total === 0 || actionLoading}
        >
          {t('复制全部未使用邀请码')}
        </Button>
        <Button
          theme='outline'
          size='small'
          type='warning'
          icon={<Trash2 size={14} />}
          onClick={() =>
            confirmDelete({
              title: t('确认清理已使用的邀请码？'),
              content: t('将永久删除所有已使用的邀请码，此操作不可撤销。'),
              onOk: deleteUsedInvitationCodes,
            })
          }
          disabled={total === 0 || actionLoading}
        >
          {t('清理已使用')}
        </Button>
        <Button
          theme='outline'
          size='small'
          type='danger'
          icon={<Trash2 size={14} />}
          onClick={() =>
            confirmDelete({
              title: t('确认删除选中的邀请码？'),
              content: t('将永久删除 {{count}} 个选中的邀请码。', {
                count: selectedIds.length,
              }),
              onOk: () => deleteInvitationCodes(selectedIds),
            })
          }
          disabled={selectedIds.length === 0 || actionLoading}
        >
          {t('删除选中')}
        </Button>
        <Tooltip content={t('刷新')}>
          <Button
            theme='borderless'
            size='small'
            icon={
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            }
            aria-label={t('刷新')}
            onClick={() => void loadInvitationCodes(page, pageSize)}
            disabled={loading || actionLoading}
          />
        </Tooltip>
        <Text type='tertiary' className='ml-auto text-xs'>
          {t('共 {{count}} 个邀请码', { count: total })}
        </Text>
      </div>

      <div className='overflow-x-auto px-4'>
        <Table
          rowKey='id'
          columns={columns}
          dataSource={invitationCodes}
          loading={loading}
          pagination={false}
          size='small'
          scroll={{ x: 650 }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys.map((key) => Number(key))),
          }}
          empty={
            <Empty description={t('暂无邀请码')} image={<Gift size={36} />} />
          }
        />
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3'>
        <Text type='tertiary' className='text-xs'>
          {t('显示第 {{start}}-{{end}} 条，共 {{total}} 条', {
            start: pageStart,
            end: pageEnd,
            total,
          })}
        </Text>
        <Pagination
          currentPage={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          pageSizeOptions={[10, 20, 50]}
          onPageChange={(nextPage) => {
            setSelectedIds([]);
            setPage(nextPage);
          }}
          onPageSizeChange={(nextPageSize) => {
            setSelectedIds([]);
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </div>
    </Card>
  );
};

export default InvitationCard;
