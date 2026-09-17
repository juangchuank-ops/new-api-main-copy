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
import { useEffect } from 'react'
import { type QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ThemeCustomizationProvider } from '@/context/theme-customization-provider'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Toaster } from '@/components/ui/sonner'
import { NavigationProgress } from '@/components/navigation-progress'
import { saveAffiliateCode } from '@/features/auth/lib/storage'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'
import { getSetupStatus } from '@/features/setup/api'
import { bootstrapAuthentication } from '@/lib/auth-session'

function RootComponent() {
  // Load system configuration (logo, system name, etc.) from backend
  useSystemConfig({ autoLoad: true })

  useEffect(() => {
    const aff = new URLSearchParams(window.location.search).get('aff')?.trim()
    if (aff) {
      saveAffiliateCode(aff)
    }
  }, [])

  return (
    <ThemeCustomizationProvider>
      <NavigationProgress />
      <Outlet />
      <Toaster closeButton duration={5000} position='top-center' richColors />
      {import.meta.env.MODE === 'development' && (
        <>
          <ReactQueryDevtools buttonPosition='bottom-left' />
          <TanStackRouterDevtools position='bottom-right' />
        </>
      )}
    </ThemeCustomizationProvider>
  )
}

// 清理旧的缓存 key（原 setup_status_checked 已废弃）
const SETUP_DONE_DEPRECATED_KEY = 'setup_status_checked'
try {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(SETUP_DONE_DEPRECATED_KEY)
  }
} catch {
  /* empty */
}

// 缓存 setup 已完成的状态，避免每次导航都重复调用 API
// 仅当 setup 已完成时才缓存，未完成时不缓存以便下次重新检查
const SETUP_DONE_KEY = 'setup_status_done'

function isSetupDoneFromCache(): boolean {
  try {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(SETUP_DONE_KEY) === 'true'
    }
  } catch {
    /* empty */
  }
  return false
}

function setSetupDoneCache(value: boolean): void {
  try {
    if (typeof window !== 'undefined') {
      if (value) {
        window.localStorage.setItem(SETUP_DONE_KEY, 'true')
      } else {
        window.localStorage.removeItem(SETUP_DONE_KEY)
      }
    }
  } catch {
    /* empty */
  }
}

// 内存中的标记：只有 setup 已完成才缓存，未完成则每次都检查
let setupDoneCached = isSetupDoneFromCache()

// 会话恢复只做一次。
// beforeLoad 在每次导航（含 defaultPreload: 'intent' 的预加载）都会执行，
// 用模块级标记把 bootstrap 限制成「每次整页加载一次」——整页刷新时模块会重新求值，
// 所以刷新后仍会重新恢复会话，而站内跳转不会反复打刷新接口。
let authBootstrapped = false

// 刷新接口异常时的兜底：不能把整个应用永久卡在空白页。
// 超时后按未登录继续渲染，用户最多是回到登录页重新登录一次。
const AUTH_BOOTSTRAP_TIMEOUT_MS = 5000

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  // 应用初始化与路由解析前统一校验会话
  beforeLoad: async ({ location }) => {
    const pathname = location?.pathname || ''
    const needsSetupCheck =
      !setupDoneCached && !pathname.startsWith('/setup')

    // 先恢复登录态，再决定后续路由。
    // 登录态只存在内存里（auth-store 没有 persist，access token 刻意不落盘），
    // 整页刷新后内存是空的，必须拿 HttpOnly refresh cookie 去换一份新的 access token，
    // 否则一按 F5 就会被 _authenticated 守卫当成未登录弹回登录页。
    // 这一步必须在子路由的 beforeLoad 之前 await 完，_authenticated 才看得到恢复出来的用户。
    if (!authBootstrapped) {
      authBootstrapped = true
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          bootstrapAuthentication(),
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, AUTH_BOOTSTRAP_TIMEOUT_MS)
          }),
        ])
      } catch {
        // 恢复失败不阻断路由：确实未登录时由 _authenticated 守卫重定向，
        // 已过期时由 api.ts 的 401 拦截器兜底。
      } finally {
        if (timer) clearTimeout(timer)
      }
    }

    // 只检查 setup 状态（如果需要）
    if (needsSetupCheck) {
      const status = await getSetupStatus().catch((error) => {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[root.beforeLoad] setup status check failed', error)
        }
        return null
      })

      if (status?.success && status.data && !status.data.status) {
        throw redirect({ to: '/setup' })
      }

      // 只有 setup 已完成时才缓存，未完成时不缓存以便下次重新检查
      if (status?.success && status.data && status.data.status) {
        setupDoneCached = true
        setSetupDoneCache(true)
      }
    }
    // 会话已在上方恢复完毕：auth.user 存在即视为已登录，
    // 为 null 则交给 _authenticated 守卫重定向到登录页。
  },
  component: RootComponent,
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})
