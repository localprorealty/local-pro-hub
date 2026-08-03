import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'

import { AdminShell } from '@/components/admin/AdminShell'
import { ConfirmSaveDialog } from '@/components/profile/ConfirmSaveDialog'
import {
  UserProfileForm,
  type ProfileFormValues,
} from '@/components/profile/UserProfileForm'
import { MissionShell } from '@/components/layout/MissionShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { UserRole } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase'
import {
  adminPatchUser,
  diffProfileFields,
  fetchUserProfile,
  updateOwnProfile,
  type UserProfileRow,
} from '@/lib/users'

type ProfilePageProps = {
  role: UserRole
}

function ProfileContent({ role }: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfileRow | null>(null)
  const [email, setEmail] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingValues, setPendingValues] = useState<ProfileFormValues | null>(null)

  const loadProfile = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await getSupabaseClient().auth.getUser()
      const userId = data.user?.id
      const userEmail = data.user?.email ?? undefined
      setEmail(userEmail)

      if (!userId) {
        setError('Not signed in.')
        return
      }

      const row = await fetchUserProfile(userId)
      if (!row) {
        setError('Profile not found.')
        return
      }
      setProfile(row)
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : 'Failed to load profile.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProfile()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadProfile])

  const pendingChanges = useMemo(() => {
    if (!profile || !pendingValues) return []
    const after: Record<string, string | null | undefined> = {
      full_name: pendingValues.full_name,
      phone: pendingValues.phone,
      mls_id: pendingValues.mls_id,
      brokermint_id: pendingValues.brokermint_id,
      photographer_tier:
        profile.role === 'photographer' ? pendingValues.photographer_tier : undefined,
      heygen_avatar_id: pendingValues.heygen_avatar_id,
      heygen_voice_id: pendingValues.heygen_voice_id,
    }
    if (profile.role === 'admin') {
      after.email = pendingValues.email
    }
    return diffProfileFields(profile, after)
  }, [profile, pendingValues])

  const handleRequestSave = (values: ProfileFormValues) => {
    setPendingValues(values)
    setConfirmOpen(true)
  }

  const handleConfirmSave = async () => {
    if (!profile || !pendingValues) return
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const profilePayload = {
        full_name: pendingValues.full_name,
        phone: pendingValues.phone,
        mls_id: pendingValues.mls_id,
        brokermint_id: pendingValues.brokermint_id,
        photographer_tier:
          profile.role === 'photographer' ? pendingValues.photographer_tier : null,
        heygen_avatar_id: pendingValues.heygen_avatar_id,
        heygen_voice_id: pendingValues.heygen_voice_id,
      }

      const updated =
        profile.role === 'admin'
          ? await adminPatchUser(profile.id, {
              email: pendingValues.email.trim(),
              ...profilePayload,
            })
          : await updateOwnProfile(profile.id, profilePayload, profile.role)

      setProfile(updated)
      if (profile.role === 'admin' && pendingValues.email.trim() !== profile.email) {
        setEmail(pendingValues.email.trim())
      }
      setSuccess('Profile updated successfully.')
      setConfirmOpen(false)
      setPendingValues(null)
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-xl"
    >
      {isLoading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Loading profile...</p>
      ) : error && !profile ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : profile ? (
        <>
          {error ? (
            <p className="mb-4 text-sm text-red-300">{error}</p>
          ) : null}
          {success ? (
            <p className="mb-4 text-sm text-emerald-300">{success}</p>
          ) : null}
          <UserProfileForm
            key={`${profile.id}-${profile.email}-${profile.mls_id}-${profile.full_name}-${profile.phone}`}
            mode="self"
            initial={profile}
            onRequestSave={handleRequestSave}
            isSaving={isSaving}
          />
          <ConfirmSaveDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            changes={pendingChanges}
            onConfirm={() => void handleConfirmSave()}
            isLoading={isSaving}
          />
        </>
      ) : null}
    </motion.div>
  )

  if (role === 'admin') {
    return <AdminShell title="Profile">{body}</AdminShell>
  }

  const shellRole = role as Exclude<UserRole, 'admin'>
  return (
    <MissionShell
      role={shellRole}
      title="Profile"
      subtitle="Update your account details"
      email={email}
    >
      {body}
    </MissionShell>
  )
}

export default function ProfilePage(props: ProfilePageProps) {
  return (
    <ErrorBoundary title="Profile">
      <ProfileContent {...props} />
    </ErrorBoundary>
  )
}
