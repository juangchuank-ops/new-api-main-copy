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
import { Modal, TextArea, Typography } from '@douyinfe/semi-ui';

const { Text } = Typography;

const EnableDisableUserModal = ({
  visible,
  onCancel,
  onConfirm,
  user,
  action,
  t,
}) => {
  const isDisable = action === 'disable';
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) {
      setReason('');
    }
  }, [visible, user?.id]);

  return (
    <Modal
      title={isDisable ? t('确定要禁用此用户吗？') : t('确定要启用此用户吗？')}
      visible={visible}
      onCancel={onCancel}
      onOk={() => onConfirm(reason)}
      type='warning'
    >
      {isDisable ? t('此操作将禁用用户账户') : t('此操作将启用用户账户')}
      {isDisable && (
        <div style={{ marginTop: 12 }}>
          <Text type='secondary' size='small'>
            {t('封禁原因（选填），填写后用户的请求会提示该原因')}
          </Text>
          <TextArea
            value={reason}
            onChange={setReason}
            placeholder={t('例如：滥用资源')}
            maxCount={200}
            rows={2}
            style={{ marginTop: 8 }}
          />
        </div>
      )}
    </Modal>
  );
};

export default EnableDisableUserModal;
