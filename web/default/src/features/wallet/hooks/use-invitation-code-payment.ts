import i18next from 'i18next'
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
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import {
  isApiSuccess,
  requestCreemPayment,
  requestPayment,
  requestStripePayment,
  requestWaffoPancakePayment,
  requestWaffoPayment,
} from '../api'
import { PAYMENT_TYPES } from '../constants'
import { submitPaymentForm } from '../lib'

function getCheckoutUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  if ('checkout_url' in data && typeof data.checkout_url === 'string') {
    return data.checkout_url
  }
  return null
}

function getPaymentUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  if ('payment_url' in data && typeof data.payment_url === 'string') {
    return data.payment_url
  }
  return null
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function getErrorMessage(message: string | undefined, data: unknown): string {
  if (typeof data === 'string' && data.trim()) return data
  return message || i18next.t('Payment request failed')
}

export function useInvitationCodePayment() {
  const [processing, setProcessing] = useState<string | null>(null)

  const processInvitationCodePayment = useCallback(
    async (
      count: number,
      paymentType: string,
      paymentMethod?: string,
      payMethodIndex?: number
    ): Promise<boolean> => {
      const safeCount = Math.max(1, Math.min(100, Math.floor(count)))
      const processingKey =
        paymentType === PAYMENT_TYPES.WAFFO && payMethodIndex !== undefined
          ? `${paymentType}-${payMethodIndex}`
          : paymentType
      setProcessing(processingKey)

      try {
        if (paymentType === PAYMENT_TYPES.STRIPE) {
          const response = await requestStripePayment({
            amount: safeCount,
            payment_method: PAYMENT_TYPES.STRIPE,
            product_type: 'invitation_code',
            count: safeCount,
          })

          if (!isApiSuccess(response) || !response.data?.pay_link) {
            toast.error(getErrorMessage(response.message, response.data))
            return false
          }

          window.open(response.data.pay_link, '_blank', 'noopener,noreferrer')
          toast.success(i18next.t('Redirecting to payment page...'))
          return true
        }

        if (paymentType === PAYMENT_TYPES.CREEM) {
          const response = await requestCreemPayment({
            payment_method: PAYMENT_TYPES.CREEM,
            product_type: 'invitation_code',
            count: safeCount,
          })

          if (!isApiSuccess(response) || !response.data?.checkout_url) {
            toast.error(getErrorMessage(response.message, response.data))
            return false
          }

          window.open(
            response.data.checkout_url,
            '_blank',
            'noopener,noreferrer'
          )
          toast.success(i18next.t('Redirecting to payment page...'))
          return true
        }

        if (paymentType === PAYMENT_TYPES.WAFFO) {
          const response = await requestWaffoPayment({
            amount: safeCount,
            pay_method_index: payMethodIndex,
            product_type: 'invitation_code',
            count: safeCount,
          })
          const paymentUrl = getPaymentUrl(response.data)

          if (!isApiSuccess(response) || !paymentUrl) {
            toast.error(getErrorMessage(response.message, response.data))
            return false
          }

          window.open(paymentUrl, '_blank', 'noopener,noreferrer')
          toast.success(i18next.t('Redirecting to payment page...'))
          return true
        }

        if (paymentType === PAYMENT_TYPES.WAFFO_PANCAKE) {
          const response = await requestWaffoPancakePayment({
            amount: safeCount,
            product_type: 'invitation_code',
            count: safeCount,
          })
          const checkoutUrl = getCheckoutUrl(response.data)

          if (!isApiSuccess(response) || !checkoutUrl) {
            toast.error(getErrorMessage(response.message, response.data))
            return false
          }
          if (!isSafeHttpUrl(checkoutUrl)) {
            toast.error(i18next.t('Invalid payment redirect URL'))
            return false
          }

          toast.success(i18next.t('Redirecting to payment page...'))
          window.location.href = checkoutUrl
          return true
        }

        const response = await requestPayment({
          amount: safeCount,
          payment_method: paymentMethod || paymentType,
          product_type: 'invitation_code',
          count: safeCount,
        })

        if (!isApiSuccess(response) || !response.url) {
          toast.error(getErrorMessage(response.message, response.data))
          return false
        }

        submitPaymentForm(response.url, response.data || {})
        toast.success(i18next.t('Redirecting to payment page...'))
        return true
      } catch {
        toast.error(i18next.t('Payment request failed'))
        return false
      } finally {
        setProcessing(null)
      }
    },
    []
  )

  return { processing, processInvitationCodePayment }
}
