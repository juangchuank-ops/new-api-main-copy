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
  Button,
  InputNumber,
  Modal,
  Space,
  Typography,
} from '@douyinfe/semi-ui';
import { SiAlipay, SiWechat, SiStripe } from 'react-icons/si';
import { CreditCard, Loader2, ShoppingCart } from 'lucide-react';
import { API, showError, showSuccess } from '../../helpers';
import { useActualTheme } from '../../context/Theme';

const { Text } = Typography;

function isSafeHttpCheckoutUrl(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return false;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPaymentSuccess(response) {
  return (
    response?.data?.message === 'success' || response?.data?.success === true
  );
}

function getPaymentError(response, fallback) {
  const data = response?.data?.data;
  if (typeof data === 'string' && data.trim()) {
    return data;
  }
  return response?.data?.message || fallback;
}

function getChannelIcon(channel, actualTheme) {
  if (channel.type === 'alipay') {
    return <SiAlipay size={18} color='#1677FF' />;
  }
  if (channel.type === 'wxpay') {
    return <SiWechat size={18} color='#07C160' />;
  }
  if (channel.type === 'stripe') {
    return <SiStripe size={18} color='#635BFF' />;
  }
  if (channel.type === 'waffo_pancake') {
    return (
      <img
        src={
          actualTheme === 'dark'
            ? '/waffo-logo-dark.svg'
            : '/waffo-logo-light.svg'
        }
        alt='Waffo'
        style={{ width: 18, height: 18, objectFit: 'contain' }}
      />
    );
  }
  if (channel.icon) {
    return (
      <img
        src={channel.icon}
        alt={channel.name}
        style={{ width: 18, height: 18, objectFit: 'contain' }}
      />
    );
  }
  return (
    <CreditCard size={18} color={channel.color || 'var(--semi-color-text-2)'} />
  );
}

function getPaymentChannels({
  payMethods,
  enableOnlineTopUp,
  enableStripeTopUp,
  enableCreemTopUp,
  enableWaffoTopUp,
  waffoPayMethods,
  enableWaffoPancakeTopUp,
  paymentComplianceConfirmed,
}) {
  if (!paymentComplianceConfirmed) {
    return [];
  }

  const channels = [];
  const channelIds = new Set();
  const addChannel = (channel) => {
    if (channelIds.has(channel.id)) {
      return;
    }
    channelIds.add(channel.id);
    channels.push(channel);
  };

  const detailedWaffoMethods =
    enableWaffoTopUp &&
    Array.isArray(waffoPayMethods) &&
    waffoPayMethods.length > 0;
  const specialTypes = new Set(['stripe', 'creem', 'waffo', 'waffo_pancake']);

  if (enableOnlineTopUp) {
    (payMethods || []).forEach((method) => {
      if (
        !method?.type ||
        specialTypes.has(method.type) ||
        method.type.startsWith('waffo:')
      ) {
        return;
      }
      addChannel({
        id: `epay-${method.type}`,
        name: method.name || method.type,
        type: method.type,
        paymentMethod: method.type,
        icon: method.icon,
        color: method.color,
      });
    });
  }

  if (enableStripeTopUp) {
    addChannel({
      id: 'stripe',
      name: 'Stripe',
      type: 'stripe',
    });
  }

  if (enableCreemTopUp) {
    addChannel({
      id: 'creem',
      name: 'Creem',
      type: 'creem',
    });
  }

  if (detailedWaffoMethods) {
    waffoPayMethods.forEach((method, index) => {
      addChannel({
        id: `waffo-${index}`,
        name: method?.name || 'Waffo',
        type: 'waffo',
        payMethodIndex: index,
        icon: method?.icon,
        color: method?.color,
      });
    });
  } else if (enableWaffoTopUp) {
    addChannel({
      id: 'waffo',
      name: 'Waffo',
      type: 'waffo',
    });
  }

  if (enableWaffoPancakeTopUp) {
    addChannel({
      id: 'waffo_pancake',
      name: 'Waffo Pancake',
      type: 'waffo_pancake',
    });
  }

  return channels;
}

const BuyInvitationCodesCard = ({
  t,
  statusState,
  payMethods = [],
  enableOnlineTopUp = false,
  enableStripeTopUp = false,
  enableCreemTopUp = false,
  enableWaffoTopUp = false,
  waffoPayMethods = [],
  enableWaffoPancakeTopUp = false,
  paymentComplianceConfirmed = true,
  onPaymentStarted,
}) => {
  const actualTheme = useActualTheme();
  const [count, setCount] = useState(1);
  const [paying, setPaying] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const invitationCodeEnabled =
    statusState?.status?.invitation_code_enabled === true;
  const unitPrice = Number(statusState?.status?.invitation_code_price || 0);
  const totalPrice = (unitPrice * count).toFixed(2);
  const paymentChannels = useMemo(
    () =>
      getPaymentChannels({
        payMethods,
        enableOnlineTopUp,
        enableStripeTopUp,
        enableCreemTopUp,
        enableWaffoTopUp,
        waffoPayMethods,
        enableWaffoPancakeTopUp,
        paymentComplianceConfirmed,
      }),
    [
      payMethods,
      enableOnlineTopUp,
      enableStripeTopUp,
      enableCreemTopUp,
      enableWaffoTopUp,
      waffoPayMethods,
      enableWaffoPancakeTopUp,
      paymentComplianceConfirmed,
    ],
  );

  const handlePay = async (channel) => {
    setPaying(true);
    setSelectedMethod(channel.id);

    try {
      let response;
      if (channel.type === 'stripe') {
        response = await API.post('/api/user/stripe/pay', {
          payment_method: 'stripe',
          product_type: 'invitation_code',
          count,
        });
        if (!isPaymentSuccess(response) || !response.data?.data?.pay_link) {
          showError(getPaymentError(response, t('支付失败')));
          return false;
        }
        window.open(
          response.data.data.pay_link,
          '_blank',
          'noopener,noreferrer',
        );
      } else if (channel.type === 'creem') {
        response = await API.post('/api/user/creem/pay', {
          payment_method: 'creem',
          product_type: 'invitation_code',
          count,
        });
        if (!isPaymentSuccess(response) || !response.data?.data?.checkout_url) {
          showError(getPaymentError(response, t('支付失败')));
          return false;
        }
        window.open(
          response.data.data.checkout_url,
          '_blank',
          'noopener,noreferrer',
        );
      } else if (channel.type === 'waffo') {
        const requestBody = {
          product_type: 'invitation_code',
          count,
        };
        if (channel.payMethodIndex !== undefined) {
          requestBody.pay_method_index = channel.payMethodIndex;
        }
        response = await API.post('/api/user/waffo/pay', requestBody);
        if (!isPaymentSuccess(response) || !response.data?.data?.payment_url) {
          showError(getPaymentError(response, t('支付请求失败')));
          return false;
        }
        window.open(
          response.data.data.payment_url,
          '_blank',
          'noopener,noreferrer',
        );
      } else if (channel.type === 'waffo_pancake') {
        response = await API.post('/api/user/waffo-pancake/pay', {
          product_type: 'invitation_code',
          count,
        });
        const checkoutUrl = response.data?.data?.checkout_url || '';
        if (!isPaymentSuccess(response) || !checkoutUrl) {
          showError(getPaymentError(response, t('支付请求失败')));
          return false;
        }
        if (!isSafeHttpCheckoutUrl(checkoutUrl)) {
          showError(t('支付跳转地址不安全'));
          return false;
        }
        window.location.href = checkoutUrl;
      } else {
        response = await API.post('/api/user/pay', {
          payment_method: channel.paymentMethod || channel.type,
          product_type: 'invitation_code',
          count,
        });
        if (!isPaymentSuccess(response) || !response.data?.url) {
          showError(getPaymentError(response, t('支付失败')));
          return false;
        }

        const form = document.createElement('form');
        form.action = response.data.url;
        form.method = 'POST';
        const isSafari =
          navigator.userAgent.indexOf('Safari') > -1 &&
          navigator.userAgent.indexOf('Chrome') < 1;
        if (!isSafari) {
          form.target = '_blank';
        }
        Object.entries(response.data.data || {}).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
      }

      showSuccess(t('已打开支付页面'));
      return true;
    } catch (error) {
      showError(t('支付请求失败'));
      return false;
    } finally {
      setPaying(false);
      setSelectedMethod('');
    }
  };

  const startPayment = async (channel) => {
    const started = await handlePay(channel);
    if (started) {
      setPaymentDialogOpen(false);
      onPaymentStarted?.();
    }
  };

  const handlePurchase = () => {
    if (paymentChannels.length === 0) {
      showError(t('暂无可用支付渠道'));
      return;
    }
    if (paymentChannels.length === 1) {
      void startPayment(paymentChannels[0]);
      return;
    }
    setPaymentDialogOpen(true);
  };

  const canPurchase =
    invitationCodeEnabled && unitPrice > 0 && paymentChannels.length > 0;
  const purchaseButton = (
    <Button
      type='primary'
      theme='solid'
      onClick={handlePurchase}
      disabled={!canPurchase || paying}
      loading={paying && paymentChannels.length !== 2}
      icon={
        paying && paymentChannels.length !== 2 ? (
          <Loader2 size={16} className='animate-spin' />
        ) : (
          <ShoppingCart size={16} />
        )
      }
    >
      {t('购买邀请码')}
    </Button>
  );

  const renderChannelButton = (channel) => (
    <Button
      key={channel.id}
      theme='outline'
      type='tertiary'
      onClick={() => void startPayment(channel)}
      disabled={!canPurchase || paying}
      loading={paying && selectedMethod === channel.id}
      icon={getChannelIcon(channel, actualTheme)}
    >
      {channel.name}
    </Button>
  );

  return (
    <div className='flex flex-col gap-3 border-b pb-3'>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex flex-col gap-1'>
          <Text type='secondary' size='small'>
            {t('购买数量')}
          </Text>
          <InputNumber
            value={count}
            min={1}
            max={100}
            step={1}
            precision={0}
            onChange={(value) => {
              const nextValue = Number(value);
              if (Number.isFinite(nextValue)) {
                setCount(Math.max(1, Math.min(100, Math.floor(nextValue))));
              }
            }}
            style={{ width: 120 }}
          />
        </div>
        <Text type='secondary' className='pb-2 text-sm'>
          {t('合计')}: {totalPrice} {t('元')}
        </Text>
        {paymentChannels.length !== 2 && purchaseButton}
      </div>

      {paymentChannels.length === 2 && canPurchase && (
        <div className='flex flex-col gap-2'>
          <Text type='secondary' size='small'>
            {t('选择支付方式')}
          </Text>
          <Space wrap>{paymentChannels.map(renderChannelButton)}</Space>
        </div>
      )}

      {!invitationCodeEnabled && (
        <Text type='tertiary'>{t('邀请码购买暂未开放')}</Text>
      )}
      {invitationCodeEnabled && unitPrice <= 0 && (
        <Text type='tertiary'>{t('请先设置邀请码单价后再购买')}</Text>
      )}
      {invitationCodeEnabled &&
        unitPrice > 0 &&
        paymentChannels.length === 0 && (
          <Text type='tertiary'>
            {t('管理员未开启在线支付功能，请联系管理员配置。')}
          </Text>
        )}

      <Modal
        title={t('选择支付方式')}
        visible={paymentDialogOpen}
        onCancel={() => setPaymentDialogOpen(false)}
        footer={null}
        centered
      >
        <div className='flex flex-wrap gap-2'>
          {paymentChannels.map(renderChannelButton)}
        </div>
      </Modal>
    </div>
  );
};

export default BuyInvitationCodesCard;
