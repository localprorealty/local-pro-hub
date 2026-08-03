import {
  CheckSquare,
  Cloud,
  FileText,
  Home,
  Megaphone,
  Rocket,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export type SubmissionPortalStep = 'overview' | 'property' | 'marketing' | 'mls' | 'go-live'

type StepConfig = {
  id: SubmissionPortalStep
  label: string
  icon: typeof FileText
  path: (listingId: string) => string
}

const STEPS: StepConfig[] = [
  {
    id: 'overview',
    label: 'Submission Overview',
    icon: FileText,
    path: (id) => `/listing/${id}`,
  },
  {
    id: 'property',
    label: 'Property Details',
    icon: Home,
    path: (id) => `/listing/${id}/form`,
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    path: (id) => `/listing/${id}/marketing`,
  },
  {
    id: 'mls',
    label: 'MLS Submission',
    icon: Cloud,
    path: (id) => `/listing/${id}/mls`,
  },
  {
    id: 'go-live',
    label: 'Go Live',
    icon: Rocket,
    path: (id) => `/listing/${id}/go-live`,
  },
]

type SubmissionPortalSidebarProps = {
  listingId: string
  activeStep: SubmissionPortalStep
  mlsRef?: string | null
}

export function SubmissionPortalSidebar({
  listingId,
  activeStep,
  mlsRef,
}: SubmissionPortalSidebarProps) {
  return (
    <aside className="h-fit space-y-6">
      <div>
        <p className="text-[10px] tracking-[0.2em] text-[#CFB87C] uppercase">
          Submission Portal
        </p>
        {mlsRef ? (
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">MLS REF {mlsRef}</p>
        ) : null}
      </div>

      <nav className="space-y-1">
        {STEPS.map((step) => {
          const Icon = step.icon
          const active = step.id === activeStep
          return (
            <Link
              key={step.id}
              to={step.path(listingId)}
              className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-[#CFB87C]/15 font-medium text-[#CFB87C]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[#1a1a1a] hover:text-white'
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {step.label}
            </Link>
          )
        })}
      </nav>

      <div className="space-y-3 border-t border-[var(--color-border)] pt-6">
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full rounded-sm border-[#CFB87C]/50 bg-transparent text-xs tracking-widest text-[#CFB87C] uppercase hover:bg-[#CFB87C]/10"
        >
          Save draft
        </Button>
        <div className="flex gap-4 text-[10px] tracking-widest text-[var(--color-text-secondary)] uppercase">
          <button type="button" className="hover:text-[#CFB87C]">
            Settings
          </button>
          <button type="button" className="hover:text-[#CFB87C]">
            Support
          </button>
        </div>
      </div>
    </aside>
  )
}

export function PipelineDotNav({ activeIndex }: { activeIndex: 0 | 1 | 2 }) {
  return (
    <div
      className="hidden flex-col items-center gap-3 lg:flex"
      aria-label="Pipeline progress"
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`size-2 rounded-full ${
            index === activeIndex ? 'bg-[#CFB87C]' : 'bg-[var(--color-border)]'
          }`}
        />
      ))}
    </div>
  )
}

export function SyncedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-emerald-400 uppercase">
      <CheckSquare className="size-3" aria-hidden />
      Synced
    </span>
  )
}
