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
import { Empty } from '@douyinfe/semi-ui';
import CardTable from '../../common/ui/CardTable';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { getAuditLogsColumns } from './AuditLogsColumnDefs';

const AuditLogsTable = ({ logs, loading, isAdminUser, copyText, openDetail, t }) => {
  const columns = useMemo(() => {
    return getAuditLogsColumns({ t, copyText, openDetail, isAdminUser });
  }, [t, copyText, openDetail, isAdminUser]);

  return (
    <CardTable
      columns={columns}
      dataSource={logs}
      rowKey='key'
      loading={loading}
      scroll={{ x: 'max-content' }}
      className='rounded-xl overflow-hidden'
      size='small'
      onRow={(record) => ({
        onClick: () => openDetail(record),
        style: { cursor: 'pointer' },
      })}
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
      hidePagination={true}
    />
  );
};

export default AuditLogsTable;
