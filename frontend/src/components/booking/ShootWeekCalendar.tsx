import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { toIsoDate } from '@/lib/bookings'
import { cn } from '@/lib/utils'

type DayStatus = 'available' | 'blocked' | 'booked' | 'past'

type ShootWeekCalendarProps = {
  weekStart: Date
  blockedDates: Set<string>
  bookedDates: Set<string>
  selectedDate: string | null
  onWeekChange: (next: Date) => void
  onSelectDate: (isoDate: string) => void
  viewMode: 'week' | 'month'
  onViewModeChange: (mode: 'week' | 'month') => void
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0)
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function dayStatus(
  iso: string,
  blocked: Set<string>,
  booked: Set<string>,
): DayStatus {
  const today = toIsoDate(new Date())
  if (iso < today) return 'past'
  if (blocked.has(iso)) return 'blocked'
  if (booked.has(iso)) return 'booked'
  return 'available'
}

function statusClass(status: DayStatus, selected: boolean): string {
  if (selected) {
    return 'border-2 border-[var(--color-gold)] bg-[var(--color-gold)]/15 text-[var(--color-text)] font-bold ring-1 ring-[var(--color-gold)]/50'
  }
  if (status === 'blocked') {
    return 'bg-rose-100/70 text-rose-900 border border-rose-300/60 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40 opacity-60'
  }
  if (status === 'booked') {
    return 'bg-amber-100/70 text-amber-900 border border-amber-300/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40 opacity-80'
  }
  if (status === 'past') {
    return 'bg-[var(--color-surface-3)]/40 text-[var(--color-text-secondary)] opacity-40'
  }
  return 'bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)] hover:border-[var(--color-gold)]/60'
}

export function ShootWeekCalendar({
  weekStart,
  blockedDates,
  bookedDates,
  selectedDate,
  onWeekChange,
  onSelectDate,
  viewMode,
  onViewModeChange,
}: ShootWeekCalendarProps) {
  const cells = useMemo(() => {
    if (viewMode === 'week') {
      return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
    }

    const monthStart = startOfMonth(weekStart)
    const total = daysInMonth(weekStart)
    const leading = monthStart.getDay()
    const grid: Date[] = []
    for (let i = 0; i < leading; i += 1) {
      grid.push(addDays(monthStart, i - leading))
    }
    for (let day = 1; day <= total; day += 1) {
      grid.push(new Date(weekStart.getFullYear(), weekStart.getMonth(), day, 12, 0, 0, 0))
    }
    while (grid.length % 7 !== 0) {
      grid.push(addDays(grid[grid.length - 1], 1))
    }
    return grid
  }, [viewMode, weekStart])

  const headerLabel = weekStart.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const shift = () => {
    if (viewMode === 'week') {
      return addDays(weekStart, -7)
    }
    return new Date(weekStart.getFullYear(), weekStart.getMonth() - 1, 1, 12, 0, 0, 0)
  }

  const shiftForward = () => {
    if (viewMode === 'week') {
      return addDays(weekStart, 7)
    }
    return new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 1, 12, 0, 0, 0)
  }

  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onWeekChange(shift())}
            className="rounded-sm p-1 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10"
            aria-label="Previous"
          >
            <ChevronLeft className="size-5" />
          </button>
          <p className="font-[family-name:var(--font-display)] text-sm text-[var(--color-text)] font-medium">
            {headerLabel}
          </p>
          <button
            type="button"
            onClick={() => onWeekChange(shiftForward())}
            className="rounded-sm p-1 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10"
            aria-label="Next"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="flex rounded-sm border border-[var(--color-border)] text-[10px] uppercase tracking-widest overflow-hidden">
          <button
            type="button"
            onClick={() => onViewModeChange('week')}
            className={cn(
              'px-3 py-1.5 transition-colors',
              viewMode === 'week'
                ? 'bg-[var(--color-gold)] text-black font-semibold'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]',
            )}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('month')}
            className={cn(
              'px-3 py-1.5 transition-colors',
              viewMode === 'month'
                ? 'bg-[var(--color-gold)] text-black font-semibold'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]',
            )}
          >
            Month
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] tracking-widest text-[var(--color-text-secondary)] uppercase">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date) => {
          const iso = toIsoDate(date)
          const status = dayStatus(iso, blockedDates, bookedDates)
          const inMonth =
            viewMode === 'week' || date.getMonth() === weekStart.getMonth()
          const selected = selectedDate === iso
          const disabled = status === 'past' || status === 'blocked'

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate(iso)}
              className={cn(
                'flex h-12 flex-col items-center justify-center rounded-sm text-sm transition-opacity',
                statusClass(status, selected),
                !inMonth && viewMode === 'month' && 'opacity-40',
                disabled && 'cursor-not-allowed',
              )}
            >
              <span className="font-semibold">{date.getDate()}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-[var(--color-text-secondary)]">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-[var(--color-surface-2)] border border-[var(--color-border)]" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-rose-500/80" /> Blocked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-amber-500/80" /> Booked
        </span>
      </div>
    </div>
  )
}
