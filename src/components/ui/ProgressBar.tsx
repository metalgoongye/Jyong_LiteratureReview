'use client'

import { cn } from '@/lib/utils/cn'

interface ProgressBarProps {
  value: number // 0–100
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function ProgressBar({ value, className, showLabel = false, size = 'md' }: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value))
  const color =
    clampedValue >= 90
      ? 'bg-emerald-500'
      : clampedValue >= 70
      ? 'bg-amber-500'
      : 'bg-red-500'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex-1 bg-black/10 rounded-full overflow-hidden',
          size === 'sm' ? 'h-1' : 'h-1.5'
        )}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs opacity-60 w-10 text-right">{clampedValue.toFixed(0)}%</span>
      )}
    </div>
  )
}
