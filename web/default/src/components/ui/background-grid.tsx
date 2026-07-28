import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BackgroundGridProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'grid' | 'dots' | 'mesh'
  glow?: boolean
}

export function BackgroundGrid(props: BackgroundGridProps) {
  const variant = props.variant || 'grid'
  const glow = props.glow !== false
  const { className, variant: _, glow: __, children, ...restProps } = props

  return (
    <div className={cn('relative w-full overflow-hidden', className)} {...restProps}>
      {/* Dynamic Background Pattern */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.12]',
          variant === 'grid' &&
            'bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]',
          variant === 'dots' &&
            'bg-[radial-gradient(#80808033_1px,transparent_1px)] bg-[size:16px_16px]',
          variant === 'mesh' &&
            'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-slate-900/0 to-transparent'
        )}
      />

      {/* Radial Glow Overlay */}
      {glow && (
        <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-500/20 via-purple-500/15 to-pink-500/0 blur-[100px] dark:from-indigo-600/20 dark:via-purple-600/15 dark:to-transparent" />
      )}

      {children}
    </div>
  )
}
