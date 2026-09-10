import { useRef, useState } from 'react'
import { Palette } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { uploadBrandLogo, deleteBrandLogo } from '@/lib/users'

const fieldClass =
  'h-10 rounded-sm border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)]'

export type BrandIdentityPayload = {
  brand_logo_url: string | null
  brand_color_primary: string | null
  brand_color_secondary: string | null
}

type BrandIdentitySectionProps = {
  initialLogoUrl?: string | null
  initialPrimaryColor?: string | null
  initialSecondaryColor?: string | null
  onSave: (payload: BrandIdentityPayload) => Promise<void>
}

export function BrandIdentitySection({
  initialLogoUrl,
  initialPrimaryColor,
  initialSecondaryColor,
  onSave,
}: BrandIdentitySectionProps) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? '')
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor ?? '')
  const [secondaryColor, setSecondaryColor] = useState(initialSecondaryColor ?? '')

  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const handleLogoSelected = async (file?: File) => {
    if (!file) return
    setIsUploadingLogo(true)
    setError(null)
    setSuccess(null)
    try {
      const url = await uploadBrandLogo(file)
      setLogoUrl(url)
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
    setSuccess(null)
    try {
      await deleteBrandLogo()
      setLogoUrl('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove logo.')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSaving(true)
    try {
      await onSave({
        brand_logo_url: logoUrl.trim() || null,
        brand_color_primary: primaryColor.trim() || null,
        brand_color_secondary: secondaryColor.trim() || null,
      })
      setSuccess('Branding changes saved successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save branding changes.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[#101010] p-6 space-y-6">
      <div className="border-b border-[var(--color-border)]/60 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Palette className="size-4 text-[var(--color-gold)]" />
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-white)]">
              Marketing Brand Identity
            </h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              Customize marketing assets (Just Sold posts, Flyers, Listing Books) with your team logo and brand accent colors. LocalPRO&apos;s brokerage identity remains anchored on all materials.
            </p>
          </div>
        </div>
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-300">{success}</p> : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Logo Upload & Preview */}
        <div>
          <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
            Agent / Team Logo
          </Label>
          <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {logoUrl ? (
              <div className="relative flex h-20 w-44 items-center justify-center rounded-sm border border-[var(--color-border)] bg-[#141414] p-2">
                <img
                  src={logoUrl}
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
                  {isUploadingLogo ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Logo'}
                </Button>

                {logoUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleRemoveLogo()}
                    disabled={isUploadingLogo}
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
        <div className="grid gap-5 sm:grid-cols-2 pt-1 border-t border-[var(--color-border)]/40">
          <div>
            <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
              Primary Brand Color
            </Label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={primaryColor || '#CFB87C'}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="size-9 cursor-pointer rounded border border-[var(--color-border)] bg-transparent p-0.5"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#CFB87C"
                className={fieldClass}
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Used for footer accents, dividers, and headshot rings.
            </p>
          </div>

          <div>
            <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
              Secondary Brand Color (Optional)
            </Label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={secondaryColor || '#141414'}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="size-9 cursor-pointer rounded border border-[var(--color-border)] bg-transparent p-0.5"
              />
              <Input
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                placeholder="Optional hex code"
                className={fieldClass}
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Secondary accent for borders and cards.
            </p>
          </div>
        </div>

        {/* Reset to LocalPRO Gold */}
        {(primaryColor || secondaryColor) ? (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPrimaryColor('')
                setSecondaryColor('')
              }}
              className="h-7 px-2 text-[11px] text-[var(--color-gold)] hover:bg-[var(--color-gold-dim)]"
            >
              Reset Colors to LocalPRO Gold (#CFB87C)
            </Button>
          </div>
        ) : null}

        {/* Save Button */}
        <div className="pt-2 border-t border-[var(--color-border)]/40">
          <Button
            type="submit"
            disabled={isSaving || isUploadingLogo}
            className="h-10 rounded-sm bg-[var(--color-gold)] px-6 text-xs font-semibold text-[var(--color-black)] hover:bg-[#dcc487] disabled:opacity-60"
          >
            {isSaving ? 'Saving branding...' : 'Save Branding Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
