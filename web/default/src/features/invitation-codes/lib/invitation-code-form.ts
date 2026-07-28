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
import { z } from 'zod'
import type { TFunction } from 'i18next'
import {
  INVITATION_CODE_VALIDATION,
  getInvitationCodeFormErrorMessages,
} from '../constants'
import { type InvitationCodeFormData, type InvitationCode } from '../types'

// ============================================================================
// Form Schema (use getInvitationCodeFormSchema(t) in components for i18n messages)
// ============================================================================

export function getInvitationCodeFormSchema(t: TFunction) {
  const msg = getInvitationCodeFormErrorMessages(t)
  return z.object({
    name: z
      .string()
      .min(INVITATION_CODE_VALIDATION.NAME_MIN_LENGTH, msg.NAME_LENGTH_INVALID)
      .max(INVITATION_CODE_VALIDATION.NAME_MAX_LENGTH, msg.NAME_LENGTH_INVALID),
    count: z
      .number()
      .min(INVITATION_CODE_VALIDATION.COUNT_MIN, msg.COUNT_INVALID)
      .max(INVITATION_CODE_VALIDATION.COUNT_MAX, msg.COUNT_INVALID)
      .optional(),
  })
}

export type InvitationCodeFormValues = {
  name: string
  count?: number
}

// ============================================================================
// Form Defaults
// ============================================================================

export const INVITATION_CODE_FORM_DEFAULT_VALUES: InvitationCodeFormValues = {
  name: '',
  count: 1,
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform form data to API payload
 */
export function transformFormDataToPayload(
  data: InvitationCodeFormValues
): InvitationCodeFormData {
  return {
    name: data.name,
    count: data.count || 1,
  }
}

/**
 * Transform invitation code data to form defaults
 */
export function transformInvitationCodeToFormDefaults(
  invitationCode: InvitationCode
): InvitationCodeFormValues {
  return {
    name: invitationCode.name,
    count: 1,
  }
}
