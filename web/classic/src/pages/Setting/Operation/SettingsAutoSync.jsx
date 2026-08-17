import React, { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Col,
  Form,
  Row,
  Spin,
  Switch,
  Typography,
  Tag,
  Divider,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../helpers';

const { Text, Title } = Typography;

export default function SettingsAutoSync() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);
  const [savingModel, setSavingModel] = useState(false);

  // Auto Price Sync state
  const [priceEnabled, setPriceEnabled] = useState(false);
  const [priceSourceKind, setPriceSourceKind] = useState('official');
  const [priceSourceChannelID, setPriceSourceChannelID] = useState('');
  const [priceStatus, setPriceStatus] = useState(null);

  // Auto Model Metadata Sync state
  const [modelEnabled, setModelEnabled] = useState(false);
  const [modelStatus, setModelStatus] = useState(null);

  const fetchPriceStatus = useCallback(async () => {
    try {
      const res = await API.get('/api/auto_sync/price');
      const { success, message, data } = res.data;
      if (success && data) {
        setPriceEnabled(data.config?.enabled || false);
        if (data.config?.source) {
          setPriceSourceKind(data.config.source.kind || 'official');
          setPriceSourceChannelID(
            data.config.source.channel_id ? String(data.config.source.channel_id) : '',
          );
        }
        setPriceStatus(data.status || null);
      } else if (message) {
        showError(message);
      }
    } catch (error) {
      // silent fail on initial load
    }
  }, []);

  const fetchModelStatus = useCallback(async () => {
    try {
      const res = await API.get('/api/auto_sync/model');
      const { success, message, data } = res.data;
      if (success && data) {
        setModelEnabled(data.enabled || false);
        setModelStatus(data.status || null);
      } else if (message) {
        showError(message);
      }
    } catch (error) {
      // silent fail on initial load
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPriceStatus(), fetchModelStatus()]);
    setLoading(false);
  }, [fetchPriceStatus, fetchModelStatus]);

  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  async function savePriceConfig() {
    setSavingPrice(true);
    try {
      const source = { kind: priceSourceKind };
      if (priceSourceKind === 'real_channel' && priceSourceChannelID) {
        source.channel_id = parseInt(priceSourceChannelID, 10);
      }
      const res = await API.put('/api/auto_sync/price', {
        enabled: priceEnabled,
        source,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('Auto Price Sync 配置已保存'));
        await fetchPriceStatus();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('保存失败'));
    } finally {
      setSavingPrice(false);
    }
  }

  async function saveModelConfig() {
    setSavingModel(true);
    try {
      const res = await API.put('/api/auto_sync/model', {
        enabled: modelEnabled,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('Auto Model Sync 配置已保存'));
        await fetchModelStatus();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('保存失败'));
    } finally {
      setSavingModel(false);
    }
  }

  function renderTaskStatus(status) {
    if (!status) return null;
    return (
      <div style={{ marginTop: 8 }}>
        {status.pending_events > 0 && (
          <Tag color='orange' style={{ marginRight: 8 }}>
            {t('待处理事件')}: {status.pending_events}
          </Tag>
        )}
        {status.running && (
          <Tag color='blue' style={{ marginRight: 8 }}>
            {t('运行中')}: {status.running.task_id?.substring(0, 8)}
          </Tag>
        )}
        {status.latest && (
          <Tag
            color={status.latest.status === 'succeeded' ? 'green' : 'red'}
            style={{ marginRight: 8 }}
          >
            {t('最近')}: {status.latest.status}
          </Tag>
        )}
        {status.due_at > 0 && (
          <Text type='tertiary' size='small'>
            {t('到期时间')}: {new Date(status.due_at * 1000).toLocaleString()}
          </Text>
        )}
      </div>
    );
  }

  return (
    <Spin spinning={loading}>
      <Form.Section text={t('Auto Sync 自动同步')}>
        {/* Auto Price Sync */}
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>{t('自动价格同步')}</Text>
              <Switch
                checked={priceEnabled}
                onChange={setPriceEnabled}
                style={{ marginLeft: 12 }}
                size='small'
              />
            </div>
            <Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
              {t('启用后，新建渠道缺少基础定价时自动从定价源获取并填充')}
            </Text>
          </Col>
        </Row>

        {priceEnabled && (
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Select
                field='priceSourceKind'
                label={t('定价源类型')}
                style={{ width: '100%' }}
                value={priceSourceKind}
                onChange={setPriceSourceKind}
                optionList={[
                  { label: 'Official (官方)', value: 'official' },
                  { label: 'Models.dev', value: 'models_dev' },
                  { label: 'Real Channel (真实渠道)', value: 'real_channel' },
                ]}
              />
            </Col>
            {priceSourceKind === 'real_channel' && (
              <Col xs={24} sm={12} md={8}>
                <Form.Input
                  field='priceSourceChannelID'
                  label={t('渠道 ID')}
                  placeholder={t('输入渠道 ID')}
                  value={priceSourceChannelID}
                  onChange={setPriceSourceChannelID}
                />
              </Col>
            )}
          </Row>
        )}

        {priceEnabled && renderTaskStatus(priceStatus)}

        <Row style={{ marginTop: 12 }}>
          <Button
            type='primary'
            loading={savingPrice}
            onClick={savePriceConfig}
          >
            {t('保存价格同步配置')}
          </Button>
        </Row>

        <Divider margin='12px' />

        {/* Auto Model Metadata Sync */}
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>{t('自动模型元数据同步')}</Text>
              <Switch
                checked={modelEnabled}
                onChange={setModelEnabled}
                style={{ marginLeft: 12 }}
                size='small'
              />
            </div>
            <Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
              {t('启用后，渠道变更时自动同步模型元数据（旧版降级模式：仅消费事件）')}
            </Text>
          </Col>
        </Row>

        {modelEnabled && renderTaskStatus(modelStatus)}

        <Row style={{ marginTop: 12 }}>
          <Button
            type='primary'
            loading={savingModel}
            onClick={saveModelConfig}
          >
            {t('保存模型同步配置')}
          </Button>
        </Row>
      </Form.Section>
    </Spin>
  );
}
