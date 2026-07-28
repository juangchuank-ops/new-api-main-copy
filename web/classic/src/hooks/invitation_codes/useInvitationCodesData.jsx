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

import { useState, useEffect } from 'react';
import { API, showError, showSuccess, copy } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import {
  INVITATION_CODE_ACTIONS,
  INVITATION_CODE_STATUS,
} from '../../constants/invitation_code.constants';
import { Modal } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useTableCompactMode } from '../common/useTableCompactMode';

export const useInvitationCodesData = () => {
  const { t } = useTranslation();

  // Basic state
  const [invitationCodes, setInvitationCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [tokenCount, setTokenCount] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState([]);

  // Edit state
  const [editingInvitationCode, setEditingInvitationCode] = useState({
    id: undefined,
  });
  const [showEdit, setShowEdit] = useState(false);

  // Form API
  const [formApi, setFormApi] = useState(null);

  // UI state
  const [compactMode, setCompactMode] = useTableCompactMode('invitationCodes');

  // Form state
  const formInitValues = {
    searchKeyword: '',
  };

  // Get form values
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
    };
  };

  // Set invitation code data format
  const setInvitationCodeFormat = (invitationCodes) => {
    setInvitationCodes(invitationCodes);
  };

  // Load invitation code list
  const loadInvitationCodes = async (page = 1, pageSize) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/invitation-code/?p=${page}&page_size=${pageSize}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        const newPageData = data.items;
        setActivePage(data.page <= 0 ? 1 : data.page);
        setTokenCount(data.total);
        setInvitationCodeFormat(newPageData);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setLoading(false);
  };

  // Search invitation codes
  const searchInvitationCodes = async () => {
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      await loadInvitationCodes(1, pageSize);
      return;
    }

    setSearching(true);
    try {
      const res = await API.get(
        `/api/invitation-code/search?keyword=${searchKeyword}&p=1&page_size=${pageSize}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        const newPageData = data.items;
        setActivePage(data.page || 1);
        setTokenCount(data.total);
        setInvitationCodeFormat(newPageData);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setSearching(false);
  };

  // Manage invitation codes (CRUD operations)
  const manageInvitationCode = async (id, action, record) => {
    setLoading(true);
    let data = { id };
    let res;

    try {
      switch (action) {
        case INVITATION_CODE_ACTIONS.DELETE:
          res = await API.delete(`/api/invitation-code/${id}/`);
          break;
        case INVITATION_CODE_ACTIONS.ENABLE:
          data.status = INVITATION_CODE_STATUS.ENABLED;
          res = await API.put('/api/invitation-code/?status_only=true', data);
          break;
        case INVITATION_CODE_ACTIONS.DISABLE:
          data.status = INVITATION_CODE_STATUS.DISABLED;
          res = await API.put('/api/invitation-code/?status_only=true', data);
          break;
        default:
          throw new Error('Unknown operation type');
      }

      const { success, message } = res.data;
      if (success) {
        showSuccess(t('操作成功完成！'));
        let invitationCode = res.data.data;
        let newInvitationCodes = [...invitationCodes];
        if (action !== INVITATION_CODE_ACTIONS.DELETE) {
          record.status = invitationCode.status;
        }
        setInvitationCodes(newInvitationCodes);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setLoading(false);
  };

  // Refresh data
  const refresh = async (page = activePage) => {
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      await loadInvitationCodes(page, pageSize);
    } else {
      await searchInvitationCodes();
    }
  };

  // Handle page change
  const handlePageChange = (page) => {
    setActivePage(page);
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      loadInvitationCodes(page, pageSize);
    } else {
      searchInvitationCodes();
    }
  };

  // Handle page size change
  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setActivePage(1);
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      loadInvitationCodes(1, size);
    } else {
      searchInvitationCodes();
    }
  };

  // Row selection configuration
  const rowSelection = {
    onSelect: (record, selected) => {},
    onSelectAll: (selected, selectedRows) => {},
    onChange: (selectedRowKeys, selectedRows) => {
      setSelectedKeys(selectedRows);
    },
  };

  // Row style handling
  const handleRow = (record, index) => {
    if (record.status !== INVITATION_CODE_STATUS.ENABLED) {
      return {
        style: {
          background: 'var(--semi-color-disabled-border)',
        },
      };
    } else {
      return {};
    }
  };

  // Copy text
  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess('已复制到剪贴板！');
    } else {
      Modal.error({
        title: '无法复制到剪贴板，请手动复制',
        content: text,
        size: 'large',
      });
    }
  };

  // Batch delete invitation codes (clear invalid)
  const batchDeleteInvitationCodes = async () => {
    Modal.confirm({
      title: t('确定清除所有失效邀请码？'),
      content: t('将删除已使用、已禁用及过期的邀请码，此操作不可撤销。'),
      onOk: async () => {
        setLoading(true);
        const res = await API.delete('/api/invitation-code/invalid');
        const { success, message, data } = res.data;
        if (success) {
          showSuccess(t('已删除 {{count}} 条失效邀请码', { count: data }));
          await refresh();
        } else {
          showError(message);
        }
        setLoading(false);
      },
    });
  };

  // Close edit modal
  const closeEdit = () => {
    setShowEdit(false);
    setTimeout(() => {
      setEditingInvitationCode({
        id: undefined,
      });
    }, 500);
  };

  // Initialize data loading
  useEffect(() => {
    loadInvitationCodes(1, pageSize)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  }, [pageSize]);

  return {
    // Data state
    invitationCodes,
    loading,
    searching,
    activePage,
    pageSize,
    tokenCount,
    selectedKeys,

    // Edit state
    editingInvitationCode,
    showEdit,

    // Form state
    formApi,
    formInitValues,

    // UI state
    compactMode,
    setCompactMode,

    // Data operations
    loadInvitationCodes,
    searchInvitationCodes,
    manageInvitationCode,
    refresh,
    copyText,

    // State updates
    setActivePage,
    setPageSize,
    setSelectedKeys,
    setEditingInvitationCode,
    setShowEdit,
    setFormApi,
    setLoading,

    // Event handlers
    handlePageChange,
    handlePageSizeChange,
    rowSelection,
    handleRow,
    closeEdit,
    getFormValues,

    // Batch operations
    batchDeleteInvitationCodes,

    // Translation function
    t,
  };
};
