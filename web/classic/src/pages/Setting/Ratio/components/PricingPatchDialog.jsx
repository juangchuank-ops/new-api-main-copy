import React, { useState, useMemo } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Tag,
  Space,
  Typography,
  Divider,
  Spin,
  Empty,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconSend } from '@douyinfe/semi-icons';
import { API, showError, showSuccess, showWarning } from '../../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const PRICING_OPTION_KEYS = [
  { key: 'ModelPrice', label: 'ModelPrice', type: 'number' },
  { key: 'ModelRatio', label: 'ModelRatio', type: 'number' },
  { key: 'CompletionRatio', label: 'CompletionRatio', type: 'number' },
  { key: 'CacheRatio', label: 'CacheRatio', type: 'number' },
  { key: 'CreateCacheRatio', label: 'CreateCacheRatio', type: 'number' },
  { key: 'ImageRatio', label: 'ImageRatio', type: 'number' },
  { key: 'AudioRatio', label: 'AudioRatio', type: 'number' },
  { key: 'AudioCompletionRatio', label: 'AudioCompletionRatio', type: 'number' },
  { key: 'billing_setting.billing_mode', label: 'billing_setting.billing_mode', type: 'string' },
  { key: 'billing_setting.billing_expr', label: 'billing_setting.billing_expr', type: 'string' },
];

const ACTIONS = [
  { value: 'set', label: 'set', needsExpected: true, needsValue: true },
  { value: 'delete', label: 'delete', needsExpected: true, needsValue: false },
  { value: 'set_if_missing', label: 'set_if_missing', needsExpected: false, needsValue: true },
];

function getKeyType(key) {
  const found = PRICING_OPTION_KEYS.find((k) => k.key === key);
  return found ? found.type : 'number';
}

const PricingPatchDialog = ({ visible, onClose, onRefresh }) => {
  const { t } = useTranslation();
  const [operations, setOperations] = useState([
    { key: 'ModelRatio', model: '', action: 'set', value: '', expectedPresent: false, expectedValue: '' },
  ]);
  const [loading, setLoading] = useState(false);

  const addOperation = () => {
    setOperations((prev) => [
      ...prev,
      { key: 'ModelRatio', model: '', action: 'set', value: '', expectedPresent: false, expectedValue: '' },
    ]);
  };

  const removeOperation = (index) => {
    setOperations((prev) => prev.filter((_, i) => i !== index));
  };

  const updateOperation = (index, field, value) => {
    setOperations((prev) =>
      prev.map((op, i) => (i === index ? { ...op, [field]: value } : op)),
    );
  };

  const buildPayload = useMemo(() => {
    const ops = operations
      .filter((op) => op.model.trim() !== '')
      .map((op) => {
        const keyType = getKeyType(op.key);
        const payload = {
          key: op.key,
          model: op.model.trim(),
          action: op.action,
        };

        if (op.action !== 'delete') {
          if (keyType === 'string') {
            payload.value = op.value;
          } else {
            const num = parseFloat(op.value);
            if (isNaN(num)) return null;
            payload.value = num;
          }
        }

        const actionConfig = ACTIONS.find((a) => a.value === op.action);
        if (actionConfig?.needsExpected) {
          payload.expected = { present: op.expectedPresent };
          if (op.expectedPresent) {
            if (keyType === 'string') {
              payload.expected.value = op.expectedValue;
            } else {
              const num = parseFloat(op.expectedValue);
              if (isNaN(num)) return null;
              payload.expected.value = num;
            }
          }
        }

        return payload;
      })
      .filter(Boolean);

    return { operations: ops };
  }, [operations]);

  const handleSubmit = async () => {
    if (!buildPayload.operations.length) {
      showWarning(t('请至少填写一个有效操作'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.patch('/api/option/pricing/patch', buildPayload);
      if (res.data?.success) {
        showSuccess(t('Pricing Patch 应用成功'));
        onClose();
        if (onRefresh) onRefresh();
      } else {
        showError(res.data?.message || t('应用失败'));
      }
    } catch (err) {
      if (err.response?.status === 409) {
        showError(t('CAS 冲突：数据已被其他操作修改，请刷新后重试'));
      } else if (err.response?.status === 400) {
        showError(err.response?.data?.message || t('请求参数错误'));
      } else {
        showError(err.response?.data?.message || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderOperation = (op, index) => {
    const actionConfig = ACTIONS.find((a) => a.value === op.action);
    const keyType = getKeyType(op.key);

    return (
      <div
        key={index}
        style={{
          border: '1px solid var(--semi-color-border)',
          borderRadius: 6,
          padding: 12,
          marginBottom: 8,
        }}
      >
        <Space align='start' style={{ width: '100%' }} wrapping>
          <Select
            style={{ width: 200 }}
            value={op.key}
            onChange={(v) => updateOperation(index, 'key', v)}
            optionList={PRICING_OPTION_KEYS.map((k) => ({
              label: k.label,
              value: k.key,
            }))}
          />
          <Input
            style={{ width: 160 }}
            placeholder={t('模型名称')}
            value={op.model}
            onChange={(v) => updateOperation(index, 'model', v)}
          />
          <Select
            style={{ width: 140 }}
            value={op.action}
            onChange={(v) => updateOperation(index, 'action', v)}
            optionList={ACTIONS.map((a) => ({
              label: a.label,
              value: a.value,
            }))}
          />
          {actionConfig?.needsValue && (
            <Input
              style={{ width: 120 }}
              placeholder={keyType === 'string' ? t('字符串值') : t('数值')}
              value={op.value}
              onChange={(v) => updateOperation(index, 'value', v)}
            />
          )}
          {operations.length > 1 && (
            <Button
              icon={<IconDelete />}
              type='danger'
              theme='borderless'
              onClick={() => removeOperation(index)}
            />
          )}
        </Space>

        {actionConfig?.needsExpected && (
          <div style={{ marginTop: 8 }}>
            <Space>
              <Text type='tertiary' size='small'>
                {t('Expected (CAS)')}:
              </Text>
              <Select
                style={{ width: 120 }}
                size='small'
                value={op.expectedPresent}
                onChange={(v) => updateOperation(index, 'expectedPresent', v)}
                optionList={[
                  { label: t('不存在'), value: false },
                  { label: t('存在'), value: true },
                ]}
              />
              {op.expectedPresent && (
                <Input
                  style={{ width: 120 }}
                  size='small'
                  placeholder={keyType === 'string' ? t('期望值') : t('期望数值')}
                  value={op.expectedValue}
                  onChange={(v) => updateOperation(index, 'expectedValue', v)}
                />
              )}
            </Space>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <span>{t('Pricing Patch')}</span>
          <Tag size='small' color='blue'>
            CAS
          </Tag>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      width={720}
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button
            icon={<IconPlus />}
            theme='borderless'
            onClick={addOperation}
          >
            {t('添加操作')}
          </Button>
          <Space>
            <Button onClick={onClose}>{t('取消')}</Button>
            <Button
              theme='solid'
              type='primary'
              icon={<IconSend />}
              loading={loading}
              onClick={handleSubmit}
            >
              {t('提交 Patch')}
            </Button>
          </Space>
        </Space>
      }
    >
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {operations.length === 0 ? (
          <Empty description={t('暂无操作')} />
        ) : (
          operations.map((op, index) => renderOperation(op, index))
        )}
      </div>
      <Divider margin={12} />
      <Text type='tertiary' size='small'>
        {t('所有操作将在单个事务中原子提交。如果任何操作的 expected 值与数据库不匹配，整个 patch 将被拒绝 (409 Conflict)。')}
      </Text>
    </Modal>
  );
};

export default PricingPatchDialog;
