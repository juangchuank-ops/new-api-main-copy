/*
Copyright (C) 2025 QuantumNous

Enhanced StatsCards - 优化后的统计卡片组件
使用新的设计系统但保持现有的数据结构和功能
*/

import React from 'react';
import { Card, Avatar, Skeleton, Tag } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import VChartErrorBoundary from '../common/VChartErrorBoundary';
import { ensureVChartBrowserEnv } from '../../helpers/vchart-env';
import './StatsCards.css';

const StatsCards = ({
  groupedStatsData,
  loading,
  getTrendSpec,
  CARD_PROPS,
  CHART_CONFIG,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  ensureVChartBrowserEnv();

  return (
    <div className='mb-4'>
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        {groupedStatsData.map((group, idx) => (
          <Card
            key={idx}
            {...CARD_PROPS}
            className={`stat-card-group ${group.color} border-0 !rounded-2xl w-full`}
            title={
              <div className="stat-card-group-title">
                {group.title}
              </div>
            }
          >
            <div className='space-y-4'>
              {group.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className='stat-card-item'
                  onClick={item.onClick}
                >
                  <div className='stat-card-item-main'>
                    <Avatar
                      className='stat-card-avatar'
                      size='small'
                      color={item.avatarColor}
                    >
                      {item.icon}
                    </Avatar>
                    <div className="stat-card-content">
                      <div className='stat-card-label'>{item.title}</div>
                      <div className='stat-card-value-wrapper'>
                        <Skeleton
                          loading={loading}
                          active
                          placeholder={
                            <Skeleton.Paragraph
                              active
                              rows={1}
                              style={{
                                width: '65px',
                                height: '24px',
                                marginTop: '4px',
                              }}
                            />
                          }
                        >
                          <span className="stat-card-value">{item.value}</span>
                        </Skeleton>
                      </div>
                    </div>
                  </div>

                  <div className="stat-card-item-aside">
                    {item.title === t('当前余额') ? (
                      <Tag
                        color='blue'
                        shape='circle'
                        size='small'
                        className="stat-card-action-tag"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/console/topup');
                        }}
                      >
                        {t('充值')}
                      </Tag>
                    ) : (
                      (loading ||
                        (item.trendData && item.trendData.length > 0)) && (
                        <div className='stat-card-chart'>
                          <VChartErrorBoundary>
                            <VChart
                              spec={getTrendSpec(item.trendData, item.trendColor)}
                              option={CHART_CONFIG}
                            />
                          </VChartErrorBoundary>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default StatsCards;
