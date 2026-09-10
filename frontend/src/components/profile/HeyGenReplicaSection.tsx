import { useState } from 'react'
import { Video } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const fieldClass =
  'h-10 rounded-sm border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)]'

export type HeyGenPayload = {
  heygen_avatar_id: string | null
  heygen_voice_id: string | null
}

type HeyGenReplicaSectionProps = {
  initialAvatarId?: string | null
  initialVoiceId?: string | null
  onSave: (payload: HeyGenPayload) => Promise<void>
}

export function HeyGenReplicaSection({
  initialAvatarId,
  initialVoiceId,
  onSave,
}: HeyGenReplicaSectionProps) {
  const [avatarId, setAvatarId] = useState(initialAvatarId ?? '')
  const [voiceId, setVoiceId] = useState(initialVoiceId ?? '')

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSaving(true)
    try {
      await onSave({
        heygen_avatar_id: avatarId.trim() || null,
        heygen_voice_id: voiceId.trim() || null,
      })
      setSuccess('HeyGen settings saved successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save HeyGen settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[#101010] p-6 space-y-6">
      <div className="border-b border-[var(--color-border)]/60 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Video className="size-4 text-[var(--color-gold)]" />
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
              HeyGen Video Replica Settings
            </h4>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
              Your HeyGen Look ID and Voice ID configurations for automated video generation.
            </p>
          </div>
        </div>
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-300">{success}</p> : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
              HeyGen Avatar ID
            </Label>
            <Input
              value={avatarId}
              onChange={(e) => setAvatarId(e.target.value)}
              placeholder="e.g. 295881a3e9ba4c74a7..."
              className={`mt-1.5 ${fieldClass}`}
            />
          </div>
          <div>
            <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
              HeyGen Voice ID
            </Label>
            <Input
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="e.g. 06b6f4c9c10444bb..."
              className={`mt-1.5 ${fieldClass}`}
            />
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={isSaving}
            className="h-10 rounded-sm bg-[var(--color-gold)] px-6 text-xs font-semibold text-[var(--color-black)] hover:bg-[#dcc487] disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save HeyGen Settings'}
          </Button>
        </div>
      </form>
    </div>
  )
}
