import type { PhotographerTier, UserRole, UserProfileStatus } from '@/lib/auth'
import { api } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase'

export type UserProfileRow = {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  mls_id: string | null
  brokermint_id: string | null
  role: UserRole | null
  status: UserProfileStatus
  photographer_tier: PhotographerTier | null
  created_at: string
  approved_at: string | null
  heygen_avatar_id?: string | null
  heygen_voice_id?: string | null
  heygen_talking_photo_id?: string | null
  heygen_avatar_type?: string | null
  can_view_revenue?: boolean | null
}

export const PROFILE_SELECT =
  'id, email, full_name, phone, mls_id, brokermint_id, role, status, photographer_tier, created_at, approved_at, heygen_avatar_id, heygen_voice_id, heygen_talking_photo_id, heygen_avatar_type, can_view_revenue'

export type OwnProfileUpdate = {
  full_name: string
  phone: string
  mls_id: string
  brokermint_id: string
  photographer_tier?: PhotographerTier | null
  heygen_avatar_id?: string | null
  heygen_voice_id?: string | null
}

export type AdminProfileUpdate = Partial<OwnProfileUpdate> & {
  email?: string
  role?: UserRole
  status?: UserProfileStatus
  photographer_tier?: PhotographerTier | null
  approved_at?: string | null
}

export type AdminCreateUserPayload = {
  email: string
  password: string
  full_name: string
  phone: string
  mls_id: string
  brokermint_id: string
  role: UserRole
  status: UserProfileStatus
  photographer_tier: PhotographerTier
}

export async function fetchUserProfile(userId: string): Promise<UserProfileRow | null> {
  const { data, error } = await getSupabaseClient()
    .from('users')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return (data as UserProfileRow | null) ?? null
}

export async function fetchUsersByRole(
  roleFilter: UserRole | 'all',
): Promise<UserProfileRow[]> {
  let query = getSupabaseClient()
    .from('users')
    .select(PROFILE_SELECT)
    .order('created_at', { ascending: false })

  if (roleFilter !== 'all') {
    query = query.eq('role', roleFilter)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as UserProfileRow[]
}

export async function updateOwnProfile(
  userId: string,
  payload: OwnProfileUpdate,
  role: UserRole | null,
): Promise<UserProfileRow> {
  const update: Record<string, unknown> = {
    full_name: payload.full_name.trim(),
    phone: payload.phone,
    mls_id: payload.mls_id,
    brokermint_id: payload.brokermint_id.trim(),
  }

  if (role === 'photographer' && payload.photographer_tier) {
    update.photographer_tier = payload.photographer_tier
  }

  if ('heygen_avatar_id' in payload) {
    update.heygen_avatar_id = payload.heygen_avatar_id?.trim() || null
  }
  if ('heygen_voice_id' in payload) {
    update.heygen_voice_id = payload.heygen_voice_id?.trim() || null
  }

  const { data, error } = await getSupabaseClient()
    .from('users')
    .update(update)
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .single()

  if (error) throw error
  return data as UserProfileRow
}

export async function adminUpdateUser(
  userId: string,
  payload: AdminProfileUpdate,
): Promise<UserProfileRow> {
  const { email, ...rest } = payload
  if (email !== undefined) {
    return adminPatchUser(userId, payload)
  }

  const { data, error } = await getSupabaseClient()
    .from('users')
    .update(rest)
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .single()

  if (error) throw error
  return data as UserProfileRow
}

/** Full admin edit (includes email) — syncs Auth + public.users via backend. */
export async function adminPatchUser(
  userId: string,
  payload: AdminProfileUpdate,
): Promise<UserProfileRow> {
  return api<UserProfileRow>(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function adminResetPassword(
  userId: string,
  payload: { password: string },
): Promise<{ success: boolean; message: string }> {
  return api<{ success: boolean; message: string }>(`/admin/users/${userId}/reset-password`, {
    method: 'POST',
    body: payload,
  })
}

export async function adminCreateUser(
  payload: AdminCreateUserPayload,
): Promise<{ id: string; email: string }> {
  return api<{ id: string; email: string }>('/admin/users', {
    method: 'POST',
    body: payload,
  })
}

export async function adminDeleteUser(userId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_delete_user', {
    target_user_id: userId,
  })
  if (error) throw error
}

/** Avatar initials: two letters from full name for agents; single letter for admins. */
export function getDisplayInitials(options: {
  fullName?: string | null
  email?: string | null
  role?: UserRole | null
}): string {
  const { fullName, email, role } = options
  const trimmed = fullName?.trim()
  const isAdmin = role === 'admin'

  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter((part) => part.length > 0)
    if (parts.length > 0) {
      if (isAdmin) {
        return parts[0]!.charAt(0).toUpperCase()
      }
      if (parts.length >= 2) {
        return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase()
      }
      const word = parts[0]!
      return word.length >= 2
        ? word.slice(0, 2).toUpperCase()
        : word.charAt(0).toUpperCase()
    }
  }

  const local = email?.split('@')[0]?.replace(/[^a-zA-Z]/g, '') ?? ''
  if (local.length > 0) {
    if (isAdmin) return local.charAt(0).toUpperCase()
    return local.length >= 2
      ? local.slice(0, 2).toUpperCase()
      : local.charAt(0).toUpperCase()
  }

  return (role?.charAt(0) ?? 'U').toUpperCase()
}

export function profileFieldLabels(): Record<string, string> {
  return {
    email: 'Email',
    full_name: 'Full name',
    phone: 'Phone',
    mls_id: 'MLS ID',
    brokermint_id: 'Broker Mint ID',
    photographer_tier: 'Photographer tier',
    role: 'Role',
    status: 'Status',
  }
}

export function diffProfileFields(
  before: UserProfileRow,
  after: Record<string, string | null | undefined>,
): { label: string; from: string; to: string }[] {
  const labels = profileFieldLabels()
  const changes: { label: string; from: string; to: string }[] = []

  for (const [key, label] of Object.entries(labels)) {
    const prev = String(before[key as keyof UserProfileRow] ?? '—')
    const next = String(after[key] ?? before[key as keyof UserProfileRow] ?? '—')
    if (prev !== next) {
      changes.push({ label, from: prev, to: next })
    }
  }

  return changes
}
