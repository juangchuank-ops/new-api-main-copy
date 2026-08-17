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
import { useEffect, useRef, useState } from 'react'
import type { AxiosRequestConfig } from 'axios'
import {
  createFileRoute,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import i18next from 'i18next'
import { toast } from 'sonner'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { api, getSelf } from '@/lib/api'
import { OAuthCallbackScreen } from '@/features/auth/components/oauth-callback-screen'
import { InvitationCodeDialog } from '@/features/auth/components/invitation-code-dialog'
import { OAUTH_BIND_STORAGE_KEY } from '@/features/auth/constants'

type OAuthRequestConfig = AxiosRequestConfig & {
  skipBusinessError?: boolean
}

function OAuthCallback() {
  const navigate = useNavigate()
  const { provider } = useParams({ from: '/oauth/$provider' }) as {
    provider: string
  }
  const search = useSearch({ from: '/oauth/$provider' }) as {
    code?: string
    state?: string
    redirect?: string
  }
  const [mode, setMode] = useState<'login' | 'bind'>(() => {
    if (typeof window === 'undefined') return 'login'
    return window.opener ? 'bind' : 'login'
  })
  // Invitation code dialog state
  const [isInvitationCodeDialogOpen, setIsInvitationCodeDialogOpen] =
    useState(false)
  const [invitationCodeProvider, setInvitationCodeProvider] = useState('')
  // Track whether registration succeeded so the dialog close handler
  // does not navigate to /sign-in when closing after a successful submit.
  const registrationCompletedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(window.opener ? 'bind' : 'login')
  }, [])

  useEffect(() => {
    ;(async () => {
      const safeNavigate = (target: string) => {
        navigate({ to: target as never, replace: true })
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            const normalizedTarget = target.startsWith('/')
              ? target
              : `/${target}`
            const currentPath =
              window.location.pathname + window.location.search
            if (
              currentPath !== normalizedTarget &&
              currentPath !== `${normalizedTarget}/`
            ) {
              window.location.replace(target)
            }
          }, 100)
        }
      }

      if (!search?.code) {
        toast.error(i18next.t('Missing code'))
        safeNavigate('/sign-in')
        return
      }
      const isBindingFlow =
        typeof window !== 'undefined' ? Boolean(window.opener) : mode === 'bind'
      if (isBindingFlow && mode !== 'bind') {
        setMode('bind')
      } else if (!isBindingFlow && mode !== 'login') {
        setMode('login')
      }
      const notifyBindingResult = (status: 'success' | 'error') => {
        if (typeof window === 'undefined') return
        try {
          window.localStorage.setItem(
            OAUTH_BIND_STORAGE_KEY,
            JSON.stringify({
              provider,
              status,
              timestamp: Date.now(),
            })
          )
        } catch (_error) {
          // ignore storage write failures
          void _error
        }
      }

      const closeBindingWindow = () => {
        if (typeof window === 'undefined') return
        window.close()
        setTimeout(() => {
          if (!window.closed) {
            window.location.replace('/_authenticated/profile/')
          }
        }, 200)
      }

      const finalizeLogin = async (): Promise<boolean> => {
        try {
          const selfResponse = (await getSelf()) as {
            success?: boolean
            data?: AuthUser | null
          }
          if (selfResponse?.success && selfResponse.data) {
            useAuthStore.getState().auth.setUser(selfResponse.data)
            try {
              if (
                typeof window !== 'undefined' &&
                selfResponse.data?.id != null
              ) {
                window.localStorage.setItem('uid', String(selfResponse.data.id))
              }
            } catch (_error) {
              void _error
            }
            return true
          }
        } catch (_error) {
          void _error
        }
        return false
      }

      const redirectAfterLogin = (target?: string) => {
        const to = target || search?.redirect || '/dashboard'
        safeNavigate(to)
        toast.success(i18next.t('Signed in successfully!'))
      }

      const handleBindingFailure = (message: string) => {
        notifyBindingResult('error')
        toast.error(message)
      }

      const handleLoginFailure = async (message: string) => {
        if (await finalizeLogin()) {
          redirectAfterLogin()
          return
        }
        toast.error(message)
        safeNavigate('/sign-in')
      }

      try {
        const config: OAuthRequestConfig = {
          params: { code: search.code, state: search.state },
          skipBusinessError: true,
        }
        const res = await api.get(`/api/oauth/${provider}`, config)
        if (res?.data?.success) {
          const { message } = res.data
          const loginUser = (res.data?.data ?? null) as AuthUser | null
          // Check if this is a bind operation
          if (message === 'bind') {
            toast.success(i18next.t('Binding successful!'))
            notifyBindingResult('success')
            if (isBindingFlow) {
              // Close the callback window if we opened a new tab for binding
              closeBindingWindow()
            } else {
              safeNavigate('/_authenticated/profile/')
            }
            return
          }
          // Otherwise it's a login, use payload user if available
          if (loginUser) {
            useAuthStore.getState().auth.setUser(loginUser)
            try {
              if (typeof window !== 'undefined' && loginUser.id != null) {
                window.localStorage.setItem('uid', String(loginUser.id))
              }
            } catch (_error) {
              void _error
            }
            redirectAfterLogin()
            return
          }
          if (await finalizeLogin()) {
            redirectAfterLogin()
            return
          }
          toast.error(res?.data?.message || i18next.t('OAuth failed'))
          safeNavigate('/sign-in')
          return
        }

        // Check if invitation code is required (new user registration)
        if (res?.data?.invitation_code_required) {
          setInvitationCodeProvider(res.data.provider || provider)
          setIsInvitationCodeDialogOpen(true)
          return
        }

        const message = res?.data?.message || 'OAuth failed'
        if (!res?.data?.success && !isBindingFlow) {
          // When logging in with an already bound GitHub account, backend may return this message
          if (message === '该 GitHub 账户已被绑定') {
            if (await finalizeLogin()) {
              redirectAfterLogin()
              return
            }
          }
        }
        if (isBindingFlow) {
          handleBindingFailure(message)
        } else {
          await handleLoginFailure(message)
        }
        return
      } catch (error) {
        const message = ((error &&
          typeof error === 'object' &&
          'response' in error &&
          (error as { response?: { data?: { message?: string } } }).response
            ?.data?.message) ??
          (error instanceof Error ? error.message : undefined) ??
          'OAuth failed') as string

        if (isBindingFlow) {
          handleBindingFailure(message)
          return
        }
        await handleLoginFailure(message)
        return
      }
    })()
  }, [mode, navigate, provider, search])

  const handleInvitationCodeConfirm = async (invitationCode: string) => {
    try {
      const res = await api.post('/api/oauth/complete', {
        invitation_code: invitationCode,
      })

      if (res?.data?.success) {
        // Mark as completed BEFORE closing the dialog so the onOpenChange
        // handler knows not to navigate to /sign-in.
        registrationCompletedRef.current = true
        setIsInvitationCodeDialogOpen(false)
        const loginUser = (res.data?.data ?? null) as AuthUser | null
        if (loginUser) {
          useAuthStore.getState().auth.setUser(loginUser)
          try {
            if (typeof window !== 'undefined' && loginUser.id != null) {
              window.localStorage.setItem('uid', String(loginUser.id))
            }
          } catch (_error) {
            void _error
          }
        }
        // Finalize login by fetching user data
        if (await getSelf().then((r) => r?.success).catch(() => false)) {
          const target = search?.redirect || '/dashboard'
          navigate({ to: target as never, replace: true })
          toast.success(i18next.t('Signed in successfully!'))
          return
        }
        navigate({ to: '/sign-in', replace: true })
        return
      }

      // If user already registered, redirect to sign-in
      const message = res?.data?.message || ''
      if (message.includes('already registered')) {
        registrationCompletedRef.current = true
        setIsInvitationCodeDialogOpen(false)
        toast.info(i18next.t('Account already exists. Please sign in.'))
        navigate({ to: '/sign-in', replace: true })
        return
      }

      toast.error(
        res?.data?.message || i18next.t('Invalid invitation code')
      )
    } catch (_error) {
      toast.error(i18next.t('Failed to complete registration'))
    }
  }

  const handleInvitationCodeDialogClose = () => {
    setIsInvitationCodeDialogOpen(false)
    // Only navigate to /sign-in if the user manually closed the dialog
    // (not after a successful registration which handles its own navigation).
    if (!registrationCompletedRef.current) {
      toast.info(i18next.t('Registration cancelled. Please sign in.'))
      navigate({ to: '/sign-in', replace: true })
    }
  }

  return (
    <>
      <OAuthCallbackScreen provider={provider} mode={mode} />
      <InvitationCodeDialog
        open={isInvitationCodeDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleInvitationCodeDialogClose()
          else setIsInvitationCodeDialogOpen(true)
        }}
        onConfirm={handleInvitationCodeConfirm}
        providerName={invitationCodeProvider}
      />
    </>
  )
}

export const Route = createFileRoute('/oauth/$provider')({
  component: OAuthCallback,
})
