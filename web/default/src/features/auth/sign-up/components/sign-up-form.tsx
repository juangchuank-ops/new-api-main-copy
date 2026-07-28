import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
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
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { z } from 'zod'

import {
  IconDiscord,
  IconGithub,
  IconLinuxDo,
  IconWeChat,
} from '@/assets/brand-icons'
import { Dialog } from '@/components/dialog'
import { PasswordInput } from '@/components/password-input'
import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  checkInvitationCode,
  register,
  wechatLoginByCode,
} from '@/features/auth/api'
import { LegalConsent } from '@/features/auth/components/legal-consent'
import { registerFormSchema } from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { useEmailVerification } from '@/features/auth/hooks/use-email-verification'
import { useOAuthLogin } from '@/features/auth/hooks/use-oauth-login'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import {
  getAffiliateCode,
  saveAffiliateCode,
} from '@/features/auth/lib/storage'
import type { SystemStatus } from '@/features/auth/types'
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

export function SignUpForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [agreedToLegal, setAgreedToLegal] = useState(false)
  const [wechatCode, setWeChatCode] = useState('')
  const [isWeChatDialogOpen, setIsWeChatDialogOpen] = useState(false)
  const [isWeChatSubmitting, setIsWeChatSubmitting] = useState(false)
  const [validatedInvitationCode, setValidatedInvitationCode] = useState<
    string | null
  >(null)
  // 'options' = landing page with OAuth + invite code; 'form' = username registration form
  const [mode, setMode] = useState<'options' | 'form'>('options')
  const legalConsentErrorMessage = t('Please agree to the legal terms first')

  const form = useForm<z.infer<typeof registerFormSchema>>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: '',
      invitationCode: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })
  const invitationCode = (form.watch('invitationCode') ?? '').trim()

  const { status } = useStatus()
  const {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const { redirectToLogin, handleLoginSuccess } = useAuthRedirect()
  const {
    isSending: isSendingCode,
    secondsLeft,
    isActive,
    sendCode,
  } = useEmailVerification({
    turnstileToken,
    validateTurnstile,
  })
  const {
    isLoading: isOAuthLoading,
    githubButtonText,
    githubButtonDisabled,
    handleGitHubLogin,
    handleDiscordLogin,
    handleOIDCLogin,
    handleLinuxDOLogin,
    handleTelegramLogin,
    handleCustomOAuthLogin,
  } = useOAuthLogin(status, invitationCode)

  const invitationCodeCheck = useMutation({
    mutationFn: checkInvitationCode,
  })

  const emailValue = form.watch('email')
  const invitationCodeRequired = !!status?.invitation_code_enabled
  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)
  const requiresLegalConsent = hasUserAgreement || hasPrivacyPolicy
  const oauthRegisterEnabled =
    status?.oauth_register_enabled ??
    status?.data?.oauth_register_enabled ??
    true
  const hasWeChatLogin = Boolean(status?.wechat_login)
  const turnstileReady = !isTurnstileEnabled || Boolean(turnstileToken)

  // Determine whether the options (landing) screen should appear
  const hasOAuthOptions = useMemo(() => {
    if (!oauthRegisterEnabled) return false
    return !!(
      status?.github_oauth ||
      status?.discord_oauth ||
      status?.oidc_enabled ||
      status?.wechat_login ||
      status?.linuxdo_oauth ||
      status?.telegram_oauth ||
      (status?.custom_oauth_providers &&
        status.custom_oauth_providers.length > 0)
    )
  }, [
    oauthRegisterEnabled,
    status?.github_oauth,
    status?.discord_oauth,
    status?.oidc_enabled,
    status?.wechat_login,
    status?.linuxdo_oauth,
    status?.telegram_oauth,
    status?.custom_oauth_providers,
  ])

  // When there are no OAuth options, the form IS the landing page
  const showOptionsScreen = hasOAuthOptions && mode === 'options'

  // Recompute email verification for the actual form rendering
  const formEmailVerificationRequired = !!status?.email_verification

  const wechatQrCodeUrl = useMemo(() => {
    return (
      status?.wechat_qrcode ||
      status?.wechat_qr_code ||
      status?.wechat_qrcode_image_url ||
      status?.wechat_qr_code_image_url ||
      status?.wechat_account_qrcode_image_url ||
      status?.WeChatAccountQRCodeImageURL ||
      status?.data?.wechat_qrcode ||
      status?.data?.WeChatAccountQRCodeImageURL ||
      ''
    )
  }, [status])

  useEffect(() => {
    if (requiresLegalConsent) {
      setAgreedToLegal(false)
    } else {
      setAgreedToLegal(true)
    }
  }, [requiresLegalConsent])

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const aff = searchParams.get('aff')?.trim()
    if (aff) {
      saveAffiliateCode(aff)
    }
    const invitationCodeParam = searchParams.get('invitation_code')?.trim()
    if (invitationCodeParam) {
      form.setValue('invitationCode', invitationCodeParam, {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }, [form])

  const handleInvitationCodeChange = (code: string) => {
    form.setValue('invitationCode', code, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.clearErrors('invitationCode')
    setValidatedInvitationCode(null)
  }

  const ensureInvitationCodeValid = async (): Promise<boolean> => {
    if (!invitationCodeRequired) return true
    if (!invitationCode) {
      form.setError('invitationCode', {
        type: 'manual',
        message: t('Please enter invitation code'),
      })
      return false
    }
    if (validatedInvitationCode === invitationCode) return true

    try {
      const result = await invitationCodeCheck.mutateAsync(invitationCode)
      if (form.getValues('invitationCode')?.trim() !== invitationCode) {
        return false
      }
      if (!result.success || !result.data?.valid) {
        form.setError('invitationCode', {
          type: 'manual',
          message: t('Invalid or already used invitation code'),
        })
        return false
      }
      setValidatedInvitationCode(invitationCode)
      form.clearErrors('invitationCode')
      return true
    } catch {
      form.setError('invitationCode', {
        type: 'manual',
        message: t('Unable to verify invitation code'),
      })
      return false
    }
  }

  const runRegistrationAction = async (
    action: () => void | Promise<void>
  ): Promise<void> => {
    if (!(await ensureInvitationCodeValid())) return
    await action()
  }

  let invitationCodeFeedback: React.ReactNode = null
  if (invitationCodeCheck.isPending) {
    invitationCodeFeedback = (
      <FormDescription className='flex items-center gap-1.5'>
        <Spinner className='size-3.5' />
        {t('Checking invitation code...')}
      </FormDescription>
    )
  } else if (validatedInvitationCode === invitationCode && invitationCode) {
    invitationCodeFeedback = (
      <FormDescription className='text-success'>
        {t('Invitation code verified')}
      </FormDescription>
    )
  }

  const renderInvitationCodeField = (id: string) => (
    <FormField
      control={form.control}
      name='invitationCode'
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel htmlFor={id}>{t('Invitation Code')}</FormLabel>
          <FormControl>
            <Input
              {...field}
              id={id}
              placeholder={t('Enter invitation code')}
              autoComplete='off'
              autoCapitalize='none'
              spellCheck={false}
              aria-invalid={fieldState.invalid}
              onChange={(event) =>
                handleInvitationCodeChange(event.target.value)
              }
              onBlur={() => {
                field.onBlur()
                if (invitationCode) {
                  void ensureInvitationCodeValid()
                }
              }}
            />
          </FormControl>
          {invitationCodeFeedback}
          <FormMessage />
        </FormItem>
      )}
    />
  )

  // ---- OAuth provider button builder ----
  function buildProviderButtons(status: SystemStatus | null) {
    const buttons: {
      key: string
      label: string
      onClick: () => void
      icon?: React.ReactNode
      disabled?: boolean
    }[] = []

    if (status?.github_oauth) {
      buttons.push({
        key: 'github',
        label: githubButtonText || t('Continue with GitHub'),
        onClick: () => {
          void runRegistrationAction(handleGitHubLogin)
        },
        icon: <IconGithub className='h-4 w-4' />,
        disabled: githubButtonDisabled,
      })
    }

    if (status?.linuxdo_oauth) {
      buttons.push({
        key: 'linuxdo',
        label: t('Continue with LinuxDO'),
        onClick: () => {
          void runRegistrationAction(handleLinuxDOLogin)
        },
        icon: <IconLinuxDo className='h-4 w-4' />,
      })
    }

    if (status?.discord_oauth) {
      buttons.push({
        key: 'discord',
        label: t('Continue with Discord'),
        onClick: () => {
          void runRegistrationAction(handleDiscordLogin)
        },
        icon: <IconDiscord className='h-4 w-4' />,
      })
    }

    if (status?.oidc_enabled) {
      buttons.push({
        key: 'oidc',
        label: t('Continue with OIDC'),
        onClick: () => {
          void runRegistrationAction(handleOIDCLogin)
        },
      })
    }

    if (status?.wechat_login) {
      buttons.push({
        key: 'wechat',
        label: t('Continue with WeChat'),
        onClick: () => {
          void runRegistrationAction(handleOpenWeChatDialog)
        },
        icon: <IconWeChat className='h-4 w-4' />,
      })
    }

    if (status?.telegram_oauth) {
      buttons.push({
        key: 'telegram',
        label: t('Continue with Telegram'),
        onClick: () => {
          void runRegistrationAction(handleTelegramLogin)
        },
      })
    }

    if (
      status?.custom_oauth_providers &&
      status.custom_oauth_providers.length > 0
    ) {
      for (const provider of status.custom_oauth_providers) {
        buttons.push({
          key: `custom-${provider.slug}`,
          label: t('Continue with {{name}}', { name: provider.name }),
          onClick: () => {
            void runRegistrationAction(() => handleCustomOAuthLogin(provider))
          },
        })
      }
    }

    return buttons
  }

  async function onSubmit(data: z.infer<typeof registerFormSchema>) {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }

    if (!(await ensureInvitationCodeValid())) return

    // Validate email verification if required
    if (formEmailVerificationRequired) {
      if (!data.email) {
        toast.error(t('Please enter your email'))
        return
      }
      if (!verificationCode) {
        toast.error(t('Please enter the verification code'))
        return
      }
    }

    if (!validateTurnstile()) return

    setIsLoading(true)
    try {
      const res = await register({
        username: data.username,
        password: data.password,
        email: data.email || undefined,
        verification_code: verificationCode || undefined,
        aff_code: getAffiliateCode(),
        turnstile: turnstileToken,
        invitation_code: invitationCode || undefined,
      })

      if (res?.success) {
        toast.success(t('Account created! Please sign in'))
        redirectToLogin()
      } else {
        toast.error(res?.message || t('Failed to create account'))
      }
    } catch {
      // Errors are handled by global interceptor
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSendVerificationCode() {
    await sendCode(emailValue || '')
  }

  const handleOpenWeChatDialog = () => {
    setIsWeChatDialogOpen(true)
  }

  const handleWeChatDialogChange = (open: boolean) => {
    setIsWeChatDialogOpen(open)
    if (!open) {
      setWeChatCode('')
      setIsWeChatSubmitting(false)
    }
  }

  async function handleWeChatLogin() {
    if (!wechatCode.trim()) {
      toast.error(t('Please enter the verification code'))
      return
    }

    setIsWeChatSubmitting(true)
    try {
      const res = await wechatLoginByCode(wechatCode)
      if (res?.success) {
        await handleLoginSuccess(res.data as { id?: number } | null)
        toast.success(t('Signed in via WeChat'))
        handleWeChatDialogChange(false)
      } else {
        toast.error(res?.message || t('Login failed'))
      }
    } catch {
      toast.error(t('Login failed'))
    } finally {
      setIsWeChatSubmitting(false)
    }
  }

  let sendCodeButtonContent: React.ReactNode = t('Send code')
  if (isActive) {
    sendCodeButtonContent = t('Resend ({{seconds}}s)', { seconds: secondsLeft })
  } else if (isSendingCode) {
    sendCodeButtonContent = <Loader2 className='h-4 w-4 animate-spin' />
  }

  const providerButtons = buildProviderButtons(status)

  // ===================== Options Landing Screen =====================
  const renderOptionsScreen = () => {
    return (
      <div className='grid gap-4'>
        {/* OAuth Provider Buttons */}
        {providerButtons.length > 0 && (
          <div className='flex flex-col gap-2'>
            {providerButtons.map(
              ({ key, label, onClick, icon, disabled: extraDisabled }) => (
                <Button
                  key={key}
                  variant='outline'
                  type='button'
                  disabled={
                    isOAuthLoading ||
                    invitationCodeCheck.isPending ||
                    extraDisabled
                  }
                  onClick={onClick}
                  className='h-11 w-full justify-center gap-2 rounded-lg'
                >
                  {icon}
                  {label}
                </Button>
              )
            )}
          </div>
        )}

        {/* 或 divider */}
        <div className='relative'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t' />
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='bg-background text-muted-foreground px-2'>
              {t('Or')}
            </span>
          </div>
        </div>

        {/* Invitation Code Input (always visible when feature enabled) */}
        {invitationCodeRequired &&
          renderInvitationCodeField('signup-invitation-code')}

        {/* Sign up with username button */}
        <Button
          type='button'
          className='w-full justify-center gap-2'
          disabled={invitationCodeCheck.isPending}
          onClick={() => {
            void runRegistrationAction(() => setMode('form'))
          }}
        >
          {t('Sign up with username')}
        </Button>

        {/* Turnstile */}
        {isTurnstileEnabled && (
          <div className='mt-2'>
            <Turnstile
              siteKey={turnstileSiteKey}
              onVerify={setTurnstileToken}
            />
          </div>
        )}

        {/* Login link */}
        <div className='-mx-5 mt-4 border-t px-5 pt-4 pb-2 sm:-mx-8 sm:px-8'>
          <p className='text-muted-foreground text-sm'>
            {t('Already have an account?')}{' '}
            <Link
              to='/sign-in'
              className='hover:text-primary font-medium underline underline-offset-4'
            >
              {t('Sign in')}
            </Link>
          </p>
        </div>
      </div>
    )
  }

  // ===================== Username Registration Form Screen =====================
  const renderFormScreen = () => (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className={cn('grid gap-4', className)}
      {...props}
    >
      {/* Invitation Code (when no OAuth options and invite code required) */}
      {!hasOAuthOptions &&
        invitationCodeRequired &&
        renderInvitationCodeField('signup-invitation-code-form')}

      {/* Back to options */}
      {hasOAuthOptions && (
        <Button
          type='button'
          variant='ghost'
          className='gap-1px -ml-2 w-fit'
          onClick={() => setMode('options')}
        >
          <ArrowLeft className='h-4 w-4' />
          {t('Other sign-up options')}
        </Button>
      )}

      {/* Username Field */}
      <FormField
        control={form.control}
        name='username'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('Username')}</FormLabel>
            <FormControl>
              <Input placeholder={t('Enter your username')} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Password Field */}
      <FormField
        control={form.control}
        name='password'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('Password')}</FormLabel>
            <FormControl>
              <PasswordInput
                placeholder={t('Enter password (8-20 characters)')}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Confirm Password Field */}
      <FormField
        control={form.control}
        name='confirmPassword'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('Confirm password')}</FormLabel>
            <FormControl>
              <PasswordInput placeholder={t('Confirm password')} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Email Verification Section (only in form) */}
      {formEmailVerificationRequired && (
        <>
          {/* Email Field */}
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Email (required for verification)')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('name@example.com')}
                    type='email'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Verification Code Field */}
          <div className='flex items-end gap-2'>
            <div className='flex-1'>
              <Input
                placeholder={t('Verification code')}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
              />
            </div>
            <Button
              variant='outline'
              type='button'
              disabled={
                isLoading ||
                isSendingCode ||
                isActive ||
                !emailValue ||
                !turnstileReady
              }
              onClick={handleSendVerificationCode}
            >
              {sendCodeButtonContent}
            </Button>
          </div>
        </>
      )}

      {/* Turnstile */}
      {isTurnstileEnabled && (
        <div className='mt-2'>
          <Turnstile siteKey={turnstileSiteKey} onVerify={setTurnstileToken} />
        </div>
      )}

      <LegalConsent
        status={status}
        checked={agreedToLegal}
        onCheckedChange={setAgreedToLegal}
        className='mt-1'
      />

      {/* Submit Button */}
      <Button
        type='submit'
        className='mt-2 w-full justify-center gap-2'
        disabled={
          isLoading ||
          invitationCodeCheck.isPending ||
          (requiresLegalConsent && !agreedToLegal) ||
          !turnstileReady
        }
      >
        {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
        {t('Create account')}
      </Button>
    </form>
  )

  return (
    <Form {...form}>
      {showOptionsScreen ? renderOptionsScreen() : renderFormScreen()}

      {hasWeChatLogin && (
        <Dialog
          open={isWeChatDialogOpen}
          onOpenChange={handleWeChatDialogChange}
          title={t('WeChat sign in')}
          description={t(
            'Scan the QR code to follow the official account and reply with "验证码" to receive your verification code.'
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
                onClick={() => handleWeChatDialogChange(false)}
                disabled={isWeChatSubmitting}
              >
                {t('Cancel')}
              </Button>
              <Button
                type='button'
                onClick={handleWeChatLogin}
                disabled={
                  isWeChatSubmitting ||
                  !wechatCode.trim() ||
                  (requiresLegalConsent && !agreedToLegal)
                }
                className='gap-2'
              >
                {isWeChatSubmitting ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : null}
                {t('Confirm')}
              </Button>
            </>
          }
        >
          {wechatQrCodeUrl ? (
            <div className='flex justify-center'>
              <img
                src={wechatQrCodeUrl}
                alt={t('WeChat login QR code')}
                className='h-40 w-40 rounded-md border object-contain'
              />
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('QR code is not configured. Please contact support.')}
            </p>
          )}
          <div className='grid gap-2'>
            <Label htmlFor='wechat-code'>{t('Verification code')}</Label>
            <Input
              id='wechat-code'
              placeholder={t('Enter the verification code')}
              value={wechatCode}
              onChange={(event) => setWeChatCode(event.target.value)}
              autoComplete='one-time-code'
            />
          </div>
        </Dialog>
      )}
    </Form>
  )
}
