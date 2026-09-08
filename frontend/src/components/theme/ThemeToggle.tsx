import { Moon, Sun } from 'lucide-react'

import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]',
        className,
      )}
    >
      {theme === 'dark' ? (
        <Sun className="size-4 text-[var(--color-gold)] transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="size-4 text-[var(--color-gold)] transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  )
}
