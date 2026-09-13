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

import React, { useMemo, useRef, useState } from 'react';
import { Empty } from '@douyinfe/semi-ui';
import CardTable from '../../common/ui/CardTable';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { API, showSuccess, showError, setUserData } from '../../../helpers';
import { getUsersColumns } from './UsersColumnDefs';
import PromoteUserModal from './modals/PromoteUserModal';
import PermissionAdminModal from './modals/PermissionAdminModal';
import DemoteUserModal from './modals/DemoteUserModal';
import EnableDisableUserModal from './modals/EnableDisableUserModal';
import DeleteUserModal from './modals/DeleteUserModal';
import ResetPasskeyModal from './modals/ResetPasskeyModal';
import ResetTwoFAModal from './modals/ResetTwoFAModal';
import UserSubscriptionsModal from './modals/UserSubscriptionsModal';
import TransferRootModal from './modals/TransferRootModal';

const UsersTable = (usersData) => {
  const {
    users,
    setUsers,
    loading,
    activePage,
    pageSize,
    userCount,
    compactMode,
    handlePageChange,
    handlePageSizeChange,
    handleRow,
    setEditingUser,
    setShowEditUser,
    manageUser,
    refresh,
    resetUserPasskey,
    resetUserTwoFA,
    releaseUserAutoBan,
    t,
  } = usersData;

  // Modal states
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showPermissionAdminModal, setShowPermissionAdminModal] = useState(false);
  // permissionAdminAssigning=true 表示从"提升"流程进入，保存时一并设角色为权限管理员；
  // false 表示编辑已有权限管理员的模块权限，保存时只更新侧边栏配置。
  const [permissionAdminAssigning, setPermissionAdminAssigning] = useState(false);
  const [permissionAdminLoading, setPermissionAdminLoading] = useState(false);
  // ref 守卫防止确认按钮连点/回车重复提交（confirmLoading 的状态更新有延迟）。
  const permissionAdminSavingRef = useRef(false);
  const [showDemoteModal, setShowDemoteModal] = useState(false);
  const [showEnableDisableModal, setShowEnableDisableModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalUser, setModalUser] = useState(null);
  const [enableDisableAction, setEnableDisableAction] = useState('');
  const [showResetPasskeyModal, setShowResetPasskeyModal] = useState(false);
  const [showResetTwoFAModal, setShowResetTwoFAModal] = useState(false);
  const [showUserSubscriptionsModal, setShowUserSubscriptionsModal] =
    useState(false);
  const [showTransferRootModal, setShowTransferRootModal] = useState(false);

  // Modal handlers
  const showPromoteUserModal = (user) => {
    setModalUser(user);
    setShowPromoteModal(true);
  };

  const showPermissionAdminUserModal = async (user) => {
    setModalUser(user);
    setPermissionAdminAssigning(false);
    setShowPermissionAdminModal(true);
    // 打开权限配置时拉取最新用户数据，从 setting 中解析侧边栏配置，
    // 避免列表数据过期导致勾选状态不准。走 /api/user/:id，鉴权与列表一致。
    try {
      const res = await API.get(`/api/user/${user.id}`, {
        skipErrorHandler: true,
      });
      if (res.data.success && res.data.data) {
        const fullUser = res.data.data;
        let sidebarModules = fullUser.sidebar_modules;
        if (!sidebarModules && fullUser.setting) {
          try {
            const setting =
              typeof fullUser.setting === 'string'
                ? JSON.parse(fullUser.setting)
                : fullUser.setting;
            sidebarModules = setting?.sidebar_modules;
          } catch (e) {
            // 解析失败时沿用列表数据
          }
        }
        setModalUser({ ...user, sidebar_modules: sidebarModules });
      }
    } catch (error) {
      // 拉取失败时沿用列表中的数据，弹窗仍可使用默认配置
    }
  };

  const showDemoteUserModal = (user) => {
    setModalUser(user);
    setShowDemoteModal(true);
  };

  const showEnableDisableUserModal = (user, action) => {
    setModalUser(user);
    setEnableDisableAction(action);
    setShowEnableDisableModal(true);
  };

  const showDeleteUserModal = (user) => {
    setModalUser(user);
    setShowDeleteModal(true);
  };

  const showResetPasskeyUserModal = (user) => {
    setModalUser(user);
    setShowResetPasskeyModal(true);
  };

  const showResetTwoFAUserModal = (user) => {
    setModalUser(user);
    setShowResetTwoFAModal(true);
  };

  const showUserSubscriptionsUserModal = (user) => {
    setModalUser(user);
    setShowUserSubscriptionsModal(true);
  };

  const showTransferRootUserModal = (user) => {
    setModalUser(user);
    setShowTransferRootModal(true);
  };

  // Modal confirm handlers
  const handlePromoteConfirm = (newRole) => {
    if (newRole === 5) {
      // 选择权限管理员时，先不改变用户角色，直接打开权限配置弹窗。
      // 角色变更与模块权限在用户点击"保存权限"时由后端原子完成，
      // 确保在分配完成前该用户仍是普通用户。
      setPermissionAdminAssigning(true);
      setShowPromoteModal(false);
      setShowPermissionAdminModal(true);
      return;
    }
    manageUser(modalUser.id, 'promote', modalUser);
    setShowPromoteModal(false);
  };

  const handlePermissionAdminSave = async (modules) => {
    if (!modalUser?.id) return;
    if (permissionAdminSavingRef.current) return;
    permissionAdminSavingRef.current = true;
    setPermissionAdminLoading(true);
    try {
      // 走与其它用户管理操作一致的 /api/user/manage 接口，
      // 避免独立 authz 路由因鉴权链路差异导致 401。
      // permission_admin: 一次性设角色为权限管理员并写入侧边栏模块
      // update_permission_admin: 仅更新已有权限管理员的模块权限
      const action = permissionAdminAssigning
        ? 'permission_admin'
        : 'update_permission_admin';
      const res = await API.post(
        '/api/user/manage',
        {
          id: modalUser.id,
          action,
          sidebar_modules: modules,
        },
        { skipErrorHandler: true },
      );
      if (res.data.success) {
        showSuccess(t('权限管理员权限已保存'));
        setShowPermissionAdminModal(false);
        setPermissionAdminAssigning(false);
        // 以服务端返回值为准更新列表，避免只改本地副本后刷新又恢复旧角色。
        const savedUser = res.data.data || {};
        const newRole = permissionAdminAssigning
          ? savedUser.role ?? 5
          : savedUser.role ?? modalUser.role;
        // 函数式更新避免闭包里的 users 过期，保存后角色列立即变化。
        setUsers((prev) =>
          prev.map((u) =>
            u.id === modalUser.id
              ? {
                  ...u,
                  role: newRole,
                  sidebar_modules: JSON.stringify(modules),
                }
              : u,
          ),
        );
        // 列表刷新失败不能覆盖已经成功的权限保存结果，也不再额外弹错误提示。
        try {
          await refresh();
        } catch (refreshError) {
          // 保留本地已同步的角色和权限，下一次列表加载再从服务端校正。
        }
      } else {
        showError(res.data.message || t('保存失败，请重试'));
      }
    } catch (error) {
      // 限流等中间件只写状态码不写响应体，message 为空；
      // 显式带上 HTTP 状态码，避免真实原因被兜底文案吞掉。
      const status = error?.response?.status;
      const msg = error?.response?.data?.message;
      if (msg) {
        showError(msg);
      } else if (status === 429) {
        showError(t('请求过于频繁，请稍后重试'));
      } else if (status) {
        showError(`${t('保存失败，请重试')}（HTTP ${status}）`);
      } else {
        showError(t('保存失败，请重试'));
      }
    } finally {
      permissionAdminSavingRef.current = false;
      setPermissionAdminLoading(false);
    }
  };

  const handleDemoteConfirm = () => {
    manageUser(modalUser.id, 'demote', modalUser);
    setShowDemoteModal(false);
  };

  const handleEnableDisableConfirm = (reason) => {
    manageUser(
      modalUser.id,
      enableDisableAction,
      modalUser,
      enableDisableAction === 'disable' ? { reason: reason || '' } : {},
    );
    setShowEnableDisableModal(false);
  };

  const handleResetPasskeyConfirm = async () => {
    await resetUserPasskey(modalUser);
    setShowResetPasskeyModal(false);
  };

  const handleResetTwoFAConfirm = async () => {
    await resetUserTwoFA(modalUser);
    setShowResetTwoFAModal(false);
  };

  const handleTransferRootConfirm = async (newRole) => {
    await manageUser(modalUser.id, 'transfer_root', modalUser, { new_role: newRole });
    setShowTransferRootModal(false);
    // 转让后当前登录用户角色已降级，同步本地存储并强制整页刷新，
    // 确保 isRoot() 判断、用户列表、导航菜单等全部重新加载。
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      currentUser.role = newRole;
      setUserData(currentUser);
    } catch (e) {
      // 解析失败时忽略，整页刷新会从服务端重新拉取
    }
    window.location.reload();
  };

  // Get all columns
  const columns = useMemo(() => {
    return getUsersColumns({
      t,
      setEditingUser,
      setShowEditUser,
      showPromoteModal: showPromoteUserModal,
      showPermissionAdminModal: showPermissionAdminUserModal,
      showDemoteModal: showDemoteUserModal,
      showEnableDisableModal: showEnableDisableUserModal,
      showDeleteModal: showDeleteUserModal,
      showResetPasskeyModal: showResetPasskeyUserModal,
      showResetTwoFAModal: showResetTwoFAUserModal,
      showUserSubscriptionsModal: showUserSubscriptionsUserModal,
      showTransferRootModal: showTransferRootUserModal,
      releaseAutoBan: releaseUserAutoBan,
    });
  }, [
    t,
    setEditingUser,
    setShowEditUser,
    showPromoteUserModal,
    showPermissionAdminUserModal,
    showDemoteUserModal,
    showEnableDisableUserModal,
    showDeleteUserModal,
    showResetPasskeyUserModal,
    showResetTwoFAUserModal,
    showUserSubscriptionsUserModal,
    showTransferRootUserModal,
  ]);

  // Handle compact mode by removing fixed positioning
  const tableColumns = useMemo(() => {
    return compactMode
      ? columns.map((col) => {
          if (col.dataIndex === 'operate') {
            const { fixed, ...rest } = col;
            return rest;
          }
          return col;
        })
      : columns;
  }, [compactMode, columns]);

  return (
    <>
      <CardTable
        columns={tableColumns}
        dataSource={users}
        scroll={compactMode ? undefined : { x: 'max-content' }}
        pagination={{
          currentPage: activePage,
          pageSize: pageSize,
          total: userCount,
          pageSizeOpts: [10, 20, 50, 100],
          showSizeChanger: true,
          onPageSizeChange: handlePageSizeChange,
          onPageChange: handlePageChange,
        }}
        hidePagination={true}
        loading={loading}
        onRow={handleRow}
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={
              <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
            }
            description={t('搜索无结果')}
            style={{ padding: 30 }}
          />
        }
        className='overflow-hidden'
        size='middle'
      />

      {/* Modal components */}
      <PromoteUserModal
        visible={showPromoteModal}
        onCancel={() => setShowPromoteModal(false)}
        onConfirm={handlePromoteConfirm}
        user={modalUser}
        t={t}
      />

      <PermissionAdminModal
        visible={showPermissionAdminModal}
        user={modalUser}
        onCancel={() => {
          setShowPermissionAdminModal(false);
          setPermissionAdminAssigning(false);
        }}
        onConfirm={handlePermissionAdminSave}
        loading={permissionAdminLoading}
      />

      <DemoteUserModal
        visible={showDemoteModal}
        onCancel={() => setShowDemoteModal(false)}
        onConfirm={handleDemoteConfirm}
        user={modalUser}
        t={t}
      />

      <EnableDisableUserModal
        visible={showEnableDisableModal}
        onCancel={() => setShowEnableDisableModal(false)}
        onConfirm={handleEnableDisableConfirm}
        user={modalUser}
        action={enableDisableAction}
        t={t}
      />

      <DeleteUserModal
        visible={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        user={modalUser}
        users={users}
        activePage={activePage}
        refresh={refresh}
        manageUser={manageUser}
        t={t}
      />

      <ResetPasskeyModal
        visible={showResetPasskeyModal}
        onCancel={() => setShowResetPasskeyModal(false)}
        onConfirm={handleResetPasskeyConfirm}
        user={modalUser}
        t={t}
      />

      <ResetTwoFAModal
        visible={showResetTwoFAModal}
        onCancel={() => setShowResetTwoFAModal(false)}
        onConfirm={handleResetTwoFAConfirm}
        user={modalUser}
        t={t}
      />

      <UserSubscriptionsModal
        visible={showUserSubscriptionsModal}
        onCancel={() => setShowUserSubscriptionsModal(false)}
        user={modalUser}
        t={t}
        onSuccess={() => refresh?.()}
      />

      <TransferRootModal
        visible={showTransferRootModal}
        onCancel={() => setShowTransferRootModal(false)}
        onConfirm={handleTransferRootConfirm}
        user={modalUser}
        t={t}
      />
    </>
  );
};

export default UsersTable;
