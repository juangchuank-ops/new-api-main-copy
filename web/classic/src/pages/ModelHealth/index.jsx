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

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Spin, Empty, Tag, Typography, Row, Col, Descriptions, Space, Collapse } from '@douyinfe/semi-ui';
import { IconSearch, IconRefresh } from '@douyinfe/semi-icons';
import { API } from '../../helpers';
import { showError, showSuccess } from '../../helpers/utils';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

const ModelHealth = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [range, setRange] = useState('24h');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('success_rate');
  const [expandedModels, setExpandedModels] = useState(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/admin/model-health', {
        params: { range },
      });
      if (res.data.success) {
        setData(res.data.data);
      } else {
        showError(res.data.message || t('加载失败'));
      }
    } catch (error) {
      showError(t('加载模型健康度数据失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [range]);

  const filteredModels = useMemo(() => {
    if (!data?.models) return [];
    let filtered = data.models.filter((model) =>
      model.model_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.model_name.localeCompare(b.model_name);
        case 'success_rate':
          return b.success_rate - a.success_rate;
        case 'tokens':
          return b.total_tokens - a.total_tokens;
        default:
          return 0;
      }
    });

    return filtered;
  }, [data, searchQuery, sortBy]);

  const formatTokens = (tokens) => {
    if (tokens >= 1e9) return `${(tokens / 1e9).toFixed(1)}B`;
    if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(1)}M`;
    if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(1)}K`;
    return tokens.toString();
  };

  const getStatusColor = (rate) => {
    if (rate >= 95) return 'blue';
    if (rate >= 80) return 'green';
    if (rate >= 60) return 'lime';
    if (rate >= 20) return 'orange';
    return 'red';
  };

  const getStatusText = (rate) => {
    if (rate >= 95) return t('优秀');
    if (rate >= 80) return t('良好');
    if (rate >= 60) return t('一般');
    if (rate >= 20) return t('欠佳');
    return t('异常');
  };

  const getTimelineColor = (rate) => {
    if (rate >= 95) return '#0080ff';
    if (rate >= 80) return '#52c41a';
    if (rate >= 60) return '#a0d911';
    if (rate >= 20) return '#fa8c16';
    return '#f5222d';
  };

  const toggleModelExpand = (modelName) => {
    const newExpanded = new Set(expandedModels);
    if (newExpanded.has(modelName)) {
      newExpanded.delete(modelName);
    } else {
      newExpanded.add(modelName);
    }
    setExpandedModels(newExpanded);
  };

  const renderTimeline = (timeline) => {
    const hours = range === '1h' ? 1 : range === '6h' ? 6 : range === '24h' ? 24 : range === '7d' ? 168 : 720;
    const displayTimeline = timeline.slice(-Math.min(24, hours));

    return (
      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
        {displayTimeline.map((point, idx) => {
          const color = point.requests === 0 ? '#d9d9d9' : getTimelineColor(point.success_rate);
          const hour = new Date(point.hour * 1000).getHours();
          return (
            <div
              key={idx}
              style={{
                width: '12px',
                height: '32px',
                backgroundColor: color,
                borderRadius: '2px',
                cursor: 'pointer',
              }}
              title={`${hour}:00 - ${point.success_rate.toFixed(1)}%`}
            />
          );
        })}
      </div>
    );
  };

  if (loading && !data) {
    return (
      <div className='mt-[60px] px-2'>
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size='large' />
        </div>
      </div>
    );
  }

  return (
    <div className='mt-[60px] px-2'>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 0' }}>
        <Title heading={2} style={{ marginBottom: '24px' }}>
          {t('模型健康度')}
        </Title>

        {/* Summary Cards */}
        {data?.summary && (
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={6}>
              <Card style={{ height: '100%' }}>
                <div style={{ marginBottom: '8px' }}>
                  <Text type='secondary'>{t('监控模型数')}</Text>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {data.summary.monitored_models}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <Text size='small' type='tertiary'>
                    {data.summary.healthy_models} {t('健康')}
                  </Text>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ height: '100%' }}>
                <div style={{ marginBottom: '8px' }}>
                  <Text type='secondary'>{t('整体成功率')}</Text>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {data.summary.overall_success_rate.toFixed(2)}%
                </div>
                <div style={{ marginTop: '8px' }}>
                  <Text size='small' type='tertiary'>
                    {t('过去')} {range === '1h' ? '1 ' + t('小时') : range === '24h' ? '24 ' + t('小时') : range}
                  </Text>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ height: '100%' }}>
                <div style={{ marginBottom: '8px' }}>
                  <Text type='secondary'>{t('Token总数')}</Text>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {formatTokens(data.summary.total_tokens)}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <Text size='small' type='tertiary'>
                    {t('过去')} {range === '1h' ? '1 ' + t('小时') : range === '24h' ? '24 ' + t('小时') : range}
                  </Text>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ height: '100%' }}>
                <div style={{ marginBottom: '8px' }}>
                  <Text type='secondary'>{t('优良模型')}</Text>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {data.summary.excellent_models}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <Text size='small' type='tertiary'>
                    {t('成功率')} ≥95%
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>
        )}

        {/* Filters */}
        <Card style={{ marginBottom: '16px' }}>
          <Space spacing='medium' style={{ width: '100%', flexWrap: 'wrap' }}>
            <Input
              prefix={<IconSearch />}
              placeholder={t('搜索模型...')}
              value={searchQuery}
              onChange={setSearchQuery}
              style={{ width: '300px' }}
            />
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: '180px' }}
            >
              <Select.Option value='name'>{t('按名称排序')}</Select.Option>
              <Select.Option value='success_rate'>{t('按成功率排序')}</Select.Option>
              <Select.Option value='tokens'>{t('按Token排序')}</Select.Option>
            </Select>
            <Select value={range} onChange={setRange} style={{ width: '140px' }}>
              <Select.Option value='1h'>1h</Select.Option>
              <Select.Option value='6h'>6h</Select.Option>
              <Select.Option value='24h'>24h</Select.Option>
              <Select.Option value='7d'>7d</Select.Option>
              <Select.Option value='30d'>30d</Select.Option>
            </Select>
            <Button
              icon={<IconRefresh />}
              onClick={fetchData}
              loading={loading}
            >
              {t('刷新')}
            </Button>
          </Space>
        </Card>

        {/* Model List */}
        {filteredModels.length === 0 ? (
          <Card>
            <Empty
              description={
                searchQuery ? t('没有找到匹配的模型') : t('暂无模型数据')
              }
            />
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredModels.map((model) => {
              const isExpanded = expandedModels.has(model.model_name);
              return (
                <Card
                  key={model.model_name}
                  style={{ cursor: 'pointer' }}
                  bodyStyle={{ padding: '16px' }}
                >
                  <div
                    onClick={() => toggleModelExpand(model.model_name)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                      <div style={{ minWidth: '200px' }}>
                        <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                          {model.model_name}
                        </div>
                        <Text size='small' type='tertiary'>
                          {model.success_rate.toFixed(2)}% · {formatTokens(model.total_tokens)}
                        </Text>
                      </div>
                      <Tag color={getStatusColor(model.success_rate)}>
                        {getStatusText(model.success_rate)}
                      </Tag>
                    </div>
                    {renderTimeline(model.timeline)}
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--semi-color-border)' }}>
                      <Row gutter={16}>
                        <Col span={6}>
                          <div>
                            <Text type='secondary'>{t('总请求数')}</Text>
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: '500' }}>
                            {model.total_requests.toLocaleString()}
                          </div>
                        </Col>
                        <Col span={6}>
                          <div>
                            <Text type='secondary'>{t('成功')}</Text>
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: '500', color: '#52c41a' }}>
                            {model.success_count.toLocaleString()}
                          </div>
                        </Col>
                        <Col span={6}>
                          <div>
                            <Text type='secondary'>{t('失败')}</Text>
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: '500', color: '#f5222d' }}>
                            {model.failed_count.toLocaleString()}
                          </div>
                        </Col>
                        <Col span={6}>
                          <div>
                            <Text type='secondary'>{t('平均延迟')}</Text>
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: '500' }}>
                            {model.avg_latency_ms}ms
                          </div>
                        </Col>
                      </Row>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelHealth;
