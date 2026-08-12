import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  Plus,
  User,
  Video,
  Briefcase,
} from 'lucide-react'

import { shellPanelClass } from '@/components/layout/GridBackground'
import { QuickLinks } from '@/components/layout/QuickLinks'
import { PIPELINE_STAGES, STAGE_LABEL } from '@/lib/listings'
import type { UserRole } from '@/lib/auth'
import {
  FEATURE_MARKET_YOURSELF,
} from '@/lib/featureFlags'

type AgentSidebarProps = {
  role: Exclude<UserRole, 'admin'>
}

function SidebarNavLink({
  to,
  icon,
  label,
  end = false,
}: {
  to: string
  icon: ReactNode
  label: string
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-xs tracking-wide uppercase transition-colors ${
          isActive
            ? 'border-l-4 border-[var(--color-gold)] bg-[var(--color-surface-3)] pl-2 text-[var(--color-gold)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-white)]'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

function DisabledNavItem({
  icon,
  label,
}: {
  icon: ReactNode
  label: string
}) {
  return (
    <div
      className="flex w-full cursor-not-allowed items-center justify-between rounded-sm px-3 py-2.5 text-left text-xs tracking-wide uppercase text-[var(--color-text-secondary)]/40"
      aria-disabled
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-[9px] tracking-widest text-[var(--color-gold)]/40 normal-case pr-1">
        Coming Soon
      </span>
    </div>
  )
}

export function AgentSidebar({ role }: AgentSidebarProps) {
  const roleLabel =
    role === 'marketing'
      ? 'Marketing'
      : role === 'photographer'
        ? 'Photographer'
        : 'Agent'

  const homePath = role === 'photographer' ? '/photographer/calendar' : '/dashboard'

  return (
    <aside
      className={`sticky top-0 flex h-svh flex-col overflow-hidden border-r border-[var(--color-border)] ${shellPanelClass}`}
    >
      <div className="shrink-0 px-6 py-6">
        <NavLink to={homePath} className="block transition-opacity hover:opacity-90">
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tighter text-[var(--color-gold)]">
            LP
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-white)]">
            Mission Control
          </h2>
        </NavLink>
        <p className="mt-1 text-[10px] tracking-widest text-[var(--color-text-secondary)] uppercase">
          LocalPRO Realty
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <nav className="space-y-1">
          {role === 'agent' ? (
            <>
              <SidebarNavLink
                to="/overview"
                icon={<LayoutDashboard className="size-4" />}
                label="Overview"
              />
              <SidebarNavLink
                to="/dashboard"
                end
                icon={<Briefcase className="size-4" />}
                label="Listing Pipelines"
              />
            </>
          ) : (
            <SidebarNavLink
              to={homePath}
              end
              icon={role === 'photographer' ? <CalendarDays className="size-4" /> : <LayoutDashboard className="size-4" />}
              label={role === 'photographer' ? 'My Bookings' : 'Overview'}
            />
          )}
          {role === 'agent' ? (
            <SidebarNavLink
              to="/listing/new"
              icon={<Plus className="size-4" />}
              label="New Listing"
            />
          ) : null}
          {role === 'agent' && (
            FEATURE_MARKET_YOURSELF ? (
              <SidebarNavLink
                to="/market-yourself"
                icon={<Video className="size-4" />}
                label="Market Yourself"
              />
            ) : (
              <DisabledNavItem
                icon={<Video className="size-4" />}
                label="Market Yourself"
              />
            )
          )}
          <SidebarNavLink
            to="/profile"
            icon={<User className="size-4" />}
            label="Profile"
          />
        </nav>

        <div className="mt-6 px-3 pb-4">
          <p className="mb-3 flex items-center gap-2 text-[10px] tracking-widest text-[var(--color-gold)] uppercase">
            <FileText className="size-3" />
            Pipeline
          </p>
          <ul className="space-y-1.5 border-l border-[var(--color-border)] pl-3">
            {PIPELINE_STAGES.map((stage) => (
              <li
                key={stage}
                className="flex items-center gap-2 text-[10px] text-[var(--color-text-secondary)]"
              >
                <span className="size-1 shrink-0 rounded-full bg-[var(--color-gold)]/40" />
                {STAGE_LABEL[stage]}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--color-border)]/40 px-6 py-5">
        <p className="mb-3 text-[10px] tracking-widest text-[var(--color-gold)] uppercase">
          Quick Links
        </p>
        <QuickLinks />
        <p className="mt-4 text-[10px] tracking-widest text-[var(--color-text-secondary)] uppercase">
          {roleLabel}
        </p>
      </div>
    </aside>
  )
}
