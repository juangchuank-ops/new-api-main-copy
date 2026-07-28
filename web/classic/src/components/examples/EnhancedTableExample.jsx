/*
Copyright (C) 2025 QuantumNous

Enhanced Table Example - 展示如何使用表格工具栏和密度切换
这是一个示例文件，展示如何集成 TableDensitySwitcher 和 BatchActionBar
*/

import React, { useState } from 'react';
import { Table, Space, Button, Input } from '@douyinfe/semi-ui';
import {
  IconSearch,
  IconRefresh,
  IconEdit,
  IconDelete,
  IconCheck,
  IconClose,
} from '@douyinfe/semi-icons';
import {
  TableDensitySwitcher,
  BatchActionBar,
  StatusIndicator,
} from '../enhanced';

/**
 * 使用增强表格工具的示例
 * 可以应用到 Channel、Token、Log 等页面的表格
 */
const EnhancedTableExample = () => {
  const [density, setDensity] = useState('default');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [searchText, setSearchText] = useState('');

  // 示例数据
  const dataSource = [
    {
      key: '1',
      name: 'OpenAI Channel',
      status: 'active',
      requests: 12345,
      cost: 123.45,
    },
    {
      key: '2',
      name: 'Claude Channel',
      status: 'inactive',
      requests: 6789,
      cost: 67.89,
    },
    {
      key: '3',
      name: 'Gemini Channel',
      status: 'error',
      requests: 456,
      cost: 4.56,
    },
  ];

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <StatusIndicator status={status} />,
    },
    {
      title: '请求数',
      dataIndex: 'requests',
      key: 'requests',
      render: (text) => text.toLocaleString(),
    },
    {
      title: '消耗',
      dataIndex: 'cost',
      key: 'cost',
      render: (text) => `$${text.toFixed(2)}`,
    },
  ];

  const batchActions = [
    {
      label: '批量编辑',
      icon: <IconEdit />,
      onClick: () => console.log('批量编辑', selectedRowKeys),
    },
    {
      label: '批量删除',
      icon: <IconDelete />,
      type: 'danger',
      onClick: () => console.log('批量删除', selectedRowKeys),
    },
    {
      label: '批量启用',
      icon: <IconCheck />,
      onClick: () => console.log('批量启用', selectedRowKeys),
    },
    {
      label: '批量禁用',
      icon: <IconClose />,
      onClick: () => console.log('批量禁用', selectedRowKeys),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  return (
    <div className="p-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <Space>
          <Input
            prefix={<IconSearch />}
            placeholder="搜索..."
            value={searchText}
            onChange={setSearchText}
            showClear
            style={{ width: 240 }}
          />
          <Button icon={<IconRefresh />}>刷新</Button>
        </Space>

        <TableDensitySwitcher density={density} onChange={setDensity} />
      </div>

      {/* 批量操作工具栏 */}
      <BatchActionBar
        selectedCount={selectedRowKeys.length}
        onClear={() => setSelectedRowKeys([])}
        actions={batchActions}
      />

      {/* 表格 */}
      <div className={`table-density-${density}`}>
        <Table
          dataSource={dataSource}
          columns={columns}
          rowSelection={rowSelection}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </div>
    </div>
  );
};

export default EnhancedTableExample;
