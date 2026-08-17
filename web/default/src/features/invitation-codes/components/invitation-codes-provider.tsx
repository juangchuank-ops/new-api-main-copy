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
import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog'
import {
  type InvitationCode,
  type InvitationCodesDialogType,
} from '../types'

type InvitationCodesContextType = {
  open: InvitationCodesDialogType | null
  setOpen: (str: InvitationCodesDialogType | null) => void
  currentRow: InvitationCode | null
  setCurrentRow: React.Dispatch<React.SetStateAction<InvitationCode | null>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const InvitationCodesContext =
  React.createContext<InvitationCodesContextType | null>(null)

export function InvitationCodesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<InvitationCodesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<InvitationCode | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <InvitationCodesContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </InvitationCodesContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useInvitationCodes = () => {
  const invitationCodesContext = React.useContext(InvitationCodesContext)

  if (!invitationCodesContext) {
    throw new Error(
      'useInvitationCodes has to be used within <InvitationCodesProvider>'
    )
  }

  return invitationCodesContext
}
