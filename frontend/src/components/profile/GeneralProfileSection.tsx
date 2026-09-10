import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PhotographerTier, UserRole, UserProfileStatus } from '@/lib/auth'
import { formatUsPhone, isValidMlsId } from '@/lib/format'
import type { UserProfileRow } from '@/lib/users'

const fieldClass =
  'h-10 rounded-sm border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)]'

const TIERS: PhotographerTier[] = ['basic', 'standard', 'elite']
const ROLES: UserRole[] = ['agent', 'marketing', 'photographer', 'admin']
const STATUSES: UserProfileStatus[] = ['pending', 'active', 'suspended']

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export type GeneralProfilePayload = {
  full_name: string
  phone: string
  mls_id: string
  brokermint_id?: string
  photographer_tier?: PhotographerTier | null
  email?: string
  role?: UserRole
  status?: UserProfileStatus
}

type GeneralProfileSectionProps = {
  initial: UserProfileRow
  mode: 'self' | 'admin'
  onSave: (payload: GeneralProfilePayload) => Promise<void>
}

export function GeneralProfileSection({
  initial,
  mode,
  onSave,
}: GeneralProfileSectionProps) {
  const [fullName, setFullName] = useState(initial.full_name ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [mlsId, setMlsId] = useState(initial.mls_id ?? '')
  const [brokermintId, setBrokermintId] = useState(initial.brokermint_id ?? '')
  const [tier, setTier] = useState<PhotographerTier>(initial.photographer_tier ?? 'standard')
  const [email, setEmail] = useState(initial.email ?? '')
  const [role, setRole] = useState<UserRole>(initial.role ?? 'agent')
  const [status, setStatus] = useState<UserProfileStatus>(initial.status)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const canEditEmail = mode === 'admin' || (mode === 'self' && initial.role === 'admin')
  const showTier =
    mode === 'admin'
      ? role === 'photographer'
      : initial.role === 'photographer'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!fullName.trim()) {
      setError('Enter your full name.')
      return
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid US phone number.')
      return
    }
    if (!isValidMlsId(mlsId)) {
      setError('MLS ID must be exactly 7 digits.')
      return
    }
    if (canEditEmail && !isValidEmail(email)) {
      setError('Enter a valid email address.')
      return
    }

    setIsSaving(true)
    try {
      const payload: GeneralProfilePayload = {
        full_name: fullName.trim(),
        phone,
        mls_id: mlsId,
        brokermint_id: brokermintId.trim(),
      }

      if (showTier) {
        payload.photographer_tier = tier
      }

      if (canEditEmail) {
        payload.email = email.trim()
      }

      if (mode === 'admin') {
        payload.role = role
        payload.status = status
      }

      await onSave(payload)
      setSuccess('Profile changes saved successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[#101010] p-6 space-y-6">
      <div className="border-b border-[var(--color-border)]/60 pb-4">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-white)]">
          General Profile Information
        </h3>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Your personal contact details, brokerage identifiers, and MLS agent credentials.
        </p>
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-300">{success}</p> : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
            Email Address
          </Label>
          {canEditEmail ? (
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1.5 ${fieldClass}`}
            />
          ) : (
            <>
              <Input
                value={initial.email}
                disabled
                className={`mt-1.5 ${fieldClass} opacity-70 cursor-not-allowed`}
              />
              <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                Email cannot be changed. Contact an admin if you need a different login email.
              </p>
            </>
          )}
          {canEditEmail ? (
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Updates your login email in Supabase Auth and your profile record.
            </p>
          ) : null}
        </div>

        {/* Role & Status */}
        {mode === 'self' ? (
          <div className="flex flex-wrap gap-4 pt-1">
            <div>
              <p className="text-[10px] tracking-wider text-[var(--color-text-secondary)] uppercase font-semibold">
                Account Role
              </p>
              <span className="mt-1 inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-semibold uppercase tracking-wider bg-[var(--color-gold)]/10 text-[var(--color-gold)] border border-[var(--color-gold)]/25">
                {initial.role ?? 'agent'}
              </span>
            </div>
            <div>
              <p className="text-[10px] tracking-wider text-[var(--color-text-secondary)] uppercase font-semibold">
                Account Status
              </p>
              <span className={`mt-1 inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-semibold uppercase tracking-wider ${
                initial.status === 'active'
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
              }`}>
                {initial.status}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 pt-1">
            <div>
              <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                Role
              </Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className={`mt-1.5 w-full ${fieldClass}`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                Status
              </Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserProfileStatus)}
                className={`mt-1.5 w-full ${fieldClass}`}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Full Name */}
        <div>
          <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
            Full Name *
          </Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            required
            className={`mt-1.5 ${fieldClass}`}
          />
        </div>

        {/* Phone */}
        <div>
          <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
            Phone Number *
          </Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(formatUsPhone(e.target.value))}
            placeholder="(214) 555-0199"
            required
            className={`mt-1.5 ${fieldClass}`}
          />
        </div>

        {/* MLS ID & BrokerMint ID */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
              MLS ID *
            </Label>
            <Input
              value={mlsId}
              onChange={(e) => setMlsId(e.target.value.replace(/\D/g, '').slice(0, 7))}
              placeholder="7-digit MLS ID"
              required
              className={`mt-1.5 ${fieldClass}`}
            />
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Must be exactly 7 digits.
            </p>
          </div>

          <div>
            <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
              BrokerMint ID
            </Label>
            <Input
              value={brokermintId}
              disabled={mode !== 'admin'}
              onChange={(e) => setBrokermintId(e.target.value)}
              placeholder="e.g. 177980"
              className={`mt-1.5 ${fieldClass} ${mode !== 'admin' ? 'opacity-70 cursor-not-allowed' : ''}`}
            />
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Auto-filled when your account is synced with BrokerMint. Contact admin if incorrect.
            </p>
          </div>
        </div>

        {/* Photographer Tier */}
        {showTier ? (
          <div>
            <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
              Photographer Tier
            </Label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as PhotographerTier)}
              className={`mt-1.5 w-full ${fieldClass}`}
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* Save Button */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={isSaving}
            className="h-10 rounded-sm bg-[var(--color-gold)] px-6 text-xs font-semibold text-[var(--color-black)] hover:bg-[#dcc487] disabled:opacity-60"
          >
            {isSaving ? 'Saving profile...' : 'Save Profile Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
