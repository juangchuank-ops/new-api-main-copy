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
import { useTranslation } from 'react-i18next';
import { Modal } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { useTableCompactMode } from '../common/useTableCompactMode';

export const useUsersData = () => {
  const { t } = useTranslation();
  const [compactMode, setCompactMode] = useTableCompactMode('users');

  // State management
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [searching, setSearching] = useState(false);
  const [groupOptions, setGroupOptions] = useState([]);
  const [userCount, setUserCount] = useState(0);

  // Modal states
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState({
    id: undefined,
  });

  // Form initial values
  const formInitValues = {
    searchKeyword: '',
    searchGroup: '',
  };

  // Form API reference
  const [formApi, setFormApi] = useState(null);

  // Get form values helper function
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
      searchGroup: formValues.searchGroup || '',
    };
  };

  // Set user format with key field
  const setUserFormat = (users) => {
    for (let i = 0; i < users.length; i++) {
      users[i].key = users[i].id;
    }
    setUsers(users);
  };

  // Load users data
  const loadUsers = async (startIdx, pageSize) => {
    setLoading(true);
    // skipErrorHandler 避免全局拦截器在调用方（如权限保存后的静默刷新）
    // 再弹一次错误提示；失败统一由这里提示一次。
    let res;
    try {
      res = await API.get(`/api/user/?p=${startIdx}&page_size=${pageSize}`, {
        skipErrorHandler: true,
      });
    } catch (error) {
      showError(error?.response?.data?.message || error.message);
      setLoading(false);
      return;
    }
    const { success, message, data } = res.data;
    if (success) {
      const newPageData = data.items;
      setActivePage(data.page);
      setUserCount(data.total);
      setUserFormat(newPageData);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  // Search users with keyword and group
  const searchUsers = async (
    startIdx,
    pageSize,
    searchKeyword = null,
    searchGroup = null,
  ) => {
    // If no parameters passed, get values from form
    if (searchKeyword === null || searchGroup === null) {
      const formValues = getFormValues();
      searchKeyword = formValues.searchKeyword;
      searchGroup = formValues.searchGroup;
    }

    if (searchKeyword === '' && searchGroup === '') {
      // If keyword is blank, load files instead
      await loadUsers(startIdx, pageSize);
      return;
    }
    setSearching(true);
    let res;
    try {
      res = await API.get(
        `/api/user/search?keyword=${searchKeyword}&group=${searchGroup}&p=${startIdx}&page_size=${pageSize}`,
        { skipErrorHandler: true },
      );
    } catch (error) {
      showError(error?.response?.data?.message || error.message);
      setSearching(false);
      return;
    }
    const { success, message, data } = res.data;
    if (success) {
      const newPageData = data.items;
      setActivePage(data.page);
      setUserCount(data.total);
      setUserFormat(newPageData);
    } else {
      showError(message);
    }
    setSearching(false);
  };

  // Manage user operations (promote, demote, enable, disable, delete)
  const manageUser = async (userId, action, record, extra = {}) => {
    // Trigger loading state to force table re-render
    setLoading(true);

    let res;
    try {
      res = await API.post('/api/user/manage', {
        id: userId,
        action,
        ...extra,
      }, { skipErrorHandler: true });
    } catch (error) {
      showError(error?.response?.data?.message || error.message);
      setLoading(false);
      return false;
    }

    const { success, message } = res.data;
    if (success) {
      showSuccess(t('操作成功完成！'));
      const user = res.data.data;

      // Create a new array and new object to ensure React detects changes
      const newUsers = users.map((u) => {
        if (u.id === userId) {
          if (action === 'delete') {
            return { ...u, DeletedAt: new Date() };
          }
          return { ...u, status: user.status, role: user.role };
        }
        return u;
      });

      setUsers(newUsers);
      setLoading(false);
      return true;
    }

    showError(message);
    setLoading(false);
    return false;
  };

  const resetUserPasskey = async (user) => {
    if (!user) {
      return;
    }
    try {
      const res = await API.delete(`/api/user/${user.id}/reset_passkey`);
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('Passkey 已重置'));
      } else {
        showError(message || t('操作失败，请重试'));
      }
    } catch (error) {
      showError(t('操作失败，请重试'));
    }
  };

  const resetUserTwoFA = async (user) => {
    if (!user) {
      return;
    }
    try {
      const res = await API.delete(`/api/user/${user.id}/2fa`);
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('二步验证已重置'));
      } else {
        showError(message || t('操作失败，请重试'));
      }
    } catch (error) {
      showError(t('操作失败，请重试'));
    }
  };

  // Release user auto ban (UA / IP / sensitive words / model probing)
  const releaseUserAutoBan = async (user) => {
    if (!user) {
      return false;
    }
    const confirmed = await new Promise((resolve) => {
      Modal.confirm({
        title: t('解除封禁'),
        content: t('确认解除该用户的自动封禁吗？解除后该用户可立即恢复正常访问。'),
        okText: t('确认解除'),
        cancelText: t('取消'),
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) {
      return false;
    }
    setLoading(true);
    let res;
    try {
      res = await API.post(
        `/api/security/auto-ban/users/${user.id}/release`,
        { reason: t('管理员手动解除') },
        { skipErrorHandler: true },
      );
    } catch (error) {
      showError(error?.response?.data?.message || error.message);
      setLoading(false);
      return false;
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('已解除封禁'));
      setUsers(
        users.map((u) =>
          u.id === user.id
            ? {
                ...u,
                auto_ban_until: 0,
                auto_ban_rule: '',
                auto_ban_record_id: 0,
                auto_ban_response_message: '',
              }
            : u,
        ),
      );
      setLoading(false);
      return true;
    }
    showError(message || t('操作失败，请重试'));
    setLoading(false);
    return false;
  };

  // Handle page change
  const handlePageChange = (page) => {
    setActivePage(page);
    const { searchKeyword, searchGroup } = getFormValues();
    if (searchKeyword === '' && searchGroup === '') {
      loadUsers(page, pageSize).then();
    } else {
      searchUsers(page, pageSize, searchKeyword, searchGroup).then();
    }
  };

  // Handle page size change
  const handlePageSizeChange = async (size) => {
    localStorage.setItem('page-size', size + '');
    setPageSize(size);
    setActivePage(1);
    loadUsers(activePage, size)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  };

  // Handle table row styling for disabled/deleted users
  const handleRow = (record, index) => {
    if (record.DeletedAt !== null || record.status !== 1) {
      return {
        style: {
          background: 'var(--semi-color-disabled-border)',
        },
      };
    } else {
      return {};
    }
  };

  // Refresh data
  const refresh = async (page = activePage) => {
    const { searchKeyword, searchGroup } = getFormValues();
    if (searchKeyword === '' && searchGroup === '') {
      await loadUsers(page, pageSize);
    } else {
      await searchUsers(page, pageSize, searchKeyword, searchGroup);
    }
  };

  // Fetch groups data
  const fetchGroups = async () => {
    try {
      let res = await API.get(`/api/group/`);
      if (res === undefined) {
        return;
      }
      const groups = Array.isArray(res?.data?.data) ? res.data.data : [];
      setGroupOptions(
        groups.map((group) => ({
          label: group,
          value: group,
        })),
      );
    } catch (error) {
      showError(error.message);
    }
  };

  // Modal control functions
  const closeAddUser = () => {
    setShowAddUser(false);
  };

  const closeEditUser = () => {
    setShowEditUser(false);
    setEditingUser({
      id: undefined,
    });
  };

  // Initialize data on component mount
  useEffect(() => {
    loadUsers(0, pageSize)
      .then()
      .catch((reason) => {
        showError(reason);
      });
    fetchGroups().then();
  }, []);

  return {
    // Data state
    users,
    loading,
    activePage,
    pageSize,
    userCount,
    searching,
    groupOptions,

    // Modal state
    showAddUser,
    showEditUser,
    editingUser,
    setShowAddUser,
    setShowEditUser,
    setEditingUser,

    // Form state
    formInitValues,
    formApi,
    setFormApi,

    // UI state
    compactMode,
    setCompactMode,

    // Actions
    loadUsers,
    searchUsers,
    manageUser,
    resetUserPasskey,
    resetUserTwoFA,
    releaseUserAutoBan,
    handlePageChange,
    handlePageSizeChange,
    handleRow,
    refresh,
    closeAddUser,
    closeEditUser,
    getFormValues,

    // Translation
    t,
  };
};
