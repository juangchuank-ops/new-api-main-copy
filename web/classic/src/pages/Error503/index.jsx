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
import { Button } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Error503 = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className='classic-page-fill flex flex-col justify-center items-center p-8 gap-2'>
      <h1 className='text-8xl font-bold leading-tight'>503</h1>
      <span className='font-medium text-lg'>{t('网站正在维护中！')}</span>
      <p className='text-center'>
        {t('服务维护中，请稍后再试')}
        <br />
        {t('我们很快会恢复上线。')}
      </p>
      <div className='mt-6 flex gap-4'>
        <Button theme='outline' onClick={() => navigate(-1)}>
          {t('返回上一页')}
        </Button>
        <Button theme='solid' type='primary' onClick={() => navigate('/')}>
          {t('返回首页')}
        </Button>
      </div>
    </div>
  );
};

export default Error503;
