import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  Check,
  CircleDollarSign,
  FileText,
  ImageIcon,
  Menu,
  Settings2,
  Users,
  Wrench,
  RefreshCw,
} from 'lucide-react'

import { shellPanelClass } from '@/components/layout/GridBackground'
import { QuickLinks } from '@/components/layout/QuickLinks'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { ProfileMenu } from '@/components/profile/ProfileMenu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

type AdminShellProps = {
  title: string
  eyebrow?: string
  children: ReactNode
}

function ShellNavLink({
  to,
  icon,
  label,
  end = false,
  onClick,
}: {
  to: string
  icon: ReactNode
  label: string
  end?: boolean
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex w-full items-center gap-3 px-4 py-3 text-left text-xs tracking-wide uppercase transition-colors ${
          isActive
            ? 'border-l-4 border-[var(--color-gold)] bg-[var(--color-surface-3)] text-[var(--color-gold)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-white)]'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

function AdminSidebarNav({
  onNavigate,
  isDrawer = false,
}: {
  onNavigate?: () => void
  isDrawer?: boolean
}) {
  return (
    <div className={`flex flex-col overflow-hidden ${isDrawer ? 'h-full bg-[#0a0a0a]' : 'h-svh'}`}>
      <div className="shrink-0 px-6 py-6">
        <NavLink
          to="/admin/pipeline"
          onClick={onNavigate}
          className="block transition-opacity hover:opacity-90"
        >
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tighter text-[var(--color-gold)]">
            LP
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold">
            Mission Control
          </h1>
        </NavLink>
        <p className="mt-1 text-[10px] tracking-widest text-[var(--color-text-secondary)] uppercase">
          LocalPRO Realty
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        <nav>
          <ShellNavLink
            to="/admin/pipeline"
            end
            icon={<FileText className="size-4" />}
            label="Overview"
            onClick={onNavigate}
          />
          <ShellNavLink
            to="/admin/approvals"
            icon={<Check className="size-4" />}
            label="Approvals"
            onClick={onNavigate}
          />
          <ShellNavLink
            to="/admin/agents"
            icon={<Users className="size-4" />}
            label="Agents"
            onClick={onNavigate}
          />
          <ShellNavLink
            to="/admin/photographers"
            icon={<ImageIcon className="size-4" />}
            label="Photographers"
            onClick={onNavigate}
          />
          <ShellNavLink
            to="/admin/marketing"
            icon={<CircleDollarSign className="size-4" />}
            label="Marketing Team"
            onClick={onNavigate}
          />
          <ShellNavLink
            to="/admin/templates"
            icon={<FileText className="size-4" />}
            label="Templates"
            onClick={onNavigate}
          />
          <ShellNavLink
            to="/admin/automations"
            icon={<Wrench className="size-4" />}
            label="Automations"
            onClick={onNavigate}
          />
          <ShellNavLink
            to="/admin/brokermint"
            icon={<RefreshCw className="size-4" />}
            label="BrokerMint Sync"
            onClick={onNavigate}
          />
          <ShellNavLink
            to="/admin/revenue"
            icon={<CircleDollarSign className="size-4" />}
            label="Agent Commissions"
            onClick={onNavigate}
          />
          <ShellNavLink
            to="/admin/revenue-share"
            icon={<Users className="size-4" />}
            label="Revenue Share"
            onClick={onNavigate}
          />
          <ShellNavLink
            to="/admin/resources"
            icon={<Settings2 className="size-4" />}
            label="Resources"
            onClick={onNavigate}
          />
        </nav>
      </div>

      <div className="shrink-0 border-t border-[var(--color-border)]/40 px-6 py-5">
        <p className="mb-3 text-[10px] tracking-widest text-[var(--color-gold)] uppercase">
          Quick Links
        </p>
        <QuickLinks />
      </div>
    </div>
  )
}

export function AdminShell({ title, eyebrow = 'Admin', children }: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <main className="relative min-h-svh w-full min-w-0 max-w-full overflow-x-hidden text-[var(--color-white)]">
      {/* Mobile Sticky Top Bar (visible only below lg) */}
      <header className="sticky top-0 z-30 flex lg:hidden items-center justify-between border-b border-[var(--color-border)] bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex size-9 shrink-0 items-center justify-center rounded-sm text-[var(--color-text-secondary)] hover:bg-[#1a1a1a] hover:text-white"
                aria-label="Open admin navigation menu"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 bg-[#0a0a0a] border-r border-[var(--color-border)]">
              <SheetHeader className="sr-only">
                <SheetTitle>Admin Navigation</SheetTitle>
              </SheetHeader>
              <AdminSidebarNav isDrawer onNavigate={() => setDrawerOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link
            to="/admin/pipeline"
            className="shrink-0 flex items-center"
            aria-label="LocalPRO Realty Admin Home"
          >
            <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tighter text-[var(--color-gold)]">
              LP
            </span>
          </Link>

          <div className="min-w-0 border-l border-[var(--color-border)]/60 pl-3">
            {eyebrow ? (
              <p className="truncate text-[10px] tracking-widest text-[var(--color-gold)] uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="truncate font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-white)]">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell />
          <ProfileMenu role="admin" />
        </div>
      </header>

      <div className="grid min-h-svh lg:grid-cols-[220px_1fr] w-full min-w-0 max-w-full">
        <aside
          className={`sticky top-0 hidden lg:flex h-svh flex-col overflow-hidden border-r border-[var(--color-border)] ${shellPanelClass}`}
        >
          <AdminSidebarNav />
        </aside>

        <section className="flex min-h-svh flex-col w-full min-w-0 max-w-full">
          <header className="hidden lg:flex items-start justify-between border-b border-[var(--color-border)] px-6 py-8 md:px-10">
            <div>
              <p className="mb-2 text-xs tracking-widest text-[var(--color-gold)] uppercase">
                {eyebrow}
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-3xl">{title}</h2>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <ProfileMenu role="admin" />
            </div>
          </header>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 md:px-10 w-full min-w-0 max-w-full">{children}</div>
        </section>
      </div>
    </main>
  )
}
