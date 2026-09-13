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

import React from 'react';
import {
  Button,
  Input,
  Modal,
  Space,
  Spin,
  Switch,
  Tabs,
  TabPane,
  Typography,
} from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { Activity, Upload } from 'lucide-react';
import CardPro from '../../common/ui/CardPro';
import { createCardProPagination } from '../../../helpers/utils';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { useTaskPluginsData } from '../../../hooks/task-plugins/useTaskPluginsData';
import TaskPluginsTable from './TaskPluginsTable';
import TaskPluginDetail from './TaskPluginDetail';
import TaskPluginUploadModal from './TaskPluginUploadModal';
import TaskPluginMarketplacePanel from './TaskPluginMarketplacePanel';

const { Text } = Typography;

const TaskPluginsPage = () => {
  const data = useTaskPluginsData();
  const isMobile = useIsMobile();

  const {
    t,
    activeTab,
    setActiveTab,
    keyword,
    setKeyword,
    pluginSystemEnabled,
    enabledLoading,
    savePluginSystemEnabled,
    openUpload,
    openRuntimeStatus,
    runtimeVisible,
    setRuntimeVisible,
    runtimeStatus,
    runtimeLoading,
    activePage,
    pageSize,
    total,
    handlePageChange,
    handlePageSizeChange,
  } = data;

  const actionsArea = (
    <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full'>
      <Space>
        <Switch
          size='small'
          checked={pluginSystemEnabled}
          loading={enabledLoading}
          onChange={savePluginSystemEnabled}
        />
        <Text>{t('启用任务插件系统')}</Text>
      </Space>
      <Space>
        <Button
          size='small'
          icon={<Activity size={14} />}
          onClick={openRuntimeStatus}
        >
          {t('运行时状态')}
        </Button>
        {activeTab === 'installed' ? (
          <Button
            size='small'
            theme='solid'
            type='primary'
            icon={<Upload size={14} />}
            onClick={() => openUpload()}
          >
            {t('上传插件')}
          </Button>
        ) : null}
      </Space>
    </div>
  );

  const tabsArea = (
    <Tabs type='button' activeKey={activeTab} onChange={setActiveTab}>
      <TabPane itemKey='installed' tab={t('已安装')} />
      <TabPane itemKey='marketplace' tab={t('插件市场')} />
    </Tabs>
  );

  const searchArea =
    activeTab === 'installed' ? (
      <Input
        prefix={<IconSearch />}
        placeholder={t('搜索插件名称 / Key / 作者')}
        value={keyword}
        showClear
        pure
        size='small'
        onChange={setKeyword}
      />
    ) : null;

  return (
    <>
      <TaskPluginUploadModal {...data} />
      <TaskPluginDetail {...data} />

      <Modal
        title={t('任务插件运行时状态')}
        visible={runtimeVisible}
        onCancel={() => setRuntimeVisible(false)}
        footer={null}
        width={isMobile ? '100%' : 720}
      >
        {runtimeLoading ? (
          <div className='flex justify-center py-6'>
            <Spin />
          </div>
        ) : (
          <pre
            className='m-0 overflow-auto rounded-lg p-3'
            style={{
              maxHeight: '60vh',
              backgroundColor: 'var(--semi-color-fill-0)',
              fontFamily: 'var(--semi-font-family-mono)',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {runtimeStatus
              ? JSON.stringify(runtimeStatus, null, 2)
              : t('暂无数据')}
          </pre>
        )}
      </Modal>

      <CardPro
        type='type3'
        tabsArea={tabsArea}
        actionsArea={actionsArea}
        searchArea={searchArea}
        paginationArea={
          activeTab === 'installed'
            ? createCardProPagination({
                currentPage: activePage,
                pageSize,
                total,
                onPageChange: handlePageChange,
                onPageSizeChange: handlePageSizeChange,
                isMobile,
                t,
              })
            : null
        }
        t={t}
      >
        {activeTab === 'installed' ? (
          <TaskPluginsTable {...data} />
        ) : (
          <TaskPluginMarketplacePanel {...data} />
        )}
      </CardPro>
    </>
  );
};

export default TaskPluginsPage;
