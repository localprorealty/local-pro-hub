import { useEffect, useState } from 'react'
import { LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchUserProfile, getDisplayInitials } from '@/lib/users'
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type ProfileMenuProps = {
  role: UserRole
  email?: string
}

export function ProfileMenu({ role, email }: ProfileMenuProps) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [initials, setInitials] = useState(() =>
    getDisplayInitials({ role, email }),
  )
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession()
      if (!isMounted) return

      const sessionEmail = session?.user?.email ?? email
      if (!session?.user?.id) {
        setInitials(getDisplayInitials({ role, email: sessionEmail }))
        return
      }

      const profile = await fetchUserProfile(session.user.id)
      if (!isMounted) return

      const resolvedRole = profile?.role ?? role
      setInitials(
        getDisplayInitials({
          fullName: profile?.full_name,
          email: profile?.email ?? sessionEmail,
          role: resolvedRole,
        }),
      )
      setDisplayName(profile?.full_name?.trim() || null)
    }

    void load()
    return () => {
      isMounted = false
    }
  }, [role, email])

  const handleProfile = () => {
    navigate('/profile')
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--color-gold-border)] bg-[var(--color-surface-2)] text-[var(--color-gold)] transition-colors hover:border-[var(--color-gold)]"
          aria-label="Open profile menu"
        >
          <Avatar size="default" className="border border-transparent">
            <AvatarFallback
              className={cn(
                'bg-[var(--color-surface-2)] font-semibold text-[var(--color-gold)]',
                initials.length > 1 ? 'text-[11px] tracking-tight' : 'text-sm',
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-sm border border-[var(--color-gold-border)] bg-[var(--color-surface-2)] p-1 text-[var(--color-white)]"
      >
        <DropdownMenuLabel className="font-normal">
          {displayName ? (
            <span className="block truncate text-sm text-[var(--color-white)]">
              {displayName}
            </span>
          ) : null}
          <span className="block text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
            Account
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[var(--color-border)]" />
        <DropdownMenuItem
          onSelect={handleProfile}
          className="cursor-pointer rounded-sm py-2 text-[var(--color-white)] focus:bg-[var(--color-gold-dim)]"
        >
          <User className="mr-2 size-4" aria-hidden />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void handleLogout()}
          className="cursor-pointer rounded-sm py-2 text-[var(--color-white)] focus:bg-[var(--color-gold-dim)]"
        >
          <LogOut className="mr-2 size-4" aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
