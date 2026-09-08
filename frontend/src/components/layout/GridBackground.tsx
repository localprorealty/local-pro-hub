import { cn } from '@/lib/utils'

type GridBackgroundProps = {
  /** dark = white lines on black (Mission Control). light = subtle lines on white auth forms. */
  variant?: 'dark' | 'light'
  /** Cover the full viewport (app shell) or only a positioned parent */
  fixed?: boolean
  className?: string
}

const GRID_STYLES: Record<'dark' | 'light', { lines: string; base?: string }> = {
  dark: {
    lines: `
      linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
    `,
    base: 'var(--color-black)',
  },
  light: {
    lines: `
      linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)
    `,
    base: 'transparent',
  },
}

export function GridBackground({
  variant = 'dark',
  fixed = false,
  className,
}: GridBackgroundProps) {
  const style = GRID_STYLES[variant]

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none',
        fixed ? 'fixed inset-0 z-0' : 'absolute inset-0 z-0',
        className,
      )}
      style={{
        backgroundColor: style.base,
        backgroundImage: style.lines,
        backgroundSize: '40px 40px',
      }}
    />
  )
}

/** Sidebar / panel surfaces that let the grid show through slightly */
export const shellPanelClass =
  'bg-[var(--color-surface-2)]/82 backdrop-blur-[2px]'
