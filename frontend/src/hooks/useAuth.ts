import { useCallback, useState } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'

import type { SignUpPayload, UserProfile, UserProfileStatus } from '@/lib/auth'
import { fetchUserProfile, type UserProfileRow } from '@/lib/users'
import { getSupabaseClient } from '@/lib/supabase'

type AuthResult<T> = {
  data: T
  error: AuthError | null
}

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false)

  const getProfile = useCallback(
    async (userId: string): Promise<UserProfile | null> => {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('id, status, role, can_view_revenue')
        .eq('id', userId)
        .maybeSingle()

      if (error || !data) return null
      return {
        id: data.id as string,
        status: data.status as UserProfileStatus,
        role: (data.role as UserProfile['role']) ?? null,
        can_view_revenue: data.can_view_revenue as boolean | null,
      }
    },
    [],
  )

  const getFullProfile = useCallback(
    async (userId: string): Promise<UserProfileRow | null> => {
      try {
        return await fetchUserProfile(userId)
      } catch {
        return null
      }
    },
    [],
  )

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthResult<Session | null>> => {
      setIsLoading(true)
      try {
        const { data, error } = await getSupabaseClient().auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        return { data: data.session, error }
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const signUp = useCallback(
    async (payload: SignUpPayload): Promise<AuthResult<User | null>> => {
      setIsLoading(true)
      try {
        const { data, error } = await getSupabaseClient().auth.signUp({
          email: payload.email.trim(),
          password: payload.password,
          options: {
            data: {
              full_name: payload.fullName.trim(),
              phone: payload.phone,
              requested_role: payload.requestedRole,
              mls_id: payload.mlsId ?? '',
              license_number: payload.licenseNumber ?? '',
              photographer_tier: payload.photographerTier,
            },
          },
        })
        return { data: data.user, error }
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const signOut = useCallback(async (): Promise<{ error: AuthError | null }> => {
    const { error } = await getSupabaseClient().auth.signOut()
    return { error }
  }, [])

  return {
    isLoading,
    signInWithPassword,
    signUp,
    signOut,
    getProfile,
    getFullProfile,
  }
}
