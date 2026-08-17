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

import React, { useEffect, useState } from 'react';
import {
  SideSheet,
  Typography,
  Divider,
  Tabs,
  TabPane,
} from '@douyinfe/semi-ui';
import { IconClose } from '@douyinfe/semi-icons';
import { Code2, HeartPulse, Info } from 'lucide-react';

import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import ModelHeader from './components/ModelHeader';
import ModelBasicInfo from './components/ModelBasicInfo';
import ModelEndpoints from './components/ModelEndpoints';
import ModelPricingTable from './components/ModelPricingTable';
import DynamicPricingBreakdown from './components/DynamicPricingBreakdown';
import ModelPerformance from './components/ModelPerformance';

const { Text } = Typography;

const TabLabel = ({ icon: Icon, children }) => (
  <span className='flex items-center gap-1.5'>
    <Icon aria-hidden='true' size={15} />
    <span>{children}</span>
  </span>
);

const ModelDetailSideSheet = ({
  visible,
  onClose,
  modelData,
  groupRatio,
  currency,
  siteDisplayType,
  tokenUnit,
  displayPrice,
  showRatio,
  usableGroup,
  vendorsMap,
  endpointMap,
  autoGroups,
  t,
}) => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (visible) setActiveTab('overview');
  }, [visible, modelData?.model_name]);

  return (
    <SideSheet
      placement='right'
      title={
        <ModelHeader modelData={modelData} vendorsMap={vendorsMap} t={t} />
      }
      bodyStyle={{
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        borderBottom: '1px solid var(--semi-color-border)',
      }}
      visible={visible}
      width={isMobile ? '100%' : 820}
      closeIcon={<IconClose aria-label={t('关闭')} />}
      onCancel={onClose}
    >
      <div className='px-4 pt-1 sm:px-6'>
        {!modelData && (
          <div className='flex justify-center items-center py-10'>
            <Text type='secondary'>{t('加载中...')}</Text>
          </div>
        )}
        {modelData && (
          <Tabs
            type='line'
            activeKey={activeTab}
            onChange={setActiveTab}
            lazyRender
            contentStyle={{ paddingTop: 20, paddingBottom: 16 }}
          >
            <TabPane
              tab={<TabLabel icon={Info}>{t('概览')}</TabLabel>}
              itemKey='overview'
            >
              <ModelBasicInfo
                modelData={modelData}
                vendorsMap={vendorsMap}
                t={t}
              />
              {modelData.billing_mode === 'tiered_expr' &&
                modelData.billing_expr && (
                  <>
                    <Divider margin={16} />
                    <DynamicPricingBreakdown
                      billingExpr={modelData.billing_expr}
                      t={t}
                    />
                  </>
                )}
              <Divider margin={16} />
              <ModelPricingTable
                modelData={modelData}
                groupRatio={groupRatio}
                currency={currency}
                siteDisplayType={siteDisplayType}
                tokenUnit={tokenUnit}
                displayPrice={displayPrice}
                showRatio={showRatio}
                usableGroup={usableGroup}
                autoGroups={autoGroups}
                t={t}
              />
            </TabPane>

            <TabPane
              tab={<TabLabel icon={HeartPulse}>{t('性能')}</TabLabel>}
              itemKey='performance'
              className='model-performance-panel'
            >
              <ModelPerformance
                modelData={modelData}
                isActive={activeTab === 'performance'}
                t={t}
              />
            </TabPane>

            <TabPane tab={<TabLabel icon={Code2}>API</TabLabel>} itemKey='api'>
              <ModelEndpoints
                modelData={modelData}
                endpointMap={endpointMap}
                t={t}
              />
            </TabPane>
          </Tabs>
        )}
      </div>
    </SideSheet>
  );
};

export default ModelDetailSideSheet;
