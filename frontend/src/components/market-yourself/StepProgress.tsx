import type { MarketYourselfStep } from '@/lib/marketing-video'
import { cn } from '@/lib/utils'

const STEPS: { id: MarketYourselfStep; label: string }[] = [
  { id: '1', label: 'Avatar' },
  { id: '2', label: 'Options' },
  { id: '3', label: 'Script' },
  { id: '4', label: 'Video' },
]

type StepProgressProps = {
  current: MarketYourselfStep
}

export function StepProgress({ current }: StepProgressProps) {
  const currentIndex = STEPS.findIndex((step) => step.id === current)

  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-4">
      {STEPS.map((step, index) => {
        const done = index < currentIndex
        const active = step.id === current
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-sm border text-sm font-semibold',
                done && 'border-[#CFB87C] bg-[#CFB87C] text-[#0a0a0a]',
                active && !done && 'border-[#CFB87C] bg-[#CFB87C]/15 text-[#CFB87C]',
                !done && !active && 'border-[#2a2a2a] bg-[#1a1a1a] text-[var(--color-text-secondary)]',
              )}
            >
              {step.id}
            </span>
            <span
              className={cn(
                'hidden text-sm sm:inline',
                active ? 'text-white' : 'text-[var(--color-text-secondary)]',
              )}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 ? (
              <span className="mx-1 hidden h-px w-6 bg-[#2a2a2a] sm:block" aria-hidden />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
