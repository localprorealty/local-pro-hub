import { useState } from 'react'
import { ArrowLeft, Menu } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AgentSidebar } from '@/components/layout/AgentSidebar'
import { ListingIdBadge } from '@/components/listings/ListingIdBadge'
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

type ListingMissionHeaderProps = {
  backTo: string
  backLabel?: string
  title: string
  subtitle?: string
  listingId?: string
  role?: Exclude<UserRole, 'admin'>
  email?: string
}

export function ListingMissionHeader({
  backTo,
  backLabel = 'Back to listing',
  title,
  subtitle,
  listingId,
  role = 'agent',
  email,
}: ListingMissionHeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[#0a0a0a]/95 px-4 py-3 lg:px-8 lg:py-5 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3 lg:gap-4">
        {/* Mobile hamburger drawer trigger */}
        <div className="lg:hidden">
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
        </div>

        <Link
          to={backTo}
          className="shrink-0 rounded-sm p-1.5 lg:p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[#1a1a1a] hover:text-white"
          aria-label={backLabel}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-[family-name:var(--font-display)] text-sm lg:text-xl font-semibold text-white">
            {title}
          </h1>
          <div className="hidden sm:flex flex-wrap items-center gap-2">
            {subtitle ? (
              <p className="truncate text-xs lg:text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
            ) : null}
            {listingId ? (
              <>
                {subtitle ? <span className="text-[#555555]">·</span> : null}
                <ListingIdBadge id={listingId} />
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 lg:gap-3 shrink-0">
        <NotificationBell />
        <ProfileMenu role={role} email={email} />
      </div>
    </header>
  )
}
