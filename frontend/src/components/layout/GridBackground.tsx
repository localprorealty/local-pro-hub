import { cn } from '@/lib/utils'

type GridBackgroundProps = {
  /** Optional override. If omitted, dynamically adapts to current light/dark theme variables. */
  variant?: 'dark' | 'light'
  /** Cover the full viewport (app shell) or only a positioned parent */
  fixed?: boolean
  className?: string
}

const GRID_STYLES: Record<'dark' | 'light', { lines: string; base: string }> = {
  dark: {
    lines: `
      linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
    `,
    base: 'var(--color-black)',
  },
  light: {
    lines: `
      linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
    `,
    base: 'var(--color-bg-base)',
  },
}

export function GridBackground({
  variant,
  fixed = false,
  className,
}: GridBackgroundProps) {
  const customStyle = variant ? GRID_STYLES[variant] : null
  const base = customStyle ? customStyle.base : 'var(--color-bg-base)'
  const lines = customStyle
    ? customStyle.lines
    : `linear-gradient(to right, var(--grid-line-color) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line-color) 1px, transparent 1px)`

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none',
        fixed ? 'fixed inset-0 z-0' : 'absolute inset-0 z-0',
        className,
      )}
      style={{
        backgroundColor: base,
        backgroundImage: lines,
        backgroundSize: '40px 40px',
      }}
    />
  )
}

/** Sidebar / panel surfaces that let the grid show through slightly */
export const shellPanelClass =
  'bg-[var(--color-surface)]/90 backdrop-blur-[2px]'
