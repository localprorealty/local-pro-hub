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
  if (selected) return 'border-2 border-[#CFB87C] bg-[#1a1a1a] text-white'
  if (status === 'blocked') return 'bg-[#3a1515] text-[#cccccc]'
  if (status === 'booked') return 'bg-[#3a2f10] text-[#cccccc]'
  if (status === 'past') return 'bg-[#141414] text-[#555555]'
  return 'bg-white text-[#0a0a0a]'
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
    <div className="rounded-sm border border-[var(--color-border)] bg-[#1a1a1a] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onWeekChange(shift())}
            className="rounded-sm p-1 text-[#CFB87C] hover:bg-[#CFB87C]/10"
            aria-label="Previous"
          >
            <ChevronLeft className="size-5" />
          </button>
          <p className="font-[family-name:var(--font-display)] text-sm text-white">
            {headerLabel}
          </p>
          <button
            type="button"
            onClick={() => onWeekChange(shiftForward())}
            className="rounded-sm p-1 text-[#CFB87C] hover:bg-[#CFB87C]/10"
            aria-label="Next"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="flex rounded-sm border border-[var(--color-border)] text-[10px] uppercase tracking-widest">
          <button
            type="button"
            onClick={() => onViewModeChange('week')}
            className={cn(
              'px-3 py-1.5',
              viewMode === 'week'
                ? 'bg-[#CFB87C] text-[#0a0a0a]'
                : 'text-[var(--color-text-secondary)]',
            )}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('month')}
            className={cn(
              'px-3 py-1.5',
              viewMode === 'month'
                ? 'bg-[#CFB87C] text-[#0a0a0a]'
                : 'text-[var(--color-text-secondary)]',
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
          <span className="size-3 rounded-sm bg-white" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-[#3a1515]" /> Blocked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-[#3a2f10]" /> Booked
        </span>
      </div>
    </div>
  )
}
