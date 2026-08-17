import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Button,
  Input,
  InputNumber,
  Checkbox,
  Typography,
  Popconfirm,
  Modal,
  Space,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconEdit } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import CardTable from '../../../../components/common/ui/CardTable';

const { Text } = Typography;

let _idCounter = 0;
const uid = () => `gr_${++_idCounter}`;

function parseJSON(str, fallback) {
  if (!str || !str.trim()) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function buildRows(groupRatioStr, userUsableGroupsStr) {
  const ratioMap = parseJSON(groupRatioStr, {});
  const usableMap = parseJSON(userUsableGroupsStr, {});

  const allNames = new Set([
    ...Object.keys(ratioMap),
    ...Object.keys(usableMap),
  ]);

  return Array.from(allNames).map((name) => ({
    _id: uid(),
    name,
    ratio: ratioMap[name] ?? 1,
    selectable: name in usableMap,
    description: usableMap[name] ?? '',
  }));
}

export function serializeGroupTable(rows) {
  const groupRatio = {};
  const userUsableGroups = {};

  rows.forEach((row) => {
    if (!row.name) return;
    groupRatio[row.name] = row.ratio;
    if (row.selectable) {
      userUsableGroups[row.name] = row.description;
    }
  });

  return {
    GroupRatio: JSON.stringify(groupRatio, null, 2),
    UserUsableGroups: JSON.stringify(userUsableGroups, null, 2),
  };
}

export default function GroupTable({ groupRatio, userUsableGroups, onChange }) {
  const { t } = useTranslation();

  const [rows, setRows] = useState(() =>
    buildRows(groupRatio, userUsableGroups),
  );

  // Use functional setRows to keep updateRow/addRow/removeRow referentially
  // stable, preventing columns useMemo from rebuilding on every keystroke
  // which causes the Input cursor to jump to end (cursor reset bug).
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emitAndSet = useCallback((updater) => {
    setRows((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onChangeRef.current?.(serializeGroupTable(next));
      return next;
    });
  }, []);

  const updateRow = useCallback(
    (id, field, value) => {
      emitAndSet((prev) =>
        prev.map((r) => (r._id === id ? { ...r, [field]: value } : r)),
      );
    },
    [emitAndSet],
  );

  const addRow = useCallback(() => {
    emitAndSet((prev) => {
      const existingNames = new Set(prev.map((r) => r.name));
      let counter = 1;
      let newName = `group_${counter}`;
      while (existingNames.has(newName)) {
        counter++;
        newName = `group_${counter}`;
      }
      return [
        ...prev,
        {
          _id: uid(),
          name: newName,
          ratio: 1,
          selectable: true,
          description: '',
        },
      ];
    });
  }, [emitAndSet]);

  const removeRow = useCallback(
    (id) => {
      emitAndSet((prev) => prev.filter((r) => r._id !== id));
    },
    [emitAndSet],
  );

  // ---- 批量操作 ----
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // 同步倍率弹窗
  const [ratioModalOpen, setRatioModalOpen] = useState(false);
  const [batchRatio, setBatchRatio] = useState(1);

  const allSelected =
    rows.length > 0 && selectedIds.size === rows.length;
  const someSelected =
    selectedIds.size > 0 && selectedIds.size < rows.length;

  const toggleSelect = useCallback((id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(
    (checked) => {
      setSelectedIds(() => {
        if (!checked) return new Set();
        return new Set(rows.map((r) => r._id));
      });
    },
    [rows],
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const batchRemove = useCallback(() => {
    setSelectedIds((prev) => {
      emitAndSet((cur) => cur.filter((r) => !prev.has(r._id)));
      return new Set();
    });
  }, [emitAndSet]);

  const openRatioModal = useCallback(() => {
    setBatchRatio(1);
    setRatioModalOpen(true);
  }, []);

  const applyBatchRatio = useCallback(() => {
    setSelectedIds((prev) => {
      emitAndSet((cur) =>
        cur.map((r) =>
          prev.has(r._id) ? { ...r, ratio: batchRatio } : r,
        ),
      );
      return new Set();
    });
    setRatioModalOpen(false);
  }, [emitAndSet, batchRatio]);

  const batchSetSelectable = useCallback(
    (value) => {
      setSelectedIds((prev) => {
        emitAndSet((cur) =>
          cur.map((r) =>
            prev.has(r._id) ? { ...r, selectable: value } : r,
          ),
        );
        return new Set();
      });
    },
    [emitAndSet],
  );

  const selectedCount = selectedIds.size;


  const groupNames = useMemo(() => rows.map((r) => r.name), [rows]);

  const duplicateNames = useMemo(() => {
    const counts = {};
    groupNames.forEach((n) => {
      counts[n] = (counts[n] || 0) + 1;
    });
    return new Set(Object.keys(counts).filter((k) => counts[k] > 1));
  }, [groupNames]);

  // Use ref so column render functions always read the latest duplicate set
  // without adding duplicateNames to columns deps (which would break cursor).
  const duplicateNamesRef = useRef(duplicateNames);
  duplicateNamesRef.current = duplicateNames;

  const columns = useMemo(
    () => [
      {
        title: (
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={(e) => toggleSelectAll(e.target.checked)}
          />
        ),
        key: 'selection',
        width: 40,
        align: 'center',
        render: (_, record) => (
          <Checkbox
            checked={selectedIds.has(record._id)}
            onChange={(e) => toggleSelect(record._id, e.target.checked)}
          />
        ),
      },
      {
        title: t('分组名称'),
        dataIndex: 'name',
        key: 'name',
        width: 180,
        render: (_, record) => (
          <Input
            size='small'
            value={record.name}
            status={
              duplicateNamesRef.current.has(record.name) ? 'warning' : undefined
            }
            onChange={(v) => updateRow(record._id, 'name', v)}
          />
        ),
      },
      {
        title: t('倍率'),
        dataIndex: 'ratio',
        key: 'ratio',
        width: 120,
        render: (_, record) => (
          <InputNumber
            size='small'
            min={0}
            step={0.1}
            value={record.ratio}
            style={{ width: '100%' }}
            onChange={(v) => updateRow(record._id, 'ratio', v ?? 0)}
          />
        ),
      },
      {
        title: t('用户可选'),
        dataIndex: 'selectable',
        key: 'selectable',
        width: 90,
        align: 'center',
        render: (_, record) => (
          <Checkbox
            checked={record.selectable}
            onChange={(e) =>
              updateRow(record._id, 'selectable', e.target.checked)
            }
          />
        ),
      },
      {
        title: t('描述'),
        dataIndex: 'description',
        key: 'description',
        render: (_, record) =>
          record.selectable ? (
            <Input
              size='small'
              value={record.description}
              placeholder={t('分组描述')}
              onChange={(v) => updateRow(record._id, 'description', v)}
            />
          ) : (
            <Text type='tertiary' size='small'>
              -
            </Text>
          ),
      },
      {
        title: '',
        key: 'actions',
        width: 50,
        render: (_, record) => (
          <Popconfirm
            title={t('确认删除该分组？')}
            onConfirm={() => removeRow(record._id)}
            position='left'
          >
            <Button
              icon={<IconDelete />}
              type='danger'
              theme='borderless'
              size='small'
            />
          </Popconfirm>
        ),
      },
    ],
    [t, updateRow, removeRow, toggleSelectAll, toggleSelect, allSelected, someSelected, selectedIds],
  );

  return (
    <div>
      {selectedCount > 0 && (
        <div
          className='mb-3 flex flex-wrap items-center gap-2'
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--semi-color-primary-light-default)',
            border: '1px solid var(--semi-color-primary-light-active)',
          }}
        >
          <Text type='primary' size='small' strong>
            {t('已选中')}{selectedCount}{t('项')}
          </Text>
          <Space>
            <Popconfirm
              title={t('确认删除选中的分组？')}
              onConfirm={batchRemove}
              position='bottom'
            >
              <Button
                icon={<IconDelete />}
                type='danger'
                theme='light'
                size='small'
              >
                {t('批量删除')}
              </Button>
            </Popconfirm>
            <Button
              icon={<IconEdit />}
              theme='light'
              size='small'
              onClick={openRatioModal}
            >
              {t('同步倍率')}
            </Button>
            <Button
              theme='light'
              size='small'
              onClick={() => batchSetSelectable(true)}
            >
              {t('设为用户可见')}
            </Button>
            <Button
              theme='light'
              size='small'
              onClick={() => batchSetSelectable(false)}
            >
              {t('设为用户不可见')}
            </Button>
          </Space>
          <Button
            type='tertiary'
            theme='borderless'
            size='small'
            onClick={clearSelection}
          >
            {t('取消选择')}
          </Button>
        </div>
      )}
      <CardTable
        columns={columns}
        dataSource={rows}
        rowKey='_id'
        hidePagination
        size='small'
        empty={<Text type='tertiary'>{t('暂无分组，点击下方按钮添加')}</Text>}
      />
      <div className='mt-3 flex justify-center'>
        <Button icon={<IconPlus />} theme='outline' onClick={addRow}>
          {t('添加分组')}
        </Button>
      </div>
      {duplicateNames.size > 0 && (
        <Text type='warning' size='small' className='mt-2 block'>
          {t('存在重复的分组名称：')}
          {Array.from(duplicateNames).join(', ')}
        </Text>
      )}
      <Modal
        title={t('同步倍率')}
        visible={ratioModalOpen}
        onOk={applyBatchRatio}
        onCancel={() => setRatioModalOpen(false)}
        okText={t('应用')}
        cancelText={t('取消')}
      >
        <Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 8 }}>
          {t('将选中的分组的倍率统一设置为：')}
        </Text>
        <InputNumber
          min={0}
          step={0.1}
          value={batchRatio}
          style={{ width: '100%' }}
          onChange={(v) => setBatchRatio(v ?? 0)}
        />
      </Modal>
    </div>
  );
}
