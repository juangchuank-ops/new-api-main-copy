import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  RefreshCw,
  Ticket,
  Trash2,
} from 'lucide-react'
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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CopyButton } from '@/components/copy-button'
import { StatusBadge } from '@/components/status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TitledCard } from '@/components/ui/titled-card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { INVITATION_CODE_STATUS } from '@/features/invitation-codes/constants'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useStatus } from '@/hooks/use-status'
import { formatQuota, formatTimestampToDate } from '@/lib/format'

import {
  deleteUserInvitationCode,
  deleteUserInvitationCodes,
  deleteUserUsedInvitationCodes,
  getUserAvailableInvitationCodes,
  getUserInvitationCodes,
  isApiSuccess,
} from '../api'
import type { TopupInfo, UserWalletData } from '../types'
import { BuyInvitationCodesControl } from './buy-invitation-codes-card'

type DeleteIntent =
  | { type: 'single'; id: number }
  | { type: 'selected'; ids: number[] }
  | { type: 'used' }

interface MyInvitationCodesCardProps {
  topupInfo: TopupInfo | null
  user: UserWalletData | null
  onTransfer: () => void
  complianceConfirmed?: boolean
  loading?: boolean
}

function getInvitationLink(code: string): string {
  if (typeof window === 'undefined') return code
  const url = new URL('/sign-up', window.location.origin)
  url.searchParams.set('invitation_code', code)
  return url.toString()
}

export function MyInvitationCodesCard(props: MyInvitationCodesCardProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const queryClient = useQueryClient()
  const { copyToClipboard } = useCopyToClipboard()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [deleteIntent, setDeleteIntent] = useState<DeleteIntent | null>(null)

  const invitationCodesQuery = useQuery({
    queryKey: ['user-invitation-codes', page, pageSize],
    queryFn: () => getUserInvitationCodes(page, pageSize),
    placeholderData: (previousData) => previousData,
  })

  const items = invitationCodesQuery.data?.data?.items || []
  const total = invitationCodesQuery.data?.data?.total || 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const allPageSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.id))
  const somePageSelected =
    !allPageSelected && items.some((item) => selectedIds.has(item.id))

  const deleteMutation = useMutation({
    mutationFn: async (intent: DeleteIntent) => {
      if (intent.type === 'single') {
        return deleteUserInvitationCode(intent.id)
      }
      if (intent.type === 'selected') {
        return deleteUserInvitationCodes(intent.ids)
      }
      return deleteUserUsedInvitationCodes()
    },
    onSuccess: async (response) => {
      if (!isApiSuccess(response)) {
        toast.error(response.message || t('Failed to delete invitation code'))
        return
      }
      toast.success(t('Invitation code deleted successfully'))
      setSelectedIds(new Set())
      setDeleteIntent(null)
      await queryClient.invalidateQueries({
        queryKey: ['user-invitation-codes'],
      })
    },
    onError: () => toast.error(t('Failed to delete invitation code')),
  })

  const copyAllUnused = async () => {
    const response = await getUserAvailableInvitationCodes()
    if (!isApiSuccess(response)) {
      toast.error(response.message || t('Failed to load invitation codes'))
      return
    }
    const codes = response.data || []
    if (codes.length === 0) {
      toast.info(t('No unused invitation codes'))
      return
    }
    await copyToClipboard(codes.join('\n'))
  }

  const deleteDescription = useMemo(() => {
    if (deleteIntent?.type === 'used') {
      return t('This will permanently delete all used invitation codes.')
    }
    if (deleteIntent?.type === 'selected') {
      return t(
        'This will permanently delete {{count}} selected invitation codes.',
        {
          count: deleteIntent.ids.length,
        }
      )
    }
    return t('This will permanently delete this invitation code.')
  }, [deleteIntent, t])

  const pendingRewards = props.user?.aff_quota ?? 0
  const unitPrice = (status?.invitation_code_price as number) || 0
  const purchaseEnabled = status?.invitation_code_enabled === true

  return (
    <>
      <TitledCard
        title={t('My Invitation Codes')}
        description={t(
          'Manage invitation codes for inviting friends to register.'
        )}
        icon={<Ticket />}
        iconTone='success'
        disableHoverEffect
        action={
          pendingRewards > 0 ? (
            <div className='flex items-center justify-end gap-2'>
              <span className='text-muted-foreground text-xs tabular-nums'>
                {t('Pending Rewards')}: {formatQuota(pendingRewards)}
              </span>
              <Button
                variant='outline'
                size='sm'
                onClick={props.onTransfer}
                disabled={props.complianceConfirmed === false}
              >
                {t('Transfer to Balance')}
              </Button>
            </div>
          ) : null
        }
        contentClassName='p-0 sm:p-0'
      >
        <div className='flex flex-col gap-3 border-b p-3 sm:p-4'>
          <BuyInvitationCodesControl
            topupInfo={props.topupInfo}
            unitPrice={unitPrice}
            enabled={purchaseEnabled}
            onPaymentStarted={() =>
              queryClient.invalidateQueries({
                queryKey: ['user-invitation-codes'],
              })
            }
          />
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              variant='secondary'
              size='sm'
              onClick={() => void copyAllUnused()}
              disabled={total === 0}
            >
              <Copy data-icon='inline-start' />
              {t('Copy All Unused Invitation Codes')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setDeleteIntent({ type: 'used' })}
              disabled={total === 0}
            >
              <Trash2 data-icon='inline-start' />
              {t('Clean Used')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() =>
                setDeleteIntent({
                  type: 'selected',
                  ids: [...selectedIds],
                })
              }
              disabled={selectedIds.size === 0}
            >
              <Trash2 data-icon='inline-start' />
              {t('Delete Selected')}
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label={t('Refresh')}
                    onClick={() => void invitationCodesQuery.refetch()}
                    disabled={invitationCodesQuery.isFetching}
                  />
                }
              >
                <RefreshCw
                  className={
                    invitationCodesQuery.isFetching ? 'animate-spin' : undefined
                  }
                />
              </TooltipTrigger>
              <TooltipContent>{t('Refresh')}</TooltipContent>
            </Tooltip>
            <span className='text-muted-foreground ml-auto text-xs tabular-nums'>
              {t('{{count}} invitation codes', { count: total })}
            </span>
          </div>
        </div>

        {(props.loading || invitationCodesQuery.isLoading) && (
          <div className='grid gap-3 p-4'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-12 w-full' />
            <Skeleton className='h-12 w-full' />
          </div>
        )}
        {!props.loading &&
          !invitationCodesQuery.isLoading &&
          items.length === 0 && (
            <Empty className='min-h-48 rounded-none'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <Ticket />
                </EmptyMedia>
                <EmptyTitle>{t('No Invitation Codes Found')}</EmptyTitle>
                <EmptyDescription>
                  {t('Purchased invitation codes will appear here.')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        {!props.loading &&
          !invitationCodesQuery.isLoading &&
          items.length > 0 && (
            <Table className='min-w-[760px]'>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-12 pl-4'>
                    <Checkbox
                      checked={allPageSelected}
                      indeterminate={somePageSelected}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedIds)
                        items.forEach((item) => {
                          if (checked) next.add(item.id)
                          else next.delete(item.id)
                        })
                        setSelectedIds(next)
                      }}
                      aria-label={t('Select all')}
                    />
                  </TableHead>
                  <TableHead>{t('Invitation Code')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead>{t('Creation Time')}</TableHead>
                  <TableHead className='pr-4 text-right'>
                    {t('Actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isAvailable =
                    item.status === INVITATION_CODE_STATUS.ENABLED
                  return (
                    <TableRow
                      key={item.id}
                      data-state={
                        selectedIds.has(item.id) ? 'selected' : undefined
                      }
                    >
                      <TableCell className='pl-4'>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedIds)
                            if (checked) next.add(item.id)
                            else next.delete(item.id)
                            setSelectedIds(next)
                          }}
                          aria-label={t('Select row')}
                        />
                      </TableCell>
                      <TableCell>
                        <code className='block max-w-80 truncate font-mono text-xs'>
                          {item.key}
                        </code>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={t(isAvailable ? 'Unused' : 'Used')}
                          variant={isAvailable ? 'success' : 'neutral'}
                          copyable={false}
                        />
                      </TableCell>
                      <TableCell className='font-mono text-xs'>
                        {formatTimestampToDate(item.created_time)}
                      </TableCell>
                      <TableCell className='pr-4'>
                        <div className='flex justify-end gap-1'>
                          <CopyButton
                            value={getInvitationLink(item.key)}
                            variant='ghost'
                            size='default'
                            tooltip={t('Copy invitation link')}
                            aria-label={t('Copy invitation link')}
                            className='h-8 px-2'
                          >
                            <span>{t('Copy Link')}</span>
                          </CopyButton>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant='ghost'
                                  size='icon-sm'
                                  aria-label={t('Delete invitation code')}
                                  onClick={() =>
                                    setDeleteIntent({
                                      type: 'single',
                                      id: item.id,
                                    })
                                  }
                                />
                              }
                            >
                              <Trash2 className='text-destructive' />
                            </TooltipTrigger>
                            <TooltipContent>
                              {t('Delete invitation code')}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

        <div className='flex flex-col gap-2 border-t p-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:p-4'>
          <span className='text-muted-foreground tabular-nums'>
            {t('Showing {{start}}-{{end}} of {{total}}', {
              start: total === 0 ? 0 : (page - 1) * pageSize + 1,
              end: Math.min(page * pageSize, total),
              total,
            })}
          </span>
          <div className='flex items-center justify-between gap-2 sm:justify-end'>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => {
                setPage((current) => Math.max(1, current - 1))
                setSelectedIds(new Set())
              }}
              disabled={page <= 1}
              aria-label={t('Previous page')}
            >
              <ChevronLeft />
            </Button>
            <span className='bg-muted flex size-8 items-center justify-center rounded-md font-medium tabular-nums'>
              {page}
            </span>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => {
                setPage((current) => Math.min(pageCount, current + 1))
                setSelectedIds(new Set())
              }}
              disabled={page >= pageCount}
              aria-label={t('Next page')}
            >
              <ChevronRight />
            </Button>
            <NativeSelect
              size='sm'
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
                setSelectedIds(new Set())
              }}
              aria-label={t('Rows per page')}
            >
              {[10, 20, 50].map((size) => (
                <NativeSelectOption key={size} value={size}>
                  {t('{{count}} per page', { count: size })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
      </TitledCard>

      <AlertDialog
        open={deleteIntent !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteIntent(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Invitation Codes?')}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={!deleteIntent || deleteMutation.isPending}
              onClick={() => {
                if (deleteIntent) deleteMutation.mutate(deleteIntent)
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 data-icon='inline-start' className='animate-spin' />
              ) : (
                <Trash2 data-icon='inline-start' />
              )}
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
