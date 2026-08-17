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
import { api } from '@/lib/api'
import type {
  InvitationCode,
  ApiResponse,
  GetInvitationCodesParams,
  GetInvitationCodesResponse,
  SearchInvitationCodesParams,
  InvitationCodeFormData,
} from './types'

// ============================================================================
// Invitation Code Management
// ============================================================================

// Get paginated invitation codes list
export async function getInvitationCodes(
  params: GetInvitationCodesParams = {}
): Promise<GetInvitationCodesResponse> {
  const { p = 1, page_size = 10 } = params
  const res = await api.get(
    `/api/invitation-code/?p=${p}&page_size=${page_size}`
  )
  return res.data
}

// Search invitation codes by keyword
export async function searchInvitationCodes(
  params: SearchInvitationCodesParams
): Promise<GetInvitationCodesResponse> {
  const { keyword = '', p = 1, page_size = 10 } = params
  const res = await api.get(
    `/api/invitation-code/search?keyword=${keyword}&p=${p}&page_size=${page_size}`
  )
  return res.data
}

// Get single invitation code by ID
export async function getInvitationCode(
  id: number
): Promise<ApiResponse<InvitationCode>> {
  const res = await api.get(`/api/invitation-code/${id}`)
  return res.data
}

// Create invitation code(s)
export async function createInvitationCode(
  data: InvitationCodeFormData
): Promise<ApiResponse<string[]>> {
  const res = await api.post('/api/invitation-code/', data)
  return res.data
}

// Update invitation code
export async function updateInvitationCode(
  data: InvitationCodeFormData & { id: number }
): Promise<ApiResponse<InvitationCode>> {
  const res = await api.put('/api/invitation-code/', data)
  return res.data
}

// Update invitation code status (enable/disable)
export async function updateInvitationCodeStatus(
  id: number,
  status: number
): Promise<ApiResponse<InvitationCode>> {
  const res = await api.put('/api/invitation-code/?status_only=true', {
    id,
    status,
  })
  return res.data
}

// Delete a single invitation code
export async function deleteInvitationCode(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/invitation-code/${id}/`)
  return res.data
}

// Delete invalid invitation codes (used, disabled)
export async function deleteInvalidInvitationCodes(): Promise<
  ApiResponse<number>
> {
  const res = await api.delete('/api/invitation-code/invalid')
  return res.data
}
