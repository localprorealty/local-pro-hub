import { useEffect, useState, useMemo } from 'react'
import { PieChart, Pie, Cell } from 'recharts'
import { Award } from 'lucide-react'

import { getCapProgress, type CapProgress } from '@/lib/brokermint'

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default function CapProgressCard() {
  const [capProgress, setCapProgress] = useState<CapProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const fetchProgress = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const progress = await getCapProgress()
        if (active) {
          setCapProgress(progress)
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to fetch cap progress.')
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }
    void fetchProgress()
    return () => {
      active = false
    }
  }, [])

  const pieData = useMemo(() => {
    if (!capProgress) return []
    return [
      { name: 'Paid to Local Pro', value: capProgress.cap_paid },
      { name: 'Remaining', value: capProgress.cap_remaining || 0 },
    ]
  }, [capProgress])

  const COLORS = ['#CFB87C', '#2a2a2a'] // gold for paid, dark for remaining

  if (isLoading) {
    return (
      <div className="w-full border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 rounded-sm min-h-[220px] animate-pulse flex flex-col justify-between">
        <div className="h-4 bg-zinc-800 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="flex justify-center items-center h-28 bg-zinc-800/40 rounded-full w-28 mx-auto"></div>
          <div className="space-y-3">
            <div className="h-3 bg-zinc-800 rounded w-full"></div>
            <div className="h-3 bg-zinc-800 rounded w-5/6"></div>
            <div className="h-3 bg-zinc-800 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full border border-red-500/30 bg-red-500/10 p-5 rounded-sm text-red-200 text-xs">
        {error}
      </div>
    )
  }

  if (!capProgress || (!capProgress.has_cap && capProgress.cap_amount === null)) {
    return (
      <div className="w-full border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-5 rounded-sm text-center text-xs text-[var(--color-text-secondary)] italic">
        Missing cap limit or cap anniversary details on BrokerMint profile. Please contact Admin.
      </div>
    )
  }

  if (capProgress.cap_amount === 0) {
    return (
      <div className="w-full border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-5 rounded-sm text-center text-xs text-[var(--color-text-secondary)] italic">
        No active cap plan configured (e.g. Flat Fee / 100% Split / Custom Plan).
      </div>
    )
  }

  const cycleText =
    capProgress.cap_start_date && capProgress.next_anniversary
      ? `Cycle: ${formatDate(capProgress.cap_start_date)} – ${formatDate(
          capProgress.next_anniversary
        )}`
      : ''

  return (
    <div className="w-full border border-[var(--color-border)] bg-[var(--color-surface-2)] rounded-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-[var(--color-gold)] font-bold">
          Your Cap Progress
        </h3>
        {cycleText && (
          <span className="text-[10px] uppercase font-semibold text-[var(--color-text-secondary)] tracking-wider">
            {cycleText}
          </span>
        )}
      </div>

      {/* Body content */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left column: Donut chart or Capped out block */}
        <div className="flex justify-center items-center min-h-[160px]">
          {capProgress.capped_out ? (
            <div className="text-center p-4 border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 rounded-sm max-w-sm">
              <Award className="size-8 text-[var(--color-gold)] mx-auto mb-2.5" />
              <h4 className="text-sm font-semibold text-[var(--color-gold)] uppercase tracking-wider mb-1">
                🎉 You've Capped Out!
              </h4>
              <p className="text-xs text-gray-300 leading-relaxed font-light">
                Congratulations! You keep a larger share of every deal until{' '}
                <span className="font-semibold text-white">
                  {capProgress.next_anniversary ? new Date(capProgress.next_anniversary).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    timeZone: 'UTC'
                  }) : ''}
                </span>.
              </p>
            </div>
          ) : (
            <div className="relative size-[150px]">
              <PieChart width={150} height={150}>
                <Pie
                  data={pieData}
                  cx={70}
                  cy={70}
                  innerRadius={50}
                  outerRadius={68}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
                </Pie>
              </PieChart>

              {/* Overlay center text */}
              <div className="absolute top-[70px] left-[70px] -translate-x-1/2 -translate-y-1/2 text-center select-none pointer-events-none">
                <span className="block text-xl font-bold font-sans text-white leading-none">
                  {capProgress.percent_complete}%
                </span>
                <span className="block text-[9px] text-[var(--color-text-secondary)] uppercase tracking-wider mt-0.5">
                  complete
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Stats values */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div className="space-y-1 border-l-2 border-[var(--color-border)] pl-4">
            <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-secondary)] block">
              Cap Amount
            </span>
            <span className="text-base font-bold text-white block">
              {formatCurrency(capProgress.cap_amount)}
            </span>
          </div>

          <div className="space-y-1 border-l-2 border-[var(--color-border)] pl-4">
            <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-secondary)] block">
              Paid In (Total)
            </span>
            <span className="text-base font-bold text-[var(--color-gold)] block">
              {formatCurrency(capProgress.cap_paid)}
            </span>
            {capProgress.credit_paid > 0 && (
              <span className="text-[9px] text-[var(--color-text-secondary)] block font-light leading-none mt-1">
                {formatCurrency(capProgress.production_paid)} prod + {formatCurrency(capProgress.credit_paid)} credit
              </span>
            )}
          </div>

          <div className="space-y-1 border-l-2 border-[var(--color-border)] pl-4">
            <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-secondary)] block">
              Remaining
            </span>
            <span className="text-base font-bold text-white block">
              {formatCurrency(capProgress.cap_remaining)}
            </span>
          </div>

          <div className="space-y-1 border-l-2 border-[var(--color-border)] pl-4">
            <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-secondary)] block">
              Split
            </span>
            <span className="text-base font-bold text-white block">
              {capProgress.commission_split || '—'}
            </span>
          </div>

          <div className="space-y-1 border-l-2 border-[var(--color-border)] pl-4 col-span-2">
            <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-secondary)] block">
              Monthly Fee
            </span>
            <span className="text-base font-bold text-white block">
              {capProgress.monthly_fee || '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
