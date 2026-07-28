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
import { type TFunction } from 'i18next'
import { type StatusBadgeProps } from '@/components/status-badge'

// ============================================================================
// Invitation Status Configuration
// ============================================================================

export const INVITATION_CODE_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
  USED: 3,
} as const

export const INVITATION_CODE_STATUS_VALUES = Object.values(
  INVITATION_CODE_STATUS
).map((value) => String(value)) as `${number}`[]

// labelKey values are i18n keys; use t(config.labelKey) in components
export const INVITATION_CODE_STATUSES: Record<
  number,
  Pick<StatusBadgeProps, 'variant'> & {
    labelKey: string
    value: number
  }
> = {
  [INVITATION_CODE_STATUS.ENABLED]: {
    labelKey: 'Enabled',
    variant: 'success',
    value: INVITATION_CODE_STATUS.ENABLED,
  },
  [INVITATION_CODE_STATUS.DISABLED]: {
    labelKey: 'Disabled',
    variant: 'neutral',
    value: INVITATION_CODE_STATUS.DISABLED,
  },
  [INVITATION_CODE_STATUS.USED]: {
    labelKey: 'Used',
    variant: 'neutral',
    value: INVITATION_CODE_STATUS.USED,
  },
} as const

export function getInvitationCodeStatusOptions(t: TFunction) {
  return Object.values(INVITATION_CODE_STATUSES).map((config) => ({
    label: t(config.labelKey),
    value: String(config.value),
  }))
}

// ============================================================================
// Validation Constants
// ============================================================================

export const INVITATION_CODE_VALIDATION = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 20,
  COUNT_MIN: 1,
  COUNT_MAX: 1000,
} as const

// ============================================================================
// Error Messages
// ============================================================================

// i18n keys; use t(ERROR_MESSAGES.xxx) when displaying. For form schema with interpolation use getInvitationCodeFormErrorMessages(t).
export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  LOAD_FAILED: 'Failed to load invitation codes',
  SEARCH_FAILED: 'Failed to search invitation codes',
  CREATE_FAILED: 'Failed to create invitation code',
  UPDATE_FAILED: 'Failed to update invitation code',
  DELETE_FAILED: 'Failed to delete invitation code',
  DELETE_INVALID_FAILED: 'Failed to delete invalid invitation codes',
  STATUS_UPDATE_FAILED: 'Failed to update invitation code status',
  NAME_LENGTH_INVALID:
    'Name must be between {{min}} and {{max}} characters',
  COUNT_INVALID: 'Count must be between {{min}} and {{max}}',
} as const

/** For form schema only: returns translated messages with interpolation. */
export function getInvitationCodeFormErrorMessages(t: TFunction) {
  return {
    NAME_LENGTH_INVALID: t(ERROR_MESSAGES.NAME_LENGTH_INVALID, {
      min: INVITATION_CODE_VALIDATION.NAME_MIN_LENGTH,
      max: INVITATION_CODE_VALIDATION.NAME_MAX_LENGTH,
    }),
    COUNT_INVALID: t(ERROR_MESSAGES.COUNT_INVALID, {
      min: INVITATION_CODE_VALIDATION.COUNT_MIN,
      max: INVITATION_CODE_VALIDATION.COUNT_MAX,
    }),
  } as const
}

// ============================================================================
// Success Messages (i18n keys; use t(SUCCESS_MESSAGES.xxx) when displaying)
// ============================================================================

export const SUCCESS_MESSAGES = {
  INVITATION_CREATED: 'Invitation code(s) created successfully',
  INVITATION_UPDATED: 'Invitation code updated successfully',
  INVITATION_DELETED: 'Invitation code deleted successfully',
  INVITATION_ENABLED: 'Invitation code enabled successfully',
  INVITATION_DISABLED: 'Invitation code disabled successfully',
  COPY_SUCCESS: 'Copied to clipboard',
} as const
