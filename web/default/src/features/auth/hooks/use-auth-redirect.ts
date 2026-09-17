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
import { useNavigate } from '@tanstack/react-router'
import i18n from 'i18next'
import { useCallback, useEffect, useRef } from 'react'

import {
  getSavedLanguage,
  sanitizeAuthRedirect,
} from '@/features/auth/lib/auth-redirect'
import { applyAuthBundle, isAuthBundle } from '@/lib/auth-session'
import { useAuthStore, type AuthBundle } from '@/stores/auth-store'

import { saveUserId } from '../lib/storage'
import type { LoginChallenge } from '../secure-verification/types'

function isLoginChallenge(value: unknown): value is LoginChallenge {
  if (!value || typeof value !== 'object') return false
  const challenge = value as Partial<LoginChallenge>
  return (
    challenge.require_verification === true &&
    typeof challenge.flow_token === 'string' &&
    typeof challenge.expires_at === 'number' &&
    Array.isArray(challenge.methods)
  )
}

/**
 * Hook for handling authentication redirects and user data management
 */
export function useAuthRedirect() {
  const navigate = useNavigate()
  const sessionID = useAuthStore((state) => state.auth.session?.sid)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  /**
   * Handle successful login
   * @param bundle - The auth bundle (access_token + user + session) from the login response
   * @param redirectTo - Redirect path after login
   */
  const handleLoginSuccess = useCallback(
    async (bundle: AuthBundle, redirectTo?: string) => {
      if (
        !mounted.current ||
        useAuthStore.getState().auth.session?.sid !== sessionID
      ) {
        return
      }

      // Persist the bundle (access token + session) into the auth store.
      // Subsequent API calls pick up the Bearer token from the request
      // interceptor in lib/api.ts.
      applyAuthBundle(bundle)

      // Keep the legacy uid marker in localStorage (used for the
      // New-Api-User header and affiliate attribution).
      if (bundle.user?.id) {
        saveUserId(bundle.user.id)
      }

      const savedLang = getSavedLanguage(bundle.user)
      if (savedLang && savedLang !== i18n.language) {
        await i18n.changeLanguage(savedLang)
      }

      const targetPath =
        sanitizeAuthRedirect(redirectTo, window.location.origin) ?? '/dashboard'
      await navigate({ to: targetPath, replace: true })
    },
    [navigate, sessionID]
  )

  /**
   * Handle a login result: either a full bundle or a verification challenge.
   */
  const handleLoginResult = useCallback(
    async (result: unknown, redirectTo?: string): Promise<boolean> => {
      if (
        !mounted.current ||
        useAuthStore.getState().auth.session?.sid !== sessionID
      ) {
        return false
      }
      if (isAuthBundle(result)) {
        await handleLoginSuccess(result, redirectTo)
        return true
      }
      if (!isLoginChallenge(result)) {
        throw new Error('Login failed')
      }
      if (result.expires_at * 1000 <= Date.now()) {
        throw new Error('Login flow expired. Please sign in again.')
      }
      useAuthStore.getState().auth.setPendingLoginVerification({
        challenge: result,
        redirectTo:
          sanitizeAuthRedirect(redirectTo, window.location.origin) ?? undefined,
      })
      await navigate({ to: '/otp', replace: true })
      return false
    },
    [handleLoginSuccess, navigate, sessionID]
  )

  /**
   * Redirect to 2FA page
   */
  const redirectTo2FA = useCallback(() => {
    navigate({ to: '/otp', replace: true })
  }, [navigate])

  /**
   * Redirect to login page
   */
  const redirectToLogin = useCallback(() => {
    void navigate({ to: '/sign-in', replace: true })
  }, [navigate])

  /**
   * Redirect to register page
   */
  const redirectToRegister = useCallback(() => {
    void navigate({ to: '/sign-up', replace: true })
  }, [navigate])

  return {
    handleLoginSuccess,
    handleLoginResult,
    redirectTo2FA,
    redirectToLogin,
    redirectToRegister,
  }
}
