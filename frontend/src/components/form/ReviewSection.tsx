import { AlertCircle, CheckCircle2, Circle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  countRequiredRemaining,
  getSectionStatus,
  isFieldFilled,
  isFieldVisible,
  isSectionVisible,
  type NtreisSection,
} from '@/lib/ntreis-sections'

type ReviewSectionProps = {
  sections: NtreisSection[]
  formData: Record<string, unknown>
  onContinue: () => void
  isSubmitting: boolean
  submitError: string | null
}

function StatusIcon({ status }: { status: 'complete' | 'partial' | 'empty' }) {
  if (status === 'complete') return <CheckCircle2 className="size-4 text-emerald-500" />
  if (status === 'partial') return <AlertCircle className="size-4 text-orange-400" />
  return <Circle className="size-4 text-[#555555]" />
}

export function ReviewSection({
  sections,
  formData,
  onContinue,
  isSubmitting,
  submitError,
}: ReviewSectionProps) {
  const visibleSections = sections.filter((s) => isSectionVisible(s, formData) && s.id !== 22)
  const requiredRemaining = countRequiredRemaining(visibleSections, formData)
  const allComplete = requiredRemaining === 0

  const incompleteSections = visibleSections.filter((section) => {
    const status = getSectionStatus(section, formData)
    return status !== 'complete' && section.fields.some((f) => f.required)
  })

  return (
    <div className="space-y-6">
      {allComplete ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          All required fields complete. Ready for next step.
        </div>
      ) : (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <p className="font-medium">{requiredRemaining} required fields still missing.</p>
          {incompleteSections.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-xs text-red-200/80">
              {incompleteSections.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[#2a2a2a]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#111111] text-[10px] tracking-wider text-[#888888] uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Section</th>
              <th className="px-4 py-3 font-medium">Required</th>
              <th className="px-4 py-3 font-medium">Filled</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleSections.map((section) => {
              const visibleFields = section.fields.filter((f) => isFieldVisible(f, formData))
              const requiredFields = visibleFields.filter((f) => f.required)
              const filledRequired = requiredFields.filter((f) =>
                isFieldFilled(formData[f.key]),
              )
              const status = getSectionStatus(section, formData)
              return (
                <tr key={section.id} className="border-t border-[#2a2a2a]">
                  <td className="px-4 py-3 text-white">{section.name}</td>
                  <td className="px-4 py-3 text-[#888888]">{requiredFields.length}</td>
                  <td className="px-4 py-3 text-[#888888]">{filledRequired.length}</td>
                  <td className="px-4 py-3">
                    <StatusIcon status={status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Button
        type="button"
        disabled={!allComplete || isSubmitting}
        onClick={onContinue}
        className="h-11 w-full rounded-lg bg-[#CFB87C] font-[family-name:var(--font-display)] text-sm font-bold tracking-wide text-black uppercase hover:bg-[#CFB87C]/90 disabled:opacity-40"
      >
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Saving...
          </span>
        ) : (
          'Save & Continue to Documents →'
        )}
      </Button>
      {submitError ? (
        <p className="text-sm text-red-400" role="alert">
          {submitError}
        </p>
      ) : null}
    </div>
  )
}
