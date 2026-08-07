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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff } from 'lucide-react'
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

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!currentPassword) {
      setError('Please enter your current password.')
      return
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    setIsUpdating(true)
    try {
      const { data: userData } = await getSupabaseClient().auth.getUser()
      const email = userData.user?.email
      if (!email) {
        throw new Error('User email not found. Please log in again.')
      }

      const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
        email,
        password: currentPassword,
      })

      if (signInError) {
        throw new Error('Current password is incorrect.')
      }

      const { error: updateError } = await getSupabaseClient().auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        throw updateError
      }

      setSuccess('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="border-t border-[var(--color-border)] pt-8">
      <div className="mb-6 space-y-1">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-white)]">
          Security
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Update your login password to keep your account secure.
        </p>
      </div>

      {error ? (
        <p className="mb-4 text-xs text-red-300">{error}</p>
      ) : null}
      {success ? (
        <p className="mb-4 text-xs text-emerald-300">{success}</p>
      ) : null}

      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="current-password-input" className="text-xs text-[#888888]">
              Current Password
            </Label>
            <div className="relative">
              <Input
                id="current-password-input"
                type={showCurrentPassword ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isUpdating}
                className="h-10 w-full rounded-sm border-[var(--color-border)] bg-[var(--color-surface)] pr-11 text-[var(--color-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)]"
              />
              <button
                type="button"
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showCurrentPassword}
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                disabled={isUpdating}
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-[#888888] transition-colors hover:text-[var(--color-white)] disabled:opacity-50"
              >
                {showCurrentPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password-input" className="text-xs text-[#888888]">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="new-password-input"
                type={showNewPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isUpdating}
                className="h-10 w-full rounded-sm border-[var(--color-border)] bg-[var(--color-surface)] pr-11 text-[var(--color-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)]"
              />
              <button
                type="button"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showNewPassword}
                onClick={() => setShowNewPassword((prev) => !prev)}
                disabled={isUpdating}
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-[#888888] transition-colors hover:text-[var(--color-white)] disabled:opacity-50"
              >
                {showNewPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password-input" className="text-xs text-[#888888]">
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="confirm-password-input"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isUpdating}
                className="h-10 w-full rounded-sm border-[var(--color-border)] bg-[var(--color-surface)] pr-11 text-[var(--color-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)]"
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showConfirmPassword}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                disabled={isUpdating}
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-[#888888] transition-colors hover:text-[var(--color-white)] disabled:opacity-50"
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isUpdating}
          className="mt-2 h-10 bg-[var(--color-gold)] font-semibold text-[var(--color-black)] hover:bg-[#c5a85c] disabled:opacity-50"
        >
          {isUpdating ? 'Updating password...' : 'Update Password'}
        </Button>
      </form>
    </div>
  )
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
          <div className="space-y-8">
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
            <ChangePasswordSection />
          </div>
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
