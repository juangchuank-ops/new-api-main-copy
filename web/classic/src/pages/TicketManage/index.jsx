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

import React from 'react';
import { Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import AdminTicketPanel from '../../components/ticket/AdminTicketPanel';

const { Title } = Typography;

const TicketManage = () => {
  const { t } = useTranslation();

  return (
    <div className='flex flex-col gap-4 mt-[60px] px-2'>
      <div>
        <Title heading={4} style={{ marginBottom: 4 }}>
          {t('工单管理')}
        </Title>
      </div>
      <AdminTicketPanel />
    </div>
  );
};

export default TicketManage;
