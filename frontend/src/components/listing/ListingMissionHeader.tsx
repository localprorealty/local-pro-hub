import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ProfileMenu } from '@/components/profile/ProfileMenu'
import type { UserRole } from '@/lib/auth'

type ListingMissionHeaderProps = {
  backTo: string
  backLabel?: string
  title: string
  subtitle?: string
  role?: Exclude<UserRole, 'admin'>
  email?: string
}

export function ListingMissionHeader({
  backTo,
  backLabel = 'Back to listing',
  title,
  subtitle,
  role = 'agent',
  email,
}: ListingMissionHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[#0a0a0a]/95 px-8 py-5 backdrop-blur">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          to={backTo}
          className="shrink-0 rounded-sm p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[#1a1a1a] hover:text-white"
          aria-label={backLabel}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-[family-name:var(--font-display)] text-xl text-white">
            {title}
          </h1>
          {subtitle ? (
            <p className="truncate text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <ProfileMenu role={role} email={email} />
    </header>
  )
}
