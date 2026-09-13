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

import React, { useMemo } from 'react';
import { Descriptions, Modal, Tag, Typography } from '@douyinfe/semi-ui';
import {
  getAuditActionLabel,
  getAuditAuthMethodLabel,
  getAuditCategoryLabel,
  getAuditRoleLabel,
} from './AuditLogsColumnDefs';

function formatOther(other) {
  if (other === null || other === undefined) {
    return '';
  }
  if (typeof other === 'string') {
    return other;
  }
  try {
    return JSON.stringify(other, null, 2);
  } catch (e) {
    return String(other);
  }
}

const AuditLogDetailModal = ({ visible, onCancel, record, t }) => {
  const data = useMemo(() => {
    if (!record) {
      return [];
    }
    const operator = record.username
      ? record.user_id
        ? `${record.username} (ID: ${record.user_id})`
        : record.username
      : record.user_id
        ? `ID: ${record.user_id}`
        : '-';
    return [
      { key: t('事件 ID'), value: record.event_id || '-' },
      { key: t('时间'), value: record.timestamp2string || '-' },
      { key: t('分类'), value: getAuditCategoryLabel(record.category, t) },
      { key: t('操作'), value: getAuditActionLabel(record.action, t) },
      { key: t('操作者'), value: operator },
      { key: t('角色'), value: getAuditRoleLabel(record.actor_role, t) },
      {
        key: t('结果'),
        value: (
          <Tag color={record.success ? 'green' : 'red'} shape='circle'>
            {record.success ? t('成功') : t('失败')}
          </Tag>
        ),
      },
      { key: 'HTTP', value: record.status || '-' },
      { key: t('认证方式'), value: getAuditAuthMethodLabel(record.auth_method, t) },
      { key: t('方法'), value: record.method || '-' },
      { key: t('路由'), value: record.route || '-' },
      { key: 'IP', value: record.ip || '-' },
      { key: t('令牌标识'), value: record.token_ref || '-' },
      { key: 'Request ID', value: record.request_id || '-' },
      { key: 'User-Agent', value: record.user_agent || '-' },
      { key: t('内容'), value: record.content || '-' },
    ];
  }, [record, t]);

  const otherText = useMemo(() => formatOther(record?.other), [record]);

  return (
    <Modal
      title={t('审计日志详情')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={720}
    >
      {record && (
        <>
          <Descriptions data={data} column={1} />
          {otherText && (
            <div className='mt-3'>
              <Typography.Text strong>{t('原始元数据')}</Typography.Text>
              <pre
                style={{
                  marginTop: 8,
                  maxHeight: 320,
                  overflow: 'auto',
                  padding: 12,
                  borderRadius: 8,
                  background: 'var(--semi-color-fill-0)',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {otherText}
              </pre>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export default AuditLogDetailModal;
