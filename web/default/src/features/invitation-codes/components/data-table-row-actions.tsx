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
import type { Row } from '@tanstack/react-table'
import { Trash2, Edit, Power, PowerOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { updateInvitationCodeStatus } from '../api'
import { INVITATION_CODE_STATUS, SUCCESS_MESSAGES } from '../constants'
import { invitationSchema } from '../types'
import { useInvitationCodes } from './invitation-codes-provider'

interface DataTableRowActionsProps<TData> {
  row: Row<TData>
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { t } = useTranslation()
  const invitationCode = invitationSchema.parse(row.original)
  const { setOpen, setCurrentRow, triggerRefresh } = useInvitationCodes()
  const isEnabled = invitationCode.status === INVITATION_CODE_STATUS.ENABLED
  const isUsed = invitationCode.status === INVITATION_CODE_STATUS.USED

  const handleToggleStatus = async () => {
    const newStatus = isEnabled
      ? INVITATION_CODE_STATUS.DISABLED
      : INVITATION_CODE_STATUS.ENABLED

    const result = await updateInvitationCodeStatus(
      invitationCode.id,
      newStatus
    )
    if (result.success) {
      const message = isEnabled
        ? t(SUCCESS_MESSAGES.INVITATION_DISABLED)
        : t(SUCCESS_MESSAGES.INVITATION_ENABLED)
      toast.success(message)
      triggerRefresh()
    }
  }

  const canEdit = isEnabled && !isUsed
  const canToggle = !isUsed

  return (
    <div className='-ml-1.5 flex items-center gap-1'>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => {
                setCurrentRow(invitationCode)
                setOpen('update')
              }}
              disabled={!canEdit}
              aria-label={t('Edit')}
            />
          }
        >
          <Edit />
        </TooltipTrigger>
        <TooltipContent>{t('Edit')}</TooltipContent>
      </Tooltip>

      <DataTableRowActionMenu ariaLabel={t('Open menu')} modal={false}>
        {canToggle && (
          <DropdownMenuItem onClick={handleToggleStatus}>
            {isEnabled ? (
              <>
                {t('Disable')}
                <DropdownMenuShortcut>
                  <PowerOff size={16} />
                </DropdownMenuShortcut>
              </>
            ) : (
              <>
                {t('Enable')}
                <DropdownMenuShortcut>
                  <Power size={16} />
                </DropdownMenuShortcut>
              </>
            )}
          </DropdownMenuItem>
        )}
        {canToggle && <DropdownMenuSeparator />}
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(invitationCode)
            setOpen('delete')
          }}
          className='text-destructive focus:text-destructive'
        >
          {t('Delete')}
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DataTableRowActionMenu>
    </div>
  )
}
