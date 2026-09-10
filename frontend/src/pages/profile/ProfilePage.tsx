import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { Building2, Eye, EyeOff, Shield, User } from 'lucide-react'

import { AdminShell } from '@/components/admin/AdminShell'
import { MissionShell } from '@/components/layout/MissionShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UserRole } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase'
import {
  adminPatchUser,
  fetchUserProfile,
  updateOwnProfile,
  type UserProfileRow,
} from '@/lib/users'

import { GeneralProfileSection, type GeneralProfilePayload } from '@/components/profile/GeneralProfileSection'
import { BrandIdentitySection, type BrandIdentityPayload } from '@/components/profile/BrandIdentitySection'
import { HeyGenReplicaSection, type HeyGenPayload } from '@/components/profile/HeyGenReplicaSection'
import {
  PhotographerVendorsSection,
  GmailDispatchSection,
} from '@/components/profile/ExternalVendorsSection'

export type ProfileTab = 'general' | 'vendors' | 'security'

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
    <div className="rounded-xl border border-[var(--color-border)] bg-[#101010] p-6 space-y-6">
      <div className="border-b border-[var(--color-border)]/60 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Shield className="size-4 text-[var(--color-gold)]" />
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
              Account Password
            </h4>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
              Update your login password to keep your account secure.
            </p>
          </div>
        </div>
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-300">{success}</p> : null}

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

        <div className="pt-2">
          <Button
            type="submit"
            disabled={isUpdating}
            className="h-10 rounded-sm bg-[var(--color-gold)] px-6 text-xs font-semibold text-[var(--color-black)] hover:bg-[#c5a85c] disabled:opacity-50"
          >
            {isUpdating ? 'Updating password...' : 'Update Password'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function ProfileContent({ role }: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfileRow | null>(null)
  const [email, setEmail] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: ProfileTab =
    tabParam === 'vendors' || tabParam === 'security'
      ? tabParam
      : 'general'

  const handleSelectTab = (tab: ProfileTab) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', tab)
    setSearchParams(nextParams, { replace: true })
  }

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

  // Scoped Save Handlers
  const handleSaveProfile = async (payload: GeneralProfilePayload) => {
    if (!profile) return
    const updated =
      profile.role === 'admin'
        ? await adminPatchUser(profile.id, payload)
        : await updateOwnProfile(profile.id, payload, profile.role)
    setProfile(updated)
    if (payload.email && profile.role === 'admin') {
      setEmail(payload.email)
    }
  }

  const handleSaveBranding = async (payload: BrandIdentityPayload) => {
    if (!profile) return
    const updated =
      profile.role === 'admin'
        ? await adminPatchUser(profile.id, payload)
        : await updateOwnProfile(profile.id, payload, profile.role)
    setProfile(updated)
  }

  const handleSaveHeyGen = async (payload: HeyGenPayload) => {
    if (!profile) return
    const updated =
      profile.role === 'admin'
        ? await adminPatchUser(profile.id, payload)
        : await updateOwnProfile(profile.id, payload, profile.role)
    setProfile(updated)
  }

  const TABS: { id: ProfileTab; label: string; icon: typeof User }[] = [
    { id: 'general', label: 'General Profile', icon: User },
    { id: 'vendors', label: 'Vendors & Branding', icon: Building2 },
    { id: 'security', label: 'Integrations & Security', icon: Shield },
  ]

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-3xl space-y-6"
    >
      {isLoading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Loading profile...</p>
      ) : error && !profile ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : profile ? (
        <>
          {/* Tab Navigation Bar */}
          <div className="flex border-b border-[var(--color-border)] gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold tracking-wider uppercase whitespace-nowrap transition-all border-b-2 -mb-px ${
                    isActive
                      ? 'border-[var(--color-gold)] text-[var(--color-gold)] bg-[var(--color-gold)]/5'
                      : 'border-transparent text-[var(--color-text-secondary)] hover:text-white hover:border-zinc-700'
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tab 1: General Profile */}
          {activeTab === 'general' && (
            <GeneralProfileSection
              initial={profile}
              mode={role === 'admin' ? 'admin' : 'self'}
              onSave={handleSaveProfile}
            />
          )}

          {/* Tab 2: Vendors & Branding */}
          {activeTab === 'vendors' && (
            <div className="space-y-6">
              {/* Section A: Preferred Photographer Vendors */}
              {(profile.role === 'agent' || profile.role === 'admin') && (
                <PhotographerVendorsSection />
              )}

              {/* Section B: Marketing Brand Identity */}
              {(profile.role === 'agent' || profile.role === 'admin') ? (
                <BrandIdentitySection
                  initialLogoUrl={profile.brand_logo_url}
                  initialPrimaryColor={profile.brand_color_primary}
                  initialSecondaryColor={profile.brand_color_secondary}
                  onSave={handleSaveBranding}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[#101010] p-6 text-center text-xs text-[var(--color-text-secondary)]">
                  Marketing brand customization is available for agents and administrators.
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Integrations & Security */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Card A: Gmail Order Dispatch */}
              {(profile.role === 'agent' || profile.role === 'admin') && (
                <GmailDispatchSection />
              )}

              {/* Card B: HeyGen Replica Settings */}
              {(profile.role === 'agent' || profile.role === 'admin') && (
                <HeyGenReplicaSection
                  initialAvatarId={profile.heygen_avatar_id}
                  initialVoiceId={profile.heygen_voice_id}
                  onSave={handleSaveHeyGen}
                />
              )}

              {/* Card C: Account Password */}
              <ChangePasswordSection />
            </div>
          )}
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
