import { AlertCircle, CheckCircle2, Circle } from 'lucide-react'

import type { NtreisSection, SectionStatus } from '@/lib/ntreis-sections'
import { cn } from '@/lib/utils'

type SectionNavProps = {
  sections: NtreisSection[]
  activeSectionId: number
  sectionStatuses: Record<number, SectionStatus>
  requiredRemaining: number
  onSelect: (sectionId: number) => void
}

function StatusIcon({ status }: { status: SectionStatus }) {
  if (status === 'complete') {
    return <CheckCircle2 className="size-4 text-emerald-500" />
  }
  if (status === 'partial') {
    return <AlertCircle className="size-4 text-orange-400" />
  }
  return <Circle className="size-4 text-[var(--color-text-muted)]" />
}

export function SectionNav({
  sections,
  activeSectionId,
  sectionStatuses,
  requiredRemaining,
  onSelect,
}: SectionNavProps) {
  return (
    <nav className="flex h-full flex-col">
      <p className="mb-4 text-[10px] tracking-widest text-[var(--color-gold)] uppercase">
        NTREIS Form
      </p>
      <ul className="flex-1 space-y-0.5 overflow-y-auto">
        {sections.map((section) => {
          const active = section.id === activeSectionId
          const status = sectionStatuses[section.id] ?? 'empty'
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onSelect(section.id)}
                className={cn(
                  'flex w-full items-center gap-2 border-l-[3px] px-3 py-2.5 text-left transition-colors',
                  active
                    ? 'border-l-[var(--color-gold)] bg-[var(--color-surface)] text-[var(--color-text)]'
                    : 'border-l-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]/60',
                )}
              >
                <span className="w-5 shrink-0 font-mono text-[10px] text-[var(--color-text-muted)]">
                  {section.id}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{section.name}</span>
                <StatusIcon status={status} />
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 border-t border-[var(--color-border)] pt-4 text-xs text-[var(--color-text-secondary)]">
        Required fields remaining:{' '}
        <span className="font-semibold text-[var(--color-gold)]">{requiredRemaining}</span>
      </p>
    </nav>
  )
}
