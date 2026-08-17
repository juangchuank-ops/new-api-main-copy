/*
Copyright (C) 2025 QuantumNous
Enhanced Channels Actions - 添加表格密度切换
*/

import React from 'react';
import {
  Button,
  Dropdown,
  Modal,
  Switch,
  Typography,
  Select,
  Space,
} from '@douyinfe/semi-ui';
import CompactModeToggle from '../../common/ui/CompactModeToggle';
import { TableDensitySwitcher } from '../../enhanced';

const ChannelsActionsEnhanced = ({
  enableBatchDelete,
  batchDeleteChannels,
  setShowBatchSetTag,
  testAllChannels,
  fixChannelsAbilities,
  updateAllChannelsBalance,
  deleteAllDisabledChannels,
  applyAllUpstreamUpdates,
  detectAllUpstreamUpdates,
  detectAllUpstreamUpdatesLoading,
  applyAllUpstreamUpdatesLoading,
  compactMode,
  setCompactMode,
  idSort,
  setIdSort,
  setEnableBatchDelete,
  enableTagMode,
  setEnableTagMode,
  statusFilter,
  setStatusFilter,
  getFormValues,
  loadChannels,
  searchChannels,
  activeTypeKey,
  activePage,
  pageSize,
  setActivePage,
  t,
  // 新增：表格密度状态
  tableDensity = 'default',
  setTableDensity,
}) => {
  // 表格密度切换处理
  const handleDensityChange = (newDensity) => {
    setTableDensity(newDensity);
    // 保存到 localStorage
    localStorage.setItem('channels-table-density', newDensity);
  };

  return (
    <div className='flex flex-col gap-2'>
      {/* 第一行：批量操作按钮 + 设置开关 + 密度切换 */}
      <div className='flex flex-col md:flex-row justify-between gap-2'>
        {/* 左侧：批量操作按钮 */}
        <div className='flex flex-wrap md:flex-nowrap items-center gap-2 w-full md:w-auto order-2 md:order-1'>
          <Button
            size='small'
            disabled={!enableBatchDelete}
            type='danger'
            className='w-full md:w-auto'
            onClick={() => {
              Modal.confirm({
                title: t('确定是否要删除所选通道？'),
                content: t('此修改将不可逆'),
                onOk: () => batchDeleteChannels(),
              });
            }}
          >
            {t('删除所选通道')}
          </Button>
          <Button
            size='small'
            disabled={!enableBatchDelete}
            className='w-full md:w-auto'
            onClick={() => setShowBatchSetTag(true)}
          >
            {t('设置分组')}
          </Button>
          <Dropdown
            trigger='click'
            position='bottomLeft'
            render={
              <Dropdown.Menu>
                <Dropdown.Item onClick={testAllChannels}>
                  {t('测试所有通道')}
                </Dropdown.Item>
                <Dropdown.Item onClick={fixChannelsAbilities}>
                  {t('修复所有通道模型支持')}
                </Dropdown.Item>
                <Dropdown.Item onClick={updateAllChannelsBalance}>
                  {t('更新所有已启用通道余额')}
                </Dropdown.Item>
                <Dropdown.Item onClick={deleteAllDisabledChannels}>
                  {t('删除所有已禁用通道')}
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={detectAllUpstreamUpdates}
                  disabled={detectAllUpstreamUpdatesLoading}
                >
                  {t('检测所有渠道上游变更')}
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={applyAllUpstreamUpdates}
                  disabled={applyAllUpstreamUpdatesLoading}
                >
                  {t('应用所有渠道上游变更')}
                </Dropdown.Item>
              </Dropdown.Menu>
            }
          >
            <Button size='small' className='w-full md:w-auto'>
              {t('更多')}
            </Button>
          </Dropdown>
        </div>

        {/* 右侧：设置开关 + 密度切换 */}
        <div className='flex flex-wrap md:flex-nowrap items-center justify-end gap-2 order-1 md:order-2'>
          <Typography.Text>{t('紧凑模式')}:</Typography.Text>
          <CompactModeToggle
            compactMode={compactMode}
            setCompactMode={setCompactMode}
          />

          {/* 表格密度切换器 */}
          {setTableDensity && (
            <>
              <div className="hidden md:block" style={{ height: '20px', width: '1px', backgroundColor: 'var(--semi-color-border)' }} />
              <TableDensitySwitcher
                density={tableDensity}
                onChange={handleDensityChange}
              />
            </>
          )}
        </div>
      </div>

      {/* 第二行：其他开关和选择器 */}
      <div className='flex flex-col md:flex-row gap-2 items-start md:items-center'>
        <div className='flex flex-wrap items-center gap-2'>
          <Typography.Text>{t('启用批量删除')}:</Typography.Text>
          <Switch checked={enableBatchDelete} onChange={setEnableBatchDelete} />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Typography.Text>{t('按ID排序')}:</Typography.Text>
          <Select
            value={idSort}
            onChange={setIdSort}
            style={{ width: 100 }}
            size='small'
          >
            <Select.Option value='asc'>{t('升序')}</Select.Option>
            <Select.Option value='desc'>{t('降序')}</Select.Option>
          </Select>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Typography.Text>{t('启用批量编辑分组')}:</Typography.Text>
          <Switch checked={enableTagMode} onChange={setEnableTagMode} />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Typography.Text>{t('状态筛选')}:</Typography.Text>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 100 }}
            size='small'
          >
            <Select.Option value='all'>{t('全部')}</Select.Option>
            <Select.Option value='enabled'>{t('已启用')}</Select.Option>
            <Select.Option value='disabled'>{t('已禁用')}</Select.Option>
            <Select.Option value='expired'>{t('已过期')}</Select.Option>
            <Select.Option value='depleted'>{t('已耗尽')}</Select.Option>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default ChannelsActionsEnhanced;
