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

import React, { useState, useRef } from 'react';
import {
  Avatar,
  Typography,
  Card,
  Button,
  Form,
  Space,
  Row,
  Col,
  Spin,
  Tooltip,
} from '@douyinfe/semi-ui';
import { SiAlipay, SiWechat, SiStripe } from 'react-icons/si';
import { CreditCard, ShoppingCart } from 'lucide-react';
import { API, showError, showSuccess } from '../../helpers';
import { useActualTheme } from '../../context/Theme';

const { Text } = Typography;

function isSafeHttpCheckoutUrl(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return false;
  }
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
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
}) => {
  const actualTheme = useActualTheme();
  const [count, setCount] = useState(1);
  const [paying, setPaying] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('');

  const invitation_code_enabled =
    statusState?.status?.invitation_code_enabled || false;
  const unitPrice = Number(
    statusState?.status?.invitation_code_price || 0,
  );
  const totalPrice = (unitPrice * count).toFixed(2);

  const hasAnyPayment =
    enableOnlineTopUp ||
    enableStripeTopUp ||
    enableCreemTopUp ||
    enableWaffoTopUp ||
    enableWaffoPancakeTopUp;

  if (!invitation_code_enabled) {
    return null;
  }

  const handlePay = async (payment) => {
    setPaying(true);
    setSelectedMethod(payment);

    try {
      if (payment === 'stripe') {
        if (!enableStripeTopUp) {
          showError(t('管理员未开启Stripe充值！'));
          return;
        }
        const res = await API.post('/api/user/stripe/pay', {
          product_type: 'invitation_code',
          count: count,
        });
        if (res.data && res.data.message === 'success') {
          window.open(res.data.data?.pay_link, '_blank');
          showSuccess(t('已打开支付页面'));
        } else {
          const errorMsg =
            typeof res.data?.data === 'string'
              ? res.data.data
              : res.data?.message || t('支付失败');
          showError(errorMsg);
        }
      } else if (payment === 'creem') {
        if (!enableCreemTopUp) {
          showError(t('管理员未开启 Creem 充值！'));
          return;
        }
        const res = await API.post('/api/user/creem/pay', {
          product_type: 'invitation_code',
          count: count,
        });
        if (res.data && res.data.message === 'success') {
          window.open(res.data.data?.checkout_url, '_blank');
          showSuccess(t('已打开支付页面'));
        } else {
          const errorMsg =
            typeof res.data?.data === 'string'
              ? res.data.data
              : res.data?.message || t('支付失败');
          showError(errorMsg);
        }
      } else if (payment.startsWith('waffo:')) {
        if (!enableWaffoTopUp) {
          showError(t('管理员未开启 Waffo 充值！'));
          return;
        }
        const res = await API.post('/api/user/waffo/pay', {
          product_type: 'invitation_code',
          count: count,
        });
        if (res.data && res.data.message === 'success' && res.data.data?.payment_url) {
          window.open(res.data.data.payment_url, '_blank');
          showSuccess(t('已打开支付页面'));
        } else {
          showError(res.data?.data || t('支付请求失败'));
        }
      } else if (payment === 'waffo_pancake') {
        if (!enableWaffoPancakeTopUp) {
          showError(t('管理员未开启 Waffo Pancake 充值！'));
          return;
        }
        const res = await API.post('/api/user/waffo-pancake/pay', {
          product_type: 'invitation_code',
          count: count,
        });
        if (res.data && res.data.message === 'success') {
          const checkoutUrl = res.data?.data?.checkout_url || '';
          if (checkoutUrl && isSafeHttpCheckoutUrl(checkoutUrl)) {
            window.location.href = checkoutUrl;
          } else if (checkoutUrl) {
            showError(t('支付跳转地址不安全'));
          } else {
            showError(t('支付请求失败'));
          }
        } else {
          const errorMsg =
            typeof res.data?.data === 'string'
              ? res.data.data
              : res.data?.message || t('支付请求失败');
          showError(errorMsg);
        }
      } else {
        // EPay
        if (!enableOnlineTopUp) {
          showError(t('管理员未开启在线充值！'));
          return;
        }
        const res = await API.post('/api/user/pay', {
          payment_method: payment,
          product_type: 'invitation_code',
          count: count,
        });
        if (res.data && res.data.message === 'success') {
          const params = res.data.data;
          const url = res.data.url;
          const form = document.createElement('form');
          form.action = url;
          form.method = 'POST';
          const isSafari =
            navigator.userAgent.indexOf('Safari') > -1 &&
            navigator.userAgent.indexOf('Chrome') < 1;
          if (!isSafari) {
            form.target = '_blank';
          }
          for (const key in params) {
            if (Object.prototype.hasOwnProperty.call(params, key)) {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = params[key];
              form.appendChild(input);
            }
          }
          document.body.appendChild(form);
          form.submit();
          document.body.removeChild(form);
        } else {
          const errorMsg =
            typeof res.data?.data === 'string'
              ? res.data.data
              : res.data?.message || t('支付失败');
          showError(errorMsg);
        }
      }
    } catch (err) {
      showError(t('支付请求失败'));
    } finally {
      setPaying(false);
      setSelectedMethod('');
    }
  };

  // Build the list of payment method buttons
  const paymentButtons = [];

  // EPay methods
  if (enableOnlineTopUp) {
    payMethods.forEach((method) => {
      paymentButtons.push({
        type: method.type,
        name: method.name,
        icon: method.type === 'alipay' ? (
          <SiAlipay size={18} color='#1677FF' />
        ) : method.type === 'wxpay' ? (
          <SiWechat size={18} color='#07C160' />
        ) : method.icon ? (
          <img
            src={method.icon}
            alt={method.name}
            style={{ width: 18, height: 18, objectFit: 'contain' }}
          />
        ) : (
          <CreditCard
            size={18}
            color={method.color || 'var(--semi-color-text-2)'}
          />
        ),
        disabled: false,
      });
    });
  }

  // Stripe
  if (enableStripeTopUp) {
    paymentButtons.push({
      type: 'stripe',
      name: 'Stripe',
      icon: <SiStripe size={18} color='#635BFF' />,
      disabled: false,
    });
  }

  // Creem
  if (enableCreemTopUp) {
    paymentButtons.push({
      type: 'creem',
      name: 'Creem',
      icon: (
        <CreditCard
          size={18}
          color='var(--semi-color-text-2)'
        />
      ),
      disabled: false,
    });
  }

  // Waffo methods
  if (enableWaffoTopUp) {
    waffoPayMethods.forEach((method, index) => {
      paymentButtons.push({
        type: `waffo:${index}`,
        name: method.name || 'Waffo',
        icon: method.icon ? (
          <img
            src={method.icon}
            alt={method.name}
            style={{ width: 18, height: 18, objectFit: 'contain' }}
          />
        ) : (
          <CreditCard size={18} color='var(--semi-color-text-2)' />
        ),
        disabled: false,
      });
    });
  }

  // WaffoPancake
  if (enableWaffoPancakeTopUp) {
    paymentButtons.push({
      type: 'waffo_pancake',
      name: 'Waffo Pancake',
      icon: (
        <img
          src={
            actualTheme === 'dark'
              ? '/waffo-logo-dark.svg'
              : '/waffo-logo-light.svg'
          }
          alt='Waffo'
          style={{ width: 18, height: 18, objectFit: 'contain' }}
        />
      ),
      disabled: false,
    });
  }

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='amber' className='mr-3 shadow-md'>
          <ShoppingCart size={16} />
        </Avatar>
        <div>
          <Typography.Text className='text-lg font-medium'>
            {t('购买邀请码')}
          </Typography.Text>
          <div className='text-xs'>
            {t('购买邀请码用于新用户注册')}
          </div>
        </div>
      </div>

      {!hasAnyPayment ? (
        <Text type='tertiary'>{t('管理员未开启在线支付功能')}</Text>
      ) : (
        <Form>
          <div className='space-y-4'>
            <Row gutter={12}>
              <Col xs={24} sm={24} md={24} lg={10} xl={10}>
                <Form.InputNumber
                  field='inviteCodeCount'
                  label={t('购买数量')}
                  value={count}
                  min={1}
                  max={100}
                  step={1}
                  precision={0}
                  onChange={(value) => {
                    if (value && value >= 1) {
                      setCount(value);
                    }
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value);
                    if (!val || val < 1) {
                      setCount(1);
                    } else if (val > 100) {
                      setCount(100);
                    }
                  }}
                  formatter={(value) => (value ? `${value}` : '')}
                  parser={(value) =>
                    value ? parseInt(value.replace(/[^\d]/g, '')) : 0
                  }
                  extraText={
                    <div>
                      <Text type='secondary' size='small'>
                        {t('单价')}: {unitPrice} {t('元')}
                      </Text>
                      <Text
                        type='secondary'
                        size='small'
                        style={{ marginLeft: 12 }}
                      >
                        {t('合计')}: <span style={{ color: 'red' }}>{totalPrice} {t('元')}</span>
                      </Text>
                    </div>
                  }
                  style={{ width: '100%' }}
                />
              </Col>

              {paymentButtons.length > 0 && (
                <Col xs={24} sm={24} md={24} lg={14} xl={14}>
                  <Form.Slot label={t('选择支付方式')}>
                    <Space wrap>
                      {paymentButtons.map((btn) => {
                        const isPaying = paying && selectedMethod === btn.type;
                        return (
                          <Button
                            key={btn.type}
                            theme='outline'
                            type='tertiary'
                            onClick={() => handlePay(btn.type)}
                            disabled={paying}
                            loading={isPaying}
                            icon={btn.icon}
                            className='!rounded-lg !px-4 !py-2'
                          >
                            {btn.name}
                          </Button>
                        );
                      })}
                    </Space>
                  </Form.Slot>
                </Col>
              )}
            </Row>
          </div>
        </Form>
      )}
    </Card>
  );
};

export default BuyInvitationCodesCard;
