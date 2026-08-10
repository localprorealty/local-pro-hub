import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Check,
  CircleDollarSign,
  FileText,
  ImageIcon,
  Settings2,
  Users,
  Wrench,
  RefreshCw,
} from 'lucide-react'

import { shellPanelClass } from '@/components/layout/GridBackground'
import { QuickLinks } from '@/components/layout/QuickLinks'
import { ProfileMenu } from '@/components/profile/ProfileMenu'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchUserProfile } from '@/lib/users'
import { FEATURE_REVENUE_DASHBOARD } from '@/lib/featureFlags'

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

function DisabledNavItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span
      className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-3 text-left text-xs tracking-wide text-[var(--color-text-secondary)]/50 uppercase"
      aria-disabled
    >
      {icon}
      {label}
    </span>
  )
}

export function AdminShell({ title, eyebrow = 'Admin', children }: AdminShellProps) {
  const [canViewRevenue, setCanViewRevenue] = useState(false)

  useEffect(() => {
    let active = true
    const checkPermission = async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!active || !session?.user?.id) return
      try {
        const profile = await fetchUserProfile(session.user.id)
        if (active && profile) {
          setCanViewRevenue(!!profile.can_view_revenue)
        }
      } catch (err) {
        console.error("Error loading user profile:", err)
      }
    }
    void checkPermission()
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="relative min-h-svh text-[var(--color-white)]">
      <div className="grid min-h-svh lg:grid-cols-[220px_1fr]">
        <aside
          className={`sticky top-0 flex h-svh flex-col overflow-hidden border-r border-[var(--color-border)] ${shellPanelClass}`}
        >
          <div className="shrink-0 px-6 py-6">
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tighter text-[var(--color-gold)]">
              LP
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold">
              Mission Control
            </h1>
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
              />
              <ShellNavLink
                to="/admin/approvals"
                icon={<Check className="size-4" />}
                label="Approvals"
              />
              <ShellNavLink
                to="/admin/agents"
                icon={<Users className="size-4" />}
                label="Agents"
              />
              <ShellNavLink
                to="/admin/photographers"
                icon={<ImageIcon className="size-4" />}
                label="Photographers"
              />
              <ShellNavLink
                to="/admin/marketing"
                icon={<CircleDollarSign className="size-4" />}
                label="Marketing Team"
              />
              <DisabledNavItem icon={<FileText className="size-4" />} label="Templates" />
              <ShellNavLink
                to="/admin/automations"
                icon={<Wrench className="size-4" />}
                label="Automations"
              />
              <ShellNavLink
                to="/admin/brokermint"
                icon={<RefreshCw className="size-4" />}
                label="BrokerMint Sync"
              />
              {canViewRevenue && FEATURE_REVENUE_DASHBOARD && (
                <>
                  <ShellNavLink
                    to="/admin/revenue"
                    icon={<CircleDollarSign className="size-4" />}
                    label="Agent Commissions"
                  />
                  <ShellNavLink
                    to="/admin/revenue-share"
                    icon={<Users className="size-4" />}
                    label="Revenue Share"
                  />
                </>
              )}
              <DisabledNavItem icon={<Settings2 className="size-4" />} label="Resources" />
            </nav>
          </div>

          <div className="shrink-0 border-t border-[var(--color-border)]/40 px-6 py-5">
            <p className="mb-3 text-[10px] tracking-widest text-[var(--color-gold)] uppercase">
              Quick Links
            </p>
            <QuickLinks />
          </div>
        </aside>

        <section className="flex min-h-svh flex-col">
          <header className="flex items-start justify-between border-b border-[var(--color-border)] px-6 py-8 md:px-10">
            <div>
              <p className="mb-2 text-xs tracking-widest text-[var(--color-gold)] uppercase">
                {eyebrow}
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-3xl">{title}</h2>
            </div>
            <ProfileMenu role="admin" />
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10">{children}</div>
        </section>
      </div>
    </main>
  )
}
