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

import React, { useCallback, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';
import { API, setUserData, showError } from '../../helpers';
import BalanceTransfer from '../../components/settings/personal/cards/BalanceTransfer';

const TransferPage = () => {
  const { t } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);

  const refreshUserData = useCallback(async () => {
    try {
      const res = await API.get('/api/user/self');
      if (res.data.success) {
        userDispatch({ type: 'login', payload: res.data.data });
        setUserData(res.data.data);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    }
  }, [userDispatch]);

  useEffect(() => {
    refreshUserData();
  }, [refreshUserData]);

  return (
    <div className='mt-[60px]'>
      <div className='flex justify-center'>
        <div className='w-full max-w-3xl mx-auto px-2'>
          <BalanceTransfer
            t={t}
            userState={userState}
            onTransferred={refreshUserData}
          />
        </div>
      </div>
    </div>
  );
};

export default TransferPage;
