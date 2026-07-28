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

// ============================================================================
// Invitation Schema & Types
// ============================================================================

export const invitationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  key: z.string(),
  status: z.number(), // 1: enabled, 2: disabled, 3: used
  name: z.string(),
  created_time: z.number(),
  used_time: z.number(),
  used_user_id: z.number(),
})

export type InvitationCode = z.infer<typeof invitationSchema>

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface GetInvitationCodesParams {
  p?: number
  page_size?: number
}

export interface GetInvitationCodesResponse {
  success: boolean
  message?: string
  data?: {
    items: InvitationCode[]
    total: number
    page: number
    page_size: number
  }
}

export interface SearchInvitationCodesParams {
  keyword?: string
  p?: number
  page_size?: number
}

export interface InvitationCodeFormData {
  id?: number
  name: string
  count?: number // Only for create
  status?: number // Only for status update
}

// ============================================================================
// Dialog Types
// ============================================================================

export type InvitationCodesDialogType = 'create' | 'update' | 'delete' | 'view'
