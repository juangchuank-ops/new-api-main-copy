import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string
  shimmerSize?: string
  borderRadius?: string
  shimmerDuration?: string
  background?: string
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (props, ref) => {
    const shimmerColor = props.shimmerColor || '#ffffff'
    const shimmerSize = props.shimmerSize || '0.1em'
    const shimmerDuration = props.shimmerDuration || '2.5s'
    const borderRadius = props.borderRadius || '9999px'
    const background = props.background || 'rgba(15, 23, 42, 1)'

    const {
      className,
      children,
      shimmerColor: _,
      shimmerSize: __,
      shimmerDuration: ___,
      borderRadius: ____,
      background: _____,
      ...restProps
    } = props

    return (
      <button
        ref={ref}
        style={
          {
            '--spread': '90deg',
            '--shimmer-color': shimmerColor,
            '--radius': borderRadius,
            '--speed': shimmerDuration,
            '--cut': shimmerSize,
            '--bg': background,
          } as React.CSSProperties
        }
        className={cn(
          'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/10 px-6 py-3 text-white [background:var(--bg)] [border-radius:var(--radius)] transition-transform duration-300 ease-in-out hover:scale-[1.02] active:scale-[0.98]',
          className
        )}
        {...restProps}
      >
        {/* spark container */}
        <div className="absolute inset-0 -z-30 overflow-visible [container-type:size]">
          {/* spark */}
          <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
            {/* spark before */}
            <div className="absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
          </div>
        </div>
        {children}

        {/* Highlight hover overlay */}
        <div className="absolute inset-0 -z-20 [border-radius:var(--radius)] shadow-[inset_0_-8px_10px_#ffffff1f] transition-all duration-300 group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]" />

        {/* backdrop filter overlay */}
        <div className="absolute inset-[var(--cut)] -z-10 bg-background [border-radius:var(--radius)] transition-all duration-300 ease-in-out group-hover:bg-primary/10" />
      </button>
    )
  }
)

ShimmerButton.displayName = 'ShimmerButton'
