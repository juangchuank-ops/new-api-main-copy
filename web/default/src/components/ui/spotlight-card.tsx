import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string
  spotlightSize?: number
}

export function SpotlightCard(props: SpotlightCardProps) {
  const spotlightColor = props.spotlightColor || 'rgba(99, 102, 241, 0.15)'
  const spotlightSize = props.spotlightSize || 350
  
  const cardRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState<{ x: number; y: number }>({ x: -500, y: -500 })
  const [isHovered, setIsHovered] = React.useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => {
    setIsHovered(false)
    setPosition({ x: -500, y: -500 })
  }

  const { className, children, spotlightColor: _, spotlightSize: __, ...restProps } = props

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60 bg-card/80 p-6 shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-md backdrop-blur-sm',
        className
      )}
      {...restProps}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(${spotlightSize}px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
