import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ListingIdBadge } from '@/components/listings/ListingIdBadge'
import { ProfileMenu } from '@/components/profile/ProfileMenu'
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
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-8 py-5 backdrop-blur">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          to={backTo}
          className="shrink-0 rounded-sm p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          aria-label={backLabel}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-[family-name:var(--font-display)] text-xl text-[var(--color-text)]">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {subtitle ? (
              <p className="truncate text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
            ) : null}
            {listingId ? (
              <>
                {subtitle ? <span className="text-[var(--color-text-tertiary)]">·</span> : null}
                <ListingIdBadge id={listingId} />
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 mr-12 sm:mr-14">
        <ProfileMenu role={role} email={email} />
      </div>
    </header>
  )
}
