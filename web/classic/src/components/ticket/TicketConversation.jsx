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
import { Button, TextArea, Typography, Skeleton, Empty } from '@douyinfe/semi-ui';
import { Send, Headphones, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';
import { formatTicketTime, getTicketStatusDotClass } from './ticketStatus';

const { Text } = Typography;

// 工单会话：加载并展示某工单的回复时间线 + 回复框。
// 用户端与管理端（抽屉）共用；adminMode 时回复走管理接口。
const TicketConversation = ({
  ticketId,
  adminMode = false,
  onUpdated,
  onTicketChange,
  emptyHint,
  emptyAction,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [replies, setReplies] = useState([]);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const loadDetail = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/ticket/${ticketId}`);
      if (res.data.success) {
        setReplies(res.data.data?.replies || []);
        const ticket = res.data.data?.ticket || null;
        setStatus(ticket?.status || '');
        onTicketChange?.(ticket);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    setReplies([]);
    setContent('');
    setStatus('');
    if (ticketId) {
      loadDetail();
    }
  }, [ticketId, loadDetail]);

  const submitReply = async () => {
    const trimmed = (content || '').trim();
    if (!trimmed) {
      showError(t('回复内容不能为空'));
      return;
    }
    setSubmitting(true);
    try {
      const url = adminMode
        ? `/api/ticket/admin/${ticketId}/reply`
        : `/api/ticket/${ticketId}/reply`;
      const res = await API.post(url, { content: trimmed });
      if (res.data.success) {
        showSuccess(t('回复成功'));
        setContent('');
        await loadDetail();
        onUpdated?.();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!ticketId) {
    return (
      <div className='h-full flex flex-col items-center justify-center gap-3 py-16'>
        <div className='w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center'>
          <Headphones size={28} className='text-gray-400' />
        </div>
        <Text strong style={{ fontSize: 16 }}>
          {t('暂无工单')}
        </Text>
        <Text type='tertiary' style={{ textAlign: 'center' }}>
          {emptyHint || t('当你遇到额度、API 错误、退款或平台问题时，可以创建工单。')}
        </Text>
        {emptyAction}
      </div>
    );
  }

  const canReply = status && status !== 'closed';

  return (
    <div className='h-full flex flex-col gap-3'>
      <div className='flex-1 overflow-y-auto flex flex-col gap-3 pr-1'>
        {loading ? (
          <Skeleton active placeholder={<Skeleton.Paragraph rows={6} />} loading />
        ) : (
          replies.map((reply) => (
            <div
              key={reply.id}
              className='rounded-xl border border-gray-200 dark:border-gray-700 p-3'
              style={{ background: reply.is_admin ? 'var(--semi-color-fill-0)' : undefined }}
            >
              <div className='flex items-center gap-2 mb-1 flex-wrap'>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    reply.is_admin ? 'bg-violet-500' : getTicketStatusDotClass('processing')
                  }`}
                />
                <Text strong>{reply.username}</Text>
                {reply.is_admin && (
                  <span className='inline-flex items-center gap-1 text-violet-500 text-xs'>
                    <ShieldCheck size={12} />
                    {t('客服')}
                  </span>
                )}
                <Text type='tertiary' size='small'>
                  {formatTicketTime(reply.created_time)}
                </Text>
              </div>
              <div className='whitespace-pre-wrap break-words text-sm'>
                {reply.content}
              </div>
            </div>
          ))
        )}
        {!loading && replies.length === 0 && (
          <Empty description={t('暂无回复')} style={{ padding: 30 }} />
        )}
      </div>
      <div className='pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2'>
        {canReply ? (
          <>
            <TextArea
              value={content}
              onChange={(v) => setContent(v)}
              placeholder={t('输入回复内容')}
              rows={3}
              maxCount={4000}
            />
            <div className='flex justify-end'>
              <Button
                theme='solid'
                type='primary'
                icon={<Send size={14} />}
                loading={submitting}
                onClick={submitReply}
              >
                {t('发送回复')}
              </Button>
            </div>
          </>
        ) : (
          <Text type='tertiary' size='small'>
            {t('工单已关闭，无法回复')}
          </Text>
        )}
      </div>
    </div>
  );
};

export default TicketConversation;
