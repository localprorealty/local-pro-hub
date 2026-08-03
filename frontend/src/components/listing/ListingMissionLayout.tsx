import type { ReactNode } from 'react'

import { MissionShell } from '@/components/layout/MissionShell'
import { ListingMissionHeader } from '@/components/listing/ListingMissionHeader'
import type { UserRole } from '@/lib/auth'

type ListingMissionLayoutProps = {
  listingId: string
  title: string
  subtitle?: string
  email?: string
  role?: Exclude<UserRole, 'admin'>
  children: ReactNode
  sidebar?: ReactNode
}

export function ListingMissionLayout({
  listingId,
  title,
  subtitle,
  email,
  role = 'agent',
  children,
  sidebar,
}: ListingMissionLayoutProps) {
  return (
    <MissionShell
      role={role}
      email={email}
      hideDefaultHeader
      headerSlot={
        <ListingMissionHeader
          backTo={`/listing/${listingId}`}
          title={title}
          subtitle={subtitle}
          role={role}
          email={email}
        />
      }
    >
      {sidebar ? (
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          {sidebar}
          <div>{children}</div>
        </div>
      ) : (
        children
      )}
    </MissionShell>
  )
}
