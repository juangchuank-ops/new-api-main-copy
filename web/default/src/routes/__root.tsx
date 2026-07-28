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

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  // 应用初始化与路由解析前统一校验会话
  beforeLoad: async ({ location }) => {
    const pathname = location?.pathname || ''
    const needsSetupCheck =
      !setupDoneCached && !pathname.startsWith('/setup')

    // 用户信息已通过 auth-store 从 localStorage 恢复
    // 如果 auth.user 存在，说明用户已登录（有缓存的用户数据）
    // 如果 auth.user 为 null，说明用户未登录，直接让 _authenticated 路由处理重定向
    // 不再调用 getSelf() API，避免不必要的网络请求和等待

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
    // 用户认证状态完全依赖 localStorage 缓存
    // 如果用户有有效 session 但 localStorage 被清空，会被重定向到登录页重新登录
  },
  component: RootComponent,
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})
