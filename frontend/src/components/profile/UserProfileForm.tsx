import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PhotographerTier, UserRole, UserProfileStatus } from '@/lib/auth'
import { formatUsPhone, isValidMlsId } from '@/lib/format'
import { uploadBrandLogo, deleteBrandLogo, type UserProfileRow } from '@/lib/users'

const fieldClass =
  'h-10 rounded-sm border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)]'

export type ProfileFormValues = {
  email: string
  full_name: string
  phone: string
  mls_id: string
  brokermint_id: string
  photographer_tier: PhotographerTier
  role: UserRole
  status: UserProfileStatus
  heygen_avatar_id: string
  heygen_voice_id: string
  brand_logo_url: string
  brand_color_primary: string
  brand_color_secondary: string
}

type UserProfileFormProps = {
  mode: 'self' | 'admin'
  initial: UserProfileRow
  onCancel?: () => void
  onRequestSave: (values: ProfileFormValues) => void
  isSaving?: boolean
}

const TIERS: PhotographerTier[] = ['basic', 'standard', 'elite']
const ROLES: UserRole[] = ['agent', 'marketing', 'photographer', 'admin']
const STATUSES: UserProfileStatus[] = ['pending', 'active', 'suspended']

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function toFormValues(row: UserProfileRow): ProfileFormValues {
  return {
    email: row.email ?? '',
    full_name: row.full_name ?? '',
    phone: row.phone ?? '',
    mls_id: row.mls_id ?? '',
    brokermint_id: row.brokermint_id ?? '',
    photographer_tier: row.photographer_tier ?? 'standard',
    role: row.role ?? 'agent',
    status: row.status,
    heygen_avatar_id: row.heygen_avatar_id ?? '',
    heygen_voice_id: row.heygen_voice_id ?? '',
    brand_logo_url: row.brand_logo_url ?? '',
    brand_color_primary: row.brand_color_primary ?? '',
    brand_color_secondary: row.brand_color_secondary ?? '',
  }
}

export function UserProfileForm({
  mode,
  initial,
  onCancel,
  onRequestSave,
  isSaving = false,
}: UserProfileFormProps) {
  const [values, setValues] = useState<ProfileFormValues>(() => toFormValues(initial))
  const [error, setError] = useState<string | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const canEditEmail = mode === 'admin' || (mode === 'self' && initial.role === 'admin')

  const showTier =
    mode === 'admin'
      ? values.role === 'photographer'
      : initial.role === 'photographer'

  const handleLogoSelected = async (file?: File) => {
    if (!file) return
    setIsUploadingLogo(true)
    setError(null)
    try {
      const url = await uploadBrandLogo(file)
      setValues((v) => ({ ...v, brand_logo_url: url }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo.')
    } finally {
      setIsUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const handleRemoveLogo = async () => {
    setIsUploadingLogo(true)
    setError(null)
    try {
      await deleteBrandLogo()
      setValues((v) => ({ ...v, brand_logo_url: '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove logo.')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!values.full_name.trim()) {
      setError('Enter your full name.')
      return
    }
    if (values.phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid US phone number.')
      return
    }
    if (!isValidMlsId(values.mls_id)) {
      setError('MLS ID must be exactly 7 digits.')
      return
    }
    // BrokerMint ID is auto-filled by sync, so it is optional to input manually
    if (canEditEmail && !isValidEmail(values.email)) {
      setError('Enter a valid email address.')
      return
    }

    onRequestSave(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
          Email
        </Label>
        {canEditEmail ? (
          <Input
            type="email"
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
            className={`mt-1 ${fieldClass}`}
          />
        ) : (
          <>
            <Input
              value={initial.email}
              disabled
              className={`mt-1 ${fieldClass} opacity-70`}
            />
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Email cannot be changed. Contact an admin if you need a different login
              email.
            </p>
          </>
        )}
        {canEditEmail ? (
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Updates your login email in Supabase Auth and your profile record.
          </p>
        ) : null}
      </div>

      {mode === 'self' ? (
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-[10px] tracking-wide text-[var(--color-text-secondary)] uppercase">
              Role
            </p>
            <p className="text-[var(--color-gold)]">{initial.role ?? 'agent'}</p>
          </div>
          <div>
            <p className="text-[10px] tracking-wide text-[var(--color-text-secondary)] uppercase">
              Status
            </p>
            <p className="text-[var(--color-white)]">{initial.status}</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
              Role
            </Label>
            <select
              value={values.role}
              onChange={(e) =>
                setValues((v) => ({ ...v, role: e.target.value as UserRole }))
              }
              className={`mt-1 w-full ${fieldClass}`}
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
              value={values.status}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  status: e.target.value as UserProfileStatus,
                }))
              }
              className={`mt-1 w-full ${fieldClass}`}
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

      <div>
        <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
          Full name
        </Label>
        <Input
          value={values.full_name}
          onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))}
          className={`mt-1 ${fieldClass}`}
        />
      </div>

      <div>
        <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
          Phone
        </Label>
        <Input
          value={values.phone}
          onChange={(e) =>
            setValues((v) => ({ ...v, phone: formatUsPhone(e.target.value) }))
          }
          className={`mt-1 ${fieldClass}`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
            MLS ID
          </Label>
          <Input
            value={values.mls_id}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                mls_id: e.target.value.replace(/\D/g, '').slice(0, 7),
              }))
            }
            className={`mt-1 ${fieldClass}`}
          />
        </div>
        <div>
          <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
            Broker Mint ID
          </Label>
          <Input
            value={values.brokermint_id}
            disabled={mode !== 'admin'}
            onChange={(e) =>
              setValues((v) => ({ ...v, brokermint_id: e.target.value }))
            }
            className={`mt-1 ${fieldClass} ${mode !== 'admin' ? 'opacity-70' : ''}`}
          />
          {mode !== 'admin' && (
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Auto-filled when your account is synced with BrokerMint. Contact admin if incorrect.
            </p>
          )}
        </div>
      </div>

      {initial.role === 'agent' ? (
        <div className="grid gap-4 sm:grid-cols-2 border-t border-[#2a2a2a] pt-4 mt-4">
          <div className="sm:col-span-2">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">HeyGen Video Replica Settings</h4>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Your HeyGen integration Look ID and Voice ID configurations.</p>
          </div>
          <div>
            <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
              HeyGen Avatar ID
            </Label>
            <Input
              value={values.heygen_avatar_id}
              onChange={(e) =>
                setValues((v) => ({ ...v, heygen_avatar_id: e.target.value }))
              }
              placeholder="e.g. 295881a3e9ba4c74a7..."
              className={`mt-1 ${fieldClass}`}
            />
          </div>
          <div>
            <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
              HeyGen Voice ID
            </Label>
            <Input
              value={values.heygen_voice_id}
              onChange={(e) =>
                setValues((v) => ({ ...v, heygen_voice_id: e.target.value }))
              }
              placeholder="e.g. 06b6f4c9c10444bb..."
              className={`mt-1 ${fieldClass}`}
            />
          </div>
        </div>
      ) : null}

      {/* Optional Branding & Marketing Identity Section (Agents & Admins) */}
      {(initial.role === 'agent' || initial.role === 'admin' || values.role === 'agent') ? (
        <div className="border-t border-[#2a2a2a] pt-5 mt-5 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Marketing Branding & Identity (Optional)
            </h4>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
              Customize marketing assets (Just Sold posts, Flyers, Listing Books) with your team logo and brand accent colors. LocalPRO&apos;s licensed brokerage logo remains anchored on all materials.
            </p>
          </div>

          {/* Logo Upload & Preview */}
          <div>
            <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
              Agent / Team Logo
            </Label>
            <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {values.brand_logo_url ? (
                <div className="relative flex h-20 w-44 items-center justify-center rounded-sm border border-[var(--color-border)] bg-[#141414] p-2">
                  <img
                    src={values.brand_logo_url}
                    alt="Brand logo"
                    className="max-h-16 max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-44 items-center justify-center rounded-sm border border-dashed border-[var(--color-border)] bg-[#141414] text-xs text-[var(--color-text-secondary)]">
                  No logo uploaded
                </div>
              )}

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                    className="h-8 border-[var(--color-border)] bg-transparent text-xs text-white hover:bg-[#2a2a2a]"
                  >
                    {isUploadingLogo ? 'Uploading...' : values.brand_logo_url ? 'Change Logo' : 'Upload Logo'}
                  </Button>

                  {values.brand_logo_url ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRemoveLogo()}
                      className="h-8 text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200"
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => void handleLogoSelected(e.target.files?.[0])}
                />
                <p className="text-[10px] text-[var(--color-text-secondary)]">
                  PNG with transparent background or SVG recommended · Max 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Color Pickers */}
          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <div>
              <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                Primary Brand Color
              </Label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="color"
                  value={values.brand_color_primary || '#CFB87C'}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, brand_color_primary: e.target.value }))
                  }
                  className="size-9 cursor-pointer rounded border border-[var(--color-border)] bg-transparent p-0.5"
                />
                <Input
                  value={values.brand_color_primary}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, brand_color_primary: e.target.value }))
                  }
                  placeholder="#CFB87C"
                  className={fieldClass}
                />
              </div>
              <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
                Used for footer accents, dividers, and headshot rings.
              </p>
            </div>

            <div>
              <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                Secondary Brand Color (Optional)
              </Label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="color"
                  value={values.brand_color_secondary || '#141414'}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, brand_color_secondary: e.target.value }))
                  }
                  className="size-9 cursor-pointer rounded border border-[var(--color-border)] bg-transparent p-0.5"
                />
                <Input
                  value={values.brand_color_secondary}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, brand_color_secondary: e.target.value }))
                  }
                  placeholder="Optional hex code"
                  className={fieldClass}
                />
              </div>
              <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
                Secondary accent for borders and cards.
              </p>
            </div>
          </div>

          {/* Reset to LocalPRO Gold */}
          {(values.brand_color_primary || values.brand_color_secondary) ? (
            <div className="pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setValues((v) => ({
                    ...v,
                    brand_color_primary: '',
                    brand_color_secondary: '',
                  }))
                }
                className="h-7 px-2 text-[11px] text-[var(--color-gold)] hover:bg-[var(--color-gold-dim)]"
              >
                Reset Colors to LocalPRO Gold (#CFB87C)
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showTier ? (
        <div>
          <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
            Photographer tier
          </Label>
          <select
            value={values.photographer_tier}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                photographer_tier: e.target.value as PhotographerTier,
              }))
            }
            className={`mt-1 w-full ${fieldClass}`}
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <Button
          type="submit"
          disabled={isSaving}
          className="h-10 rounded-sm bg-[var(--color-gold)] px-6 font-semibold text-[var(--color-black)] hover:bg-[#dcc487] disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-10 rounded-sm border-[var(--color-border)] bg-transparent text-[var(--color-white)]"
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}
