import type { ReactNode } from 'react'

import { ThemeToggle } from '@/components/theme/ThemeToggle'

type AuthenticatedLayoutProps = {
  children: ReactNode
}

/**
 * Root-level layout wrapping every authenticated route.
 * Provides a single, guaranteed, consistent location for the theme toggle
 * across all shells, mission headers, and custom pages.
 */
export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <div className="relative min-h-svh">
      <aside
        aria-label="Theme controls"
        className="fixed top-6 right-6 z-40 sm:top-7 sm:right-8"
      >
        <ThemeToggle className="shadow-sm backdrop-blur-md" />
      </aside>
      {children}
    </div>
  )
}
