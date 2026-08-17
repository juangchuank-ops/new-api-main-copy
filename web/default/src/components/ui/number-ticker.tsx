import * as React from 'react'
import { cn } from '@/lib/utils'

export interface NumberTickerProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number
  direction?: 'up' | 'down'
  delay?: number // in seconds
  decimalPlaces?: number
}

export function NumberTicker(props: NumberTickerProps) {
  const value = props.value
  const direction = props.direction || 'up'
  const delay = props.delay || 0
  const decimalPlaces = props.decimalPlaces !== undefined ? props.decimalPlaces : 0

  const [displayValue, setDisplayValue] = React.useState<number>(direction === 'down' ? value : 0)
  const ref = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    let startTimestamp: number | null = null
    const duration = 1200 // ms
    const startValue = direction === 'down' ? value : 0
    const endValue = value

    const timer = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp
        const progress = Math.min((timestamp - startTimestamp) / duration, 1)

        // EaseOutExpo curve for sleek modern feel
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
        const current = startValue + (endValue - startValue) * easeProgress

        setDisplayValue(current)

        if (progress < 1) {
          window.requestAnimationFrame(step)
        }
      }

      window.requestAnimationFrame(step)
    }, delay * 1000)

    return () => clearTimeout(timer)
  }, [value, direction, delay])

  const formatted = displayValue.toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  })

  const { className, value: _, direction: __, delay: ___, decimalPlaces: ____, ...restProps } = props

  return (
    <span ref={ref} className={cn('inline-block font-mono tracking-tight', className)} {...restProps}>
      {formatted}
    </span>
  )
}
