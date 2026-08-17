import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError } from '../../helpers';
import { Card, Tabs, TabPane, Table, Tag, Spin, Empty, Typography, Space, Select } from '@douyinfe/semi-ui';

const { Text } = Typography;

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

function OverviewTab({ period }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`/api/rankings?period=${period}`);
      const { success, message, data: responseData } = res.data;
      if (success) {
        setData(responseData);
      } else {
        showError(message);
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <Spin />;
  if (!data) return <Empty title={t('暂无数据')} />;

  const modelColumns = [
    { title: '#', dataIndex: 'rank', key: 'rank', width: 60 },
    { title: t('模型'), dataIndex: 'model_name', key: 'model_name' },
    { title: t('供应商'), dataIndex: 'vendor', key: 'vendor' },
    {
      title: t('Tokens'),
      dataIndex: 'total_tokens',
      key: 'total_tokens',
      render: (v) => v?.toLocaleString(),
    },
    {
      title: t('占比'),
      dataIndex: 'share',
      key: 'share',
      render: (v) => `${(v * 100).toFixed(2)}%`,
    },
  ];

  const vendorColumns = [
    { title: '#', dataIndex: 'rank', key: 'rank', width: 60 },
    { title: t('供应商'), dataIndex: 'vendor', key: 'vendor' },
    {
      title: t('Tokens'),
      dataIndex: 'total_tokens',
      key: 'total_tokens',
      render: (v) => v?.toLocaleString(),
    },
    {
      title: t('占比'),
      dataIndex: 'share',
      key: 'share',
      render: (v) => `${(v * 100).toFixed(2)}%`,
    },
    { title: t('模型数'), dataIndex: 'models_count', key: 'models_count' },
    { title: t('Top模型'), dataIndex: 'top_model', key: 'top_model' },
  ];

  return (
    <Space vertical spacing={12} style={{ width: '100%' }}>
      <Card title={t('模型排名')}>
        <Table
          columns={modelColumns}
          dataSource={data.models || []}
          rowKey="model_name"
          pagination={false}
          size="small"
        />
      </Card>
      <Card title={t('供应商排名')}>
        <Table
          columns={vendorColumns}
          dataSource={data.vendors || []}
          rowKey="vendor"
          pagination={false}
          size="small"
        />
      </Card>
    </Space>
  );
}

function AvailabilityTab({ period }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`/api/rankings/availability?period=${period}`);
      const { success, message, data: responseData } = res.data;
      if (success) {
        setData(responseData);
      } else {
        showError(message);
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <Spin />;
  if (!data || !data.models || data.models.length === 0)
    return <Empty title={t('暂无可用性数据')} />;

  const columns = [
    { title: t('模型'), dataIndex: 'model_name', key: 'model_name' },
    { title: t('供应商'), dataIndex: 'vendor', key: 'vendor' },
    {
      title: t('成功率'),
      dataIndex: 'success_rate',
      key: 'success_rate',
      render: (v) => {
        const color = v >= 95 ? 'green' : v >= 80 ? 'orange' : 'red';
        return <Tag color={color}>{v.toFixed(2)}%</Tag>;
      },
    },
    {
      title: t('平均延迟(ms)'),
      dataIndex: 'avg_latency_ms',
      key: 'avg_latency_ms',
      render: (v) => v?.toLocaleString(),
    },
    {
      title: t('请求数'),
      dataIndex: 'request_count',
      key: 'request_count',
      render: (v) => v?.toLocaleString(),
    },
    {
      title: t('近期成功率'),
      dataIndex: 'recent_success_rates',
      key: 'recent_success_rates',
      render: (rates) => {
        if (!rates || rates.length === 0) return '-';
        return (
          <Space>
            {rates.map((r, i) => (
              <Tag key={i} size="small">
                {r.toFixed(1)}%
              </Tag>
            ))}
          </Space>
        );
      },
    },
  ];

  return (
    <Card
      title={t('模型可用性排名')}
      extra={<Text type="tertiary">{t('生成时间')}: {data.generated_at ? new Date(data.generated_at * 1000).toLocaleString() : '-'}</Text>}
    >
      <Table
        columns={columns}
        dataSource={data.models}
        rowKey="model_name"
        pagination={false}
        size="small"
      />
    </Card>
  );
}

function SecurityTab({ period }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`/api/rankings/security?period=${period}`);
      const { success, message, data: responseData } = res.data;
      if (success) {
        setData(responseData);
      } else {
        showError(message);
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <Spin />;
  if (!data) return <Empty title={t('暂无数据')} />;

  const banColumns = [
    { title: t('用户名'), dataIndex: 'username', key: 'username' },
    { title: t('封禁次数'), dataIndex: 'ban_count', key: 'ban_count' },
    {
      title: t('最近封禁'),
      dataIndex: 'latest_ban_at',
      key: 'latest_ban_at',
      render: (v) => (v > 0 ? new Date(v * 1000).toLocaleString() : '-'),
    },
    { title: t('最长封禁(分钟)'), dataIndex: 'longest_ban_minutes', key: 'longest_ban_minutes' },
    { title: t('最近规则'), dataIndex: 'latest_rule', key: 'latest_rule' },
    { title: t('最近状态'), dataIndex: 'latest_status', key: 'latest_status' },
  ];

  const ipColumns = [
    { title: t('用户ID'), dataIndex: 'user_id', key: 'user_id' },
    { title: t('用户名'), dataIndex: 'username', key: 'username' },
    { title: t('IP数'), dataIndex: 'ip_count', key: 'ip_count' },
    {
      title: t('请求数'),
      dataIndex: 'request_count',
      key: 'request_count',
      render: (v) => v?.toLocaleString(),
    },
    {
      title: t('最近活跃'),
      dataIndex: 'last_seen',
      key: 'last_seen',
      render: (v) => (v > 0 ? new Date(v * 1000).toLocaleString() : '-'),
    },
  ];

  return (
    <Space vertical spacing={12} style={{ width: '100%' }}>
      <Card title={t('封禁排名')}>
        {data.bans && data.bans.length > 0 ? (
          <Table
            columns={banColumns}
            dataSource={data.bans}
            rowKey="username"
            pagination={false}
            size="small"
          />
        ) : (
          <Empty title={t('暂无封禁数据（AutoBan 系统未启用）')} />
        )}
      </Card>
      {data.ip_users && (
        <Card title={t('IP 多样性排名')}>
          <Table
            columns={ipColumns}
            dataSource={data.ip_users}
            rowKey="user_id"
            pagination={false}
            size="small"
          />
        </Card>
      )}
    </Space>
  );
}

const Rankings = () => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('week');

  return (
    <div className='mt-[60px] px-2'>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 18 }}>{t('排行榜')}</Text>
          <Select
            value={period}
            onChange={setPeriod}
            style={{ width: 120 }}
            optionList={PERIOD_OPTIONS}
          />
        </div>
        <Tabs type="line">
          <TabPane tab={t('概览')} itemKey="overview">
            <OverviewTab period={period} />
          </TabPane>
          <TabPane tab={t('可用性')} itemKey="availability">
            <AvailabilityTab period={period} />
          </TabPane>
          <TabPane tab={t('安全')} itemKey="security">
            <SecurityTab period={period} />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default Rankings;
