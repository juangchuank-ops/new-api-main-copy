import { Loader2, ShoppingCart } from 'lucide-react'
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

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { PAYMENT_TYPES } from '../constants'
import { useInvitationCodePayment } from '../hooks'
import { formatCurrency, getPaymentIcon } from '../lib'
import type { TopupInfo } from '../types'

interface PaymentChannel {
  id: string
  name: string
  type: string
  paymentMethod?: string
  icon?: string
  payMethodIndex?: number
}

interface BuyInvitationCodesControlProps {
  topupInfo: TopupInfo | null
  unitPrice: number
  enabled: boolean
  onPaymentStarted?: () => void
}

function getInvitationCodePaymentChannels(
  topupInfo: TopupInfo | null
): PaymentChannel[] {
  if (!topupInfo) return []

  const channels: PaymentChannel[] = []
  const waffoMethods = topupInfo.waffo_pay_methods || []
  const hasDetailedWaffoMethods =
    topupInfo.enable_waffo_topup === true && waffoMethods.length > 0

  for (const method of topupInfo.pay_methods || []) {
    if (method.type === PAYMENT_TYPES.WAFFO && hasDetailedWaffoMethods) {
      continue
    }
    channels.push({
      id: `configured-${method.type}`,
      name: method.name,
      type: method.type,
      paymentMethod: method.type,
      icon: method.icon,
    })
  }

  if (
    topupInfo.enable_stripe_topup &&
    !channels.some((channel) => channel.type === PAYMENT_TYPES.STRIPE)
  ) {
    channels.push({
      id: PAYMENT_TYPES.STRIPE,
      name: 'Stripe',
      type: PAYMENT_TYPES.STRIPE,
    })
  }

  if (topupInfo.enable_creem_topup) {
    channels.push({
      id: PAYMENT_TYPES.CREEM,
      name: 'Creem',
      type: PAYMENT_TYPES.CREEM,
    })
  }

  if (hasDetailedWaffoMethods) {
    waffoMethods.forEach((method, index) => {
      channels.push({
        id: `${PAYMENT_TYPES.WAFFO}-${index}`,
        name: method.name,
        type: PAYMENT_TYPES.WAFFO,
        icon: method.icon,
        payMethodIndex: index,
      })
    })
  } else if (
    topupInfo.enable_waffo_topup &&
    !channels.some((channel) => channel.type === PAYMENT_TYPES.WAFFO)
  ) {
    channels.push({
      id: PAYMENT_TYPES.WAFFO,
      name: 'Waffo',
      type: PAYMENT_TYPES.WAFFO,
    })
  }

  if (
    topupInfo.enable_waffo_pancake_topup &&
    !channels.some((channel) => channel.type === PAYMENT_TYPES.WAFFO_PANCAKE)
  ) {
    channels.push({
      id: PAYMENT_TYPES.WAFFO_PANCAKE,
      name: 'Waffo Pancake',
      type: PAYMENT_TYPES.WAFFO_PANCAKE,
    })
  }

  return channels
}

export function BuyInvitationCodesControl(
  props: BuyInvitationCodesControlProps
) {
  const { t } = useTranslation()
  const [count, setCount] = useState(1)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const channels = useMemo(
    () => getInvitationCodePaymentChannels(props.topupInfo),
    [props.topupInfo]
  )
  const { processing, processInvitationCodePayment } =
    useInvitationCodePayment()

  const startPayment = async (channel: PaymentChannel) => {
    const started = await processInvitationCodePayment(
      count,
      channel.type,
      channel.paymentMethod,
      channel.payMethodIndex
    )
    if (started) {
      setPaymentDialogOpen(false)
      props.onPaymentStarted?.()
    }
  }

  const handlePurchase = () => {
    if (channels.length === 1) {
      void startPayment(channels[0])
      return
    }
    if (channels.length > 1) setPaymentDialogOpen(true)
  }

  const totalPrice = props.unitPrice * count
  const canPurchase =
    props.enabled && channels.length > 0 && props.unitPrice > 0

  return (
    <>
      <div className='flex flex-wrap items-end gap-2'>
        <div className='grid gap-1'>
          <Label htmlFor='invitation-code-count' className='text-xs'>
            {t('Quantity')}
          </Label>
          <Input
            id='invitation-code-count'
            type='number'
            min={1}
            max={100}
            value={count}
            onChange={(event) => {
              const nextCount = Number.parseInt(event.target.value, 10)
              if (Number.isNaN(nextCount)) return
              setCount(Math.max(1, Math.min(100, nextCount)))
            }}
            className='h-8 w-20'
          />
        </div>
        <Button
          onClick={handlePurchase}
          disabled={!canPurchase || processing !== null}
          className='h-8'
        >
          {processing ? (
            <Loader2 data-icon='inline-start' className='animate-spin' />
          ) : (
            <ShoppingCart data-icon='inline-start' />
          )}
          {t('Buy Invitation Codes')}
        </Button>
        {canPurchase ? (
          <span className='text-muted-foreground pb-1 text-xs tabular-nums'>
            {t('Total:')} {formatCurrency(totalPrice)}
          </span>
        ) : null}
      </div>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('Choose Payment Method')}</DialogTitle>
            <DialogDescription>
              {t('Select a payment method to buy {{count}} invitation codes.', {
                count,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-2 sm:grid-cols-2'>
            {channels.map((channel) => {
              const processingKey =
                channel.type === PAYMENT_TYPES.WAFFO &&
                channel.payMethodIndex !== undefined
                  ? `${channel.type}-${channel.payMethodIndex}`
                  : channel.type
              let channelIcon = getPaymentIcon(channel.type)
              if (channel.icon) {
                channelIcon = (
                  <img
                    src={channel.icon}
                    alt=''
                    data-icon='inline-start'
                    className='object-contain'
                  />
                )
              }
              if (processing === processingKey) {
                channelIcon = (
                  <Loader2 data-icon='inline-start' className='animate-spin' />
                )
              }

              return (
                <Button
                  key={channel.id}
                  variant='outline'
                  onClick={() => void startPayment(channel)}
                  disabled={processing !== null}
                  className='h-12 justify-start'
                >
                  {channelIcon}
                  <span className='truncate'>{channel.name}</span>
                </Button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
