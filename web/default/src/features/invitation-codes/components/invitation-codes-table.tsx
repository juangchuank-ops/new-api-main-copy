/*
Copyright (C) 2023-2026 QuantumNous

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
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  DISABLED_ROW_DESKTOP,
  DISABLED_ROW_MOBILE,
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import { getInvitationCodes, searchInvitationCodes } from '../api'
import {
  INVITATION_CODE_STATUS,
  getInvitationCodeStatusOptions,
} from '../constants'
import type { InvitationCode } from '../types'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { useInvitationCodesColumns } from './invitation-codes-columns'
import { useInvitationCodes } from './invitation-codes-provider'

const route = getRouteApi('/_authenticated/invitation-codes/')

function isDisabledInvitationCodeRow(invitationCode: InvitationCode) {
  return invitationCode.status !== INVITATION_CODE_STATUS.ENABLED
}

export function InvitationCodesTable() {
  const { t } = useTranslation()
  const columns = useInvitationCodesColumns()
  const { refreshTrigger } = useInvitationCodes()
  const isMobile = useMediaQuery('(max-width: 640px)')

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
    ],
  })

  // Fetch data with React Query
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'invitation-codes',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      refreshTrigger,
    ],
    queryFn: async () => {
      const hasFilter = globalFilter?.trim()
      const params = {
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }

      const result = hasFilter
        ? await searchInvitationCodes({ ...params, keyword: globalFilter })
        : await getInvitationCodes(params)

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const invitationCodes = data?.items || []

  const { table } = useDataTable({
    data: invitationCodes,
    columns,
    enableRowSelection: true,
    columnFilters,
    globalFilter,
    pagination,
    globalFilterFn: (row, _columnId, filterValue) => {
      const name = String(row.getValue('name')).toLowerCase()
      const id = String(row.getValue('id'))
      const searchValue = String(filterValue).toLowerCase()

      return name.includes(searchValue) || id.includes(searchValue)
    },
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: !globalFilter,
    totalCount: data?.total || 0,
    ensurePageInRange,
  })

  const invitationCodeStatusOptions = useMemo(
    () => getInvitationCodeStatusOptions(t),
    [t]
  )

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Invitation Codes Found')}
      emptyDescription={t(
        'No invitation codes available. Create your first invitation code to get started.'
      )}
      skeletonKeyPrefix='invitation-codes-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by name or ID...'),
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: invitationCodeStatusOptions,
            singleSelect: true,
          },
        ],
      }}
      getRowClassName={(row, { isMobile }) =>
        isDisabledInvitationCodeRow(row.original)
          ? isMobile
            ? DISABLED_ROW_MOBILE
            : DISABLED_ROW_DESKTOP
          : undefined
      }
      bulkActions={<DataTableBulkActions table={table} />}
    />
  )
}
