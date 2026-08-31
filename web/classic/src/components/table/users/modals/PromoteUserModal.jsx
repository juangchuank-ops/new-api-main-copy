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
import { Modal, Select } from '@douyinfe/semi-ui';

const PromoteUserModal = ({ visible, onCancel, onConfirm, t }) => {
  const [role, setRole] = useState('5');

  useEffect(() => {
    if (visible) {
      setRole('5');
    }
  }, [visible]);

  return (
    <Modal
      title={t('提升用户权限')}
      visible={visible}
      onCancel={onCancel}
      onOk={() => onConfirm(Number(role))}
      type='warning'
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span>{t('请选择提升后的角色')}</span>
        <Select value={role} onChange={setRole} style={{ width: '100%' }}>
          <Select.Option value='5'>{t('权限管理员')}</Select.Option>
          <Select.Option value='10'>{t('管理员')}</Select.Option>
        </Select>
      </div>
    </Modal>
  );
};

export default PromoteUserModal;
