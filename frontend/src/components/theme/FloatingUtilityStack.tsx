import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, Moon, Sun, Sparkles, X } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * Feature flag for North AI Advisor entry point.
 * Set to true when North AI Advisor is ready to launch.
 */
export const NORTH_ENABLED = false

type FloatingUtilityStackProps = {
  className?: string
  /**
   * If true, applies specific offsets for /listing/:id/form
   * (desktop right-6 bottom-[148px] above VoiceButton, mobile left-4 bottom-[68px] above footer)
   */
  formPageLayout?: boolean
}

export function FloatingUtilityStack({
  className,
  formPageLayout = true,
}: FloatingUtilityStackProps) {
  const [expanded, setExpanded] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!expanded) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [expanded])

  // Positioning coordinates:
  // Mobile: left-4 bottom-[68px] (clears 52px sticky footer, safe over save-status indicator)
  // Desktop: right-6 bottom-[148px] (stacks cleanly above VoiceButton at bottom-20 / 80-136px)
  const positionClasses = formPageLayout
    ? 'fixed left-4 bottom-[68px] lg:left-auto lg:right-6 lg:bottom-[148px] z-40'
    : 'fixed right-6 bottom-6 z-40'

  return (
    <div ref={containerRef} className={cn(positionClasses, className)}>
      <div className="relative flex flex-col items-center">
        {/* Expanded Vertical Stack (animates upward) */}
        <AnimatePresence>
          {expanded ? (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.9 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="mb-2.5 flex flex-col items-center gap-2.5"
            >
              {/* Slot 1: Future North AI Advisor Entry Point (Gated behind NORTH_ENABLED) */}
              {NORTH_ENABLED && (
                <div className="group relative flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      // Future North AI trigger
                    }}
                    title="North AI Advisor (Coming Soon)"
                    aria-label="North AI Advisor (Coming Soon)"
                    className="relative flex size-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-gold)] shadow-md transition-all hover:scale-105 hover:border-[var(--color-gold)] hover:bg-[var(--color-surface-2)] active:scale-95"
                  >
                    <Sparkles className="size-4" />
                  </button>
                  <div className="pointer-events-none absolute left-12 lg:left-auto lg:right-12 hidden whitespace-nowrap rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)] shadow-lg group-hover:flex">
                    North AI <span className="ml-1.5 text-[10px] text-[var(--color-gold)] uppercase tracking-wider font-semibold">Soon</span>
                  </div>
                </div>
              )}

              {/* Slot 2: Theme Toggle Button */}
              <div className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    toggleTheme()
                  }}
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  className="relative flex size-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-md transition-all hover:scale-105 hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] hover:bg-[var(--color-surface-2)] active:scale-95"
                >
                  {theme === 'dark' ? (
                    <Sun className="size-4.5 text-[var(--color-gold)]" />
                  ) : (
                    <Moon className="size-4.5 text-[var(--color-gold)]" />
                  )}
                </button>
                <div className="pointer-events-none absolute left-12 lg:left-auto lg:right-12 hidden whitespace-nowrap rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)] shadow-lg group-hover:flex">
                  {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Base Trigger Button (Collapsed Circular Bubble) */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label={expanded ? 'Close menu' : 'Open quick actions & theme menu'}
          title={expanded ? 'Close' : 'Quick Actions & Theme'}
          className={cn(
            'flex size-11 items-center justify-center rounded-full border border-[var(--color-gold-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all hover:scale-105 hover:border-[var(--color-gold)] hover:shadow-[0_0_16px_rgba(207,184,124,0.3)] active:scale-95',
            expanded && 'border-[var(--color-gold)] bg-[var(--color-surface-2)] text-[var(--color-gold)]',
          )}
        >
          {expanded ? (
            <X className="size-5 transition-transform" />
          ) : (
            <HelpCircle className="size-5 text-[var(--color-gold)]" />
          )}
        </button>
      </div>
    </div>
  )
}
