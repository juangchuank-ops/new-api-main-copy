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

import React, { useState } from 'react';
import { Modal, Input, RadioGroup, Radio, Typography, Button } from '@douyinfe/semi-ui';

const { Text, Title } = Typography;

const CONFIRM_PHRASE = '我确认转让超级管理员身份';

const TransferRootModal = ({ visible, onCancel, onConfirm, user, t }) => {
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState('');
  const [newRole, setNewRole] = useState(1);

  const resetState = () => {
    setStep(1);
    setConfirmText('');
    setNewRole(1);
  };

  const handleCancel = () => {
    resetState();
    onCancel();
  };

  const handleStep1Confirm = () => {
    if (confirmText.trim() !== CONFIRM_PHRASE) {
      return;
    }
    setStep(2);
  };

  const handleStep2Confirm = () => {
    onConfirm(newRole);
    resetState();
  };

  return (
    <Modal
      title={
        <Title heading={5}>
          {t('转让超级管理员身份')}
        </Title>
      }
      visible={visible}
      onCancel={handleCancel}
      footer={null}
      maskClosable={false}
    >
      {step === 1 ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text type='danger' strong>
              {t('警告：此操作将把超级管理员身份转让给 {{username}}，转让后你将失去超级管理员权限。', {
                username: user?.username || '',
              })}
            </Text>
          </div>
          <div style={{ marginBottom: 8 }}>
            <Text>
              {t('请输入“{{phrase}}”以确认操作：', { phrase: CONFIRM_PHRASE })}
            </Text>
          </div>
          <Input
            value={confirmText}
            placeholder={CONFIRM_PHRASE}
            onChange={(value) => setConfirmText(value)}
            onPressEnter={handleStep1Confirm}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              marginTop: 16,
            }}
          >
            <Button theme='light' onClick={handleCancel}>
              {t('取消')}
            </Button>
            <Button
              theme='solid'
              type='primary'
              disabled={confirmText.trim() !== CONFIRM_PHRASE}
              onClick={handleStep1Confirm}
            >
              {t('确认')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Text strong>
              {t('转让后，你将变为以下角色：')}
            </Text>
          </div>
          <RadioGroup
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            direction='vertical'
          >
            <Radio value={1}>
              <Text>{t('普通用户')}</Text>
            </Radio>
            <Radio value={10}>
              <Text>{t('管理员')}</Text>
            </Radio>
          </RadioGroup>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              marginTop: 24,
            }}
          >
            <Button theme='light' onClick={handleCancel}>
              {t('取消')}
            </Button>
            <Button
              theme='solid'
              type='primary'
              onClick={handleStep2Confirm}
            >
              {t('完成转让')}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default TransferRootModal;
