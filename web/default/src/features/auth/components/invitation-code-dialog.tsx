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
import { useState, useEffect, useCallback, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type InvitationCodeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (invitationCode: string) => Promise<void>
  providerName?: string
}

export function InvitationCodeDialog({
  open,
  onOpenChange,
  onConfirm,
  providerName,
}: InvitationCodeDialogProps) {
  const { t } = useTranslation()
  const [invitationCode, setInvitationCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setInvitationCode('')
      setSubmitting(false)
    }
  }, [open])

  const handleConfirm = useCallback(async () => {
    const code = invitationCode.trim()
    if (!code || submitting) return
    setSubmitting(true)
    try {
      await onConfirm(code)
    } finally {
      setSubmitting(false)
    }
  }, [invitationCode, submitting, onConfirm])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !submitting && invitationCode.trim()) {
        e.preventDefault()
        handleConfirm()
      }
    },
    [submitting, invitationCode, handleConfirm]
  )

  const canSubmit = invitationCode.trim() !== '' && !submitting

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (submitting) return
        onOpenChange(nextOpen)
      }}
      title={t('Invitation Code Required')}
      description={t(
        'An invitation code is required to register. Please enter your invitation code to continue with {{provider}}.',
        { provider: providerName || t('OAuth') }
      )}
      contentClassName='max-w-sm'
      headerClassName='text-left'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            onClick={handleConfirm}
            disabled={!canSubmit}
            className='gap-2'
          >
            {submitting ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : null}
            {t('Confirm')}
          </Button>
        </>
      }
    >
      <div className='grid gap-2'>
        <Label htmlFor='invitation-code'>{t('Invitation Code')}</Label>
        <Input
          id='invitation-code'
          placeholder={t('Enter invitation code')}
          value={invitationCode}
          onChange={(event) => setInvitationCode(event.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete='off'
          disabled={submitting}
        />
      </div>
    </Dialog>
  )
}
