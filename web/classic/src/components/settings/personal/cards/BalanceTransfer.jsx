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

import React, { useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Input,
  InputNumber,
  Modal,
  Typography,
} from '@douyinfe/semi-ui';
import { ArrowLeftRight } from 'lucide-react';
import { API, renderQuota, showError, showSuccess } from '../../../../helpers';
import { getQuotaPerUnit } from '../../../../helpers/quota';

const { Text } = Typography;

const TRANSFER_FEE_RATE = 0.03;

const BalanceTransfer = ({ t, userState, onTransferred }) => {
  const [toUserId, setToUserId] = useState('');
  const [toUsername, setToUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentQuota = userState?.user?.quota ?? 0;

  // 与后端一致的换算：金额（美元额度）-> 原生额度，手续费向上取整
  const { transferQuota, feeQuota, totalQuota, insufficient } = useMemo(() => {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return { transferQuota: 0, feeQuota: 0, totalQuota: 0, insufficient: false };
    }
    const quota = Math.round(parsedAmount * getQuotaPerUnit());
    const fee = Math.ceil(quota * TRANSFER_FEE_RATE);
    const total = quota + fee;
    return {
      transferQuota: quota,
      feeQuota: fee,
      totalQuota: total,
      insufficient: total > currentQuota,
    };
  }, [amount, currentQuota]);

  const canSubmit =
    !submitting &&
    toUserId !== '' &&
    toUsername.trim() !== '' &&
    transferQuota > 0 &&
    !insufficient;

  const handleSubmit = () => {
    Modal.confirm({
      title: t('确认转账'),
      content: t(
        '确定向 {{username}}（#{{id}}）转账 {{quota}} 吗？实际扣除 {{total}}（含 3% 手续费 {{fee}}）。',
        {
          username: toUsername.trim(),
          id: toUserId,
          quota: renderQuota(transferQuota),
          total: renderQuota(totalQuota),
          fee: renderQuota(feeQuota),
        },
      ),
      onOk: async () => {
        setSubmitting(true);
        try {
          const res = await API.post('/api/user/transfer', {
            to_user_id: Number(toUserId),
            to_username: toUsername.trim(),
            quota: transferQuota,
          });
          if (res.data.success) {
            const { fee, total } = res.data.data;
            showSuccess(
              t('转账成功：对方到账 {{quota}}，实扣 {{total}}（手续费 {{fee}}）', {
                quota: renderQuota(transferQuota),
                total: renderQuota(total),
                fee: renderQuota(fee),
              }),
            );
            setAmount('');
            onTransferred?.();
          } else {
            showError(res.data.message);
          }
        } catch (e) {
          showError(e.message);
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='blue' className='mr-3 shadow-md'>
          <ArrowLeftRight size={16} />
        </Avatar>
        <div>
          <Typography.Text className='text-lg font-medium'>
            {t('余额转账')}
          </Typography.Text>
          <div className='text-xs text-gray-600 dark:text-gray-400'>
            {t('向其他用户转账余额，3% 手续费由转账人承担')}
          </div>
        </div>
        <div className='ml-auto text-right'>
          <div className='text-xs text-gray-500 dark:text-gray-400'>
            {t('当前余额')}
          </div>
          <Text strong>{renderQuota(currentQuota)}</Text>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div>
          <div className='text-sm mb-2'>
            {t('收款用户 ID')}
          </div>
          <InputNumber
            style={{ width: '100%' }}
            value={toUserId}
            onChange={(v) => setToUserId(v ?? '')}
            placeholder={t('请输入收款用户 ID')}
            min={1}
            precision={0}
            hideButtons
          />
        </div>
        <div>
          <div className='text-sm mb-2'>
            {t('收款用户名')}
          </div>
          <Input
            value={toUsername}
            onChange={(v) => setToUsername(v)}
            placeholder={t('请输入收款用户名')}
            maxLength={64}
          />
        </div>
        <div>
          <div className='text-sm mb-2'>
            {t('转账金额（美元额度）')}
          </div>
          <InputNumber
            style={{ width: '100%' }}
            value={amount}
            onChange={(v) => setAmount(v ?? '')}
            placeholder={t('请输入转账金额')}
            min={0.0001}
            step={0.01}
          />
        </div>
      </div>

      {transferQuota > 0 && (
        <div className='mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm'>
          <Text type='secondary'>
            {t('手续费（3%）')}：{renderQuota(feeQuota)}
          </Text>
          <Text type='secondary'>
            {t('实扣合计')}：{renderQuota(totalQuota)}
          </Text>
          {insufficient && (
            <Text type='danger'>{t('余额不足')}</Text>
          )}
        </div>
      )}

      <div className='mt-4 flex justify-end'>
        <Button
          theme='solid'
          type='primary'
          loading={submitting}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {insufficient && transferQuota > 0 ? t('余额不足') : t('转账')}
        </Button>
      </div>
    </Card>
  );
};

export default BalanceTransfer;
