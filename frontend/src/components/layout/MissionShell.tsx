import type { ReactNode } from 'react'

import { AgentSidebar } from '@/components/layout/AgentSidebar'
import { ProfileMenu } from '@/components/profile/ProfileMenu'
import type { UserRole } from '@/lib/auth'

type MissionShellProps = {
  role: Exclude<UserRole, 'admin'>
  title?: string
  subtitle?: string
  email?: string
  headerSlot?: ReactNode
  hideDefaultHeader?: boolean
  children: ReactNode
}

export function MissionShell({
  role,
  title,
  subtitle,
  email,
  headerSlot,
  hideDefaultHeader = false,
  children,
}: MissionShellProps) {
  return (
    <main className="relative min-h-svh">
      <div className="grid min-h-svh lg:grid-cols-[220px_1fr]">
        <AgentSidebar role={role} />

        <section className="flex min-h-svh flex-col bg-[#0a0a0a]">
          {headerSlot ? (
            headerSlot
          ) : hideDefaultHeader ? null : (
            <header className="flex items-start justify-between border-b border-[var(--color-border)] px-8 py-8">
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
              <ProfileMenu role={role} email={email} />
            </header>
          )}
          <div className="flex-1 overflow-y-auto px-8 py-10">{children}</div>
        </section>
      </div>
    </main>
  )
}
