import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Menu } from 'lucide-react'

import { AgentSidebar } from '@/components/layout/AgentSidebar'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { ProfileMenu } from '@/components/profile/ProfileMenu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { UserRole } from '@/lib/auth'

type MissionShellProps = {
  role: Exclude<UserRole, 'admin'>
  title?: string
  subtitle?: string
  email?: string
  backTo?: string
  headerSlot?: ReactNode
  hideDefaultHeader?: boolean
  children: ReactNode
}

export function MissionShell({
  role,
  title,
  subtitle,
  email,
  backTo,
  headerSlot,
  hideDefaultHeader = false,
  children,
}: MissionShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const homePath = role === 'photographer' ? '/photographer/calendar' : '/dashboard'

  return (
    <main className="relative min-h-svh">
      {/* Universal Mobile Sticky Top Bar (visible only below lg) */}
      <header className="sticky top-0 z-30 flex lg:hidden items-center justify-between border-b border-[var(--color-border)] bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex size-9 shrink-0 items-center justify-center rounded-sm text-[var(--color-text-secondary)] hover:bg-[#1a1a1a] hover:text-white"
                aria-label="Open navigation menu"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 bg-[#0a0a0a] border-r border-[var(--color-border)]">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation Menu</SheetTitle>
              </SheetHeader>
              <AgentSidebar role={role} isDrawer onNavigate={() => setDrawerOpen(false)} />
            </SheetContent>
          </Sheet>

          {backTo ? (
            <Link
              to={backTo}
              className="shrink-0 rounded-sm p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[#1a1a1a] hover:text-white"
              aria-label="Back"
            >
              <ArrowLeft className="size-5" />
            </Link>
          ) : null}

          <Link
            to={homePath}
            className="shrink-0 flex items-center"
            aria-label="LocalPRO Realty Home"
          >
            <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tighter text-[var(--color-gold)]">
              LP
            </span>
          </Link>

          {title ? (
            <div className="min-w-0 border-l border-[var(--color-border)]/60 pl-2.5">
              <h1 className="truncate font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-white)]">
                {title}
              </h1>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell />
          <ProfileMenu role={role} email={email} />
        </div>
      </header>

      <div className="grid min-h-svh lg:grid-cols-[220px_1fr]">
        <AgentSidebar role={role} />

        <section className="flex min-h-svh flex-col bg-[#0a0a0a]">
          {headerSlot ? (
            headerSlot
          ) : hideDefaultHeader ? null : (
            <header className="hidden lg:flex items-start justify-between border-b border-[var(--color-border)] px-8 py-8">
              <div>
                {title ? (
                  <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-white)]">
                    {title}
                  </h1>
                ) : null}
                {subtitle ? (
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <NotificationBell />
                <ProfileMenu role={role} email={email} />
              </div>
            </header>
          )}
          <div className="flex-1 overflow-y-auto px-8 py-10">{children}</div>
        </section>
      </div>
    </main>
  )
}
