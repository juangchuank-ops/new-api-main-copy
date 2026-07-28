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
import CardPro from '../../common/ui/CardPro';
import InvitationCodesTable from './InvitationCodesTable';
import InvitationCodesActions from './InvitationCodesActions';
import InvitationCodesFilters from './InvitationCodesFilters';
import InvitationCodesDescription from './InvitationCodesDescription';
import EditInvitationCodeModal from './modals/EditInvitationCodeModal';
import { useInvitationCodesData } from '../../../hooks/invitation_codes/useInvitationCodesData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const InvitationCodesPage = () => {
  const invitationCodesData = useInvitationCodesData();
  const isMobile = useIsMobile();

  const {
    // Edit state
    showEdit,
    editingInvitationCode,
    closeEdit,
    refresh,

    // Actions state
    selectedKeys,
    setEditingInvitationCode,
    setShowEdit,
    batchDeleteInvitationCodes,

    // Filters state
    formInitValues,
    setFormApi,
    searchInvitationCodes,
    loading,
    searching,

    // UI state
    compactMode,
    setCompactMode,

    // Translation
    t,
  } = invitationCodesData;

  return (
    <>
      <EditInvitationCodeModal
        refresh={refresh}
        editingInvitationCode={editingInvitationCode}
        visiable={showEdit}
        handleClose={closeEdit}
      />

      <CardPro
        type='type1'
        descriptionArea={
          <InvitationCodesDescription
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        }
        actionsArea={
          <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
            <InvitationCodesActions
              selectedKeys={selectedKeys}
              setEditingInvitationCode={setEditingInvitationCode}
              setShowEdit={setShowEdit}
              batchDeleteInvitationCodes={batchDeleteInvitationCodes}
              t={t}
            />

            <div className='w-full md:w-full lg:w-auto order-1 md:order-2'>
              <InvitationCodesFilters
                formInitValues={formInitValues}
                setFormApi={setFormApi}
                searchInvitationCodes={searchInvitationCodes}
                loading={loading}
                searching={searching}
                t={t}
              />
            </div>
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: invitationCodesData.activePage,
          pageSize: invitationCodesData.pageSize,
          total: invitationCodesData.tokenCount,
          onPageChange: invitationCodesData.handlePageChange,
          onPageSizeChange: invitationCodesData.handlePageSizeChange,
          isMobile: isMobile,
          t: invitationCodesData.t,
        })}
        t={invitationCodesData.t}
      >
        <InvitationCodesTable {...invitationCodesData} />
      </CardPro>
    </>
  );
};

export default InvitationCodesPage;
