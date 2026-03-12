'use client'

import { cn } from '@/lib/utils/cn'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  dark?: boolean
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

export function GlassCard({
  className,
  dark = false,
  padding = 'md',
  children,
  ...props
}: GlassCardProps) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  return (
    <div
      className={cn(dark ? 'glass-card-dark' : 'glass-card', paddings[padding], className)}
      {...props}
    >
      {children}
    </div>
  )
}
