import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Loader2,
  User,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  formatShootDate,
  formatShootTime,
  SHOOT_TIME_SLOTS,
  tierBadgeClass,
  toIsoDate,
  type Photographer,
  type PhotographerTier,
} from '@/lib/bookings'
import { cn } from '@/lib/utils'

type DayStatus = 'available' | 'blocked' | 'booked' | 'past'

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
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

export interface MobileShootWizardProps {
  photographers: Photographer[]
  selectedPhotographer: Photographer | null
  onSelectPhotographer: (p: Photographer | null) => void
  preferredTier: PhotographerTier
  isSkipping: boolean
  onSkip: () => Promise<void>
  weekStart: Date
  onWeekChange: (next: Date) => void
  blockedDates: Set<string>
  bookedDates: Set<string>
  bookedTimesForDay: Set<string>
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
  selectedTime: string | null
  onSelectTime: (time: string | null) => void
  isLoadingAvailability: boolean
  accessNotes: string
  onChangeAccessNotes: (notes: string) => void
  isBooking: boolean
  onConfirm: () => Promise<void>
  listingAddress: string
}

export function MobileShootWizard({
  photographers,
  selectedPhotographer,
  onSelectPhotographer,
  preferredTier,
  isSkipping,
  onSkip,
  weekStart,
  onWeekChange,
  blockedDates,
  bookedDates,
  bookedTimesForDay,
  selectedDate,
  onSelectDate,
  selectedTime,
  onSelectTime,
  isLoadingAvailability,
  accessNotes,
  onChangeAccessNotes,
  isBooking,
  onConfirm,
  listingAddress,
}: MobileShootWizardProps) {
  // Wizard active step: 1 (Photographer), 2 (Date & Time), 3 (Notes & Confirm)
  const [step, setStep] = useState<1 | 2 | 3>(() => {
    if (selectedPhotographer && selectedDate && selectedTime) return 3
    if (selectedPhotographer) return 2
    return 1
  })

  // Horizontal date strip ref for auto-centering selected date
  const dateStripRef = useRef<HTMLDivElement>(null)

  // 7 days for the active weekStart
  const daysInWeek = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [weekStart])

  const monthLabel = weekStart.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  // Auto-scroll selected date into center of strip
  useEffect(() => {
    if (!selectedDate || step !== 2) return
    const container = dateStripRef.current
    if (!container) return
    const selectedEl = container.querySelector<HTMLElement>(`[data-date="${selectedDate}"]`)
    if (selectedEl) {
      selectedEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [selectedDate, step])

  return (
    <div className="space-y-5">
      {/* 3-Step Interactive Stepper Bar */}
      <nav aria-label="Booking Progress" className="rounded-sm border border-[var(--color-border)] bg-[#161616] p-1.5 sm:p-2">
        <div className="flex items-center justify-between gap-1">
          {/* Step 1: Photographer */}
          <button
            type="button"
            onClick={() => setStep(1)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-sm transition-all',
              step === 1
                ? 'bg-[#CFB87C]/15 text-[#CFB87C]'
                : step > 1
                  ? 'text-white hover:text-[#CFB87C]'
                  : 'text-[var(--color-text-secondary)]',
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                step === 1
                  ? 'bg-[#CFB87C] text-black'
                  : step > 1
                    ? 'bg-[#CFB87C]/30 text-[#CFB87C]'
                    : 'bg-white/10 text-white',
              )}
            >
              {step > 1 ? <Check className="size-3 stroke-[3]" /> : '1'}
            </span>
            <span className="truncate">Photographer</span>
          </button>

          <ChevronRight className="size-3 text-zinc-600 shrink-0" />

          {/* Step 2: Date & Time */}
          <button
            type="button"
            disabled={!selectedPhotographer}
            onClick={() => selectedPhotographer && setStep(2)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-sm transition-all',
              step === 2
                ? 'bg-[#CFB87C]/15 text-[#CFB87C]'
                : step > 2
                  ? 'text-white hover:text-[#CFB87C]'
                  : selectedPhotographer
                    ? 'text-[var(--color-text-secondary)] hover:text-white'
                    : 'text-zinc-600 cursor-not-allowed opacity-60',
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                step === 2
                  ? 'bg-[#CFB87C] text-black'
                  : step > 2
                    ? 'bg-[#CFB87C]/30 text-[#CFB87C]'
                    : 'bg-white/10 text-white',
              )}
            >
              {step > 2 ? <Check className="size-3 stroke-[3]" /> : '2'}
            </span>
            <span className="truncate">Date & Time</span>
          </button>

          <ChevronRight className="size-3 text-zinc-600 shrink-0" />

          {/* Step 3: Confirm */}
          <button
            type="button"
            disabled={!selectedPhotographer || !selectedDate || !selectedTime}
            onClick={() =>
              selectedPhotographer && selectedDate && selectedTime && setStep(3)
            }
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-sm transition-all',
              step === 3
                ? 'bg-[#CFB87C]/15 text-[#CFB87C]'
                : selectedPhotographer && selectedDate && selectedTime
                  ? 'text-[var(--color-text-secondary)] hover:text-white'
                  : 'text-zinc-600 cursor-not-allowed opacity-60',
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                step === 3 ? 'bg-[#CFB87C] text-black' : 'bg-white/10 text-white',
              )}
            >
              3
            </span>
            <span className="truncate">Confirm</span>
          </button>
        </div>
      </nav>

      {/* ========================================================= */}
      {/* STEP 1: Photographer Selection                            */}
      {/* ========================================================= */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-widest text-[#CFB87C] uppercase">
              Step 1 — Choose Photographer
            </p>
            {photographers.some((p) => p.photographer_tier === preferredTier) && (
              <span className="text-[11px] text-[var(--color-text-secondary)]">
                Preferred: <strong className="text-white capitalize">{preferredTier}</strong>
              </span>
            )}
          </div>

          <div className="space-y-3">
            {photographers.length === 0 ? (
              <p className="rounded-sm border border-[var(--color-border)] bg-[#1a1a1a] p-5 text-sm text-[var(--color-text-secondary)] text-center">
                No active photographers available.
              </p>
            ) : (
              photographers.map((photographer) => {
                const selected = selectedPhotographer?.id === photographer.id
                return (
                  <button
                    key={photographer.id}
                    type="button"
                    onClick={() => {
                      onSelectPhotographer(photographer)
                      onSelectDate(null)
                      onSelectTime(null)
                    }}
                    className={cn(
                      'w-full rounded-sm border p-4 text-left transition-all min-h-[64px]',
                      selected
                        ? 'border-[#CFB87C] bg-[#CFB87C]/10 ring-1 ring-[#CFB87C]'
                        : 'border-[var(--color-border)] bg-[#1a1a1a] hover:border-[#CFB87C]/50 active:bg-white/5',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white text-base">
                          {photographer.full_name}
                        </p>
                        {photographer.phone ? (
                          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                            {photographer.phone}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          'rounded-sm px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase shrink-0',
                          tierBadgeClass(photographer.photographer_tier),
                        )}
                      >
                        {photographer.photographer_tier}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)]/50 pt-2.5">
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        Standard Real Estate Package
                      </span>
                      <span className="text-xs font-bold tracking-widest text-[#CFB87C] uppercase flex items-center gap-1">
                        {selected ? (
                          <>
                            <Check className="size-3.5" /> Selected
                          </>
                        ) : (
                          'Select'
                        )}
                      </span>
                    </div>
                  </button>
                )
              })
            )}

            {/* Primary Action Button to Advance */}
            {selectedPhotographer && (
              <Button
                type="button"
                onClick={() => setStep(2)}
                className="w-full h-12 bg-[#CFB87C] font-semibold text-black hover:bg-[#dcc487] flex items-center justify-center gap-2 text-sm shadow-md"
              >
                <span>Continue to Date & Time with {selectedPhotographer.full_name}</span>
                <ChevronRight className="size-4" />
              </Button>
            )}

            {/* Prominent Skip Photography Option */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isSkipping}
                onClick={() => void onSkip()}
                className="w-full rounded-sm border border-dashed border-red-500/30 hover:border-red-500/50 bg-red-950/10 hover:bg-red-950/20 p-4 text-left transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-white">Skip Photography</p>
                  <span className="rounded-sm bg-red-900/30 px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase text-red-200">
                    Bypass Stage
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Advance this listing to Shoot Booked without booking an in-house photographer.
                </p>
                <p className="mt-3 text-xs font-bold tracking-widest text-red-300 uppercase">
                  {isSkipping ? 'Advancing Stage...' : 'Skip Photography Stage →'}
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 2: Date & Time Selection                             */}
      {/* ========================================================= */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Selected Photographer Recap Banner */}
          <div className="flex items-center justify-between rounded-sm border border-[var(--color-border)] bg-[#1a1a1a] px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <User className="size-4 text-[#CFB87C] shrink-0" />
              <div className="truncate">
                <span className="text-xs text-[var(--color-text-secondary)]">Photographer: </span>
                <span className="text-xs font-semibold text-white">
                  {selectedPhotographer?.full_name}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-semibold text-[#CFB87C] hover:underline flex items-center gap-1 shrink-0 ml-2"
            >
              <Edit2 className="size-3" /> Change
            </button>
          </div>

          {/* Date Picker Agenda Section */}
          <div className="rounded-sm border border-[var(--color-border)] bg-[#1a1a1a] p-4 space-y-3.5">
            {/* Week navigation header */}
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-widest text-[#CFB87C] uppercase flex items-center gap-1.5">
                <CalendarIcon className="size-3.5" />
                <span>Select Date</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onWeekChange(addDays(weekStart, -7))}
                  className="rounded-sm p-1.5 text-[#CFB87C] hover:bg-[#CFB87C]/10 active:bg-[#CFB87C]/20 transition-colors"
                  aria-label="Previous Week"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="font-[family-name:var(--font-display)] text-xs font-semibold text-white px-1">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={() => onWeekChange(addDays(weekStart, 7))}
                  className="rounded-sm p-1.5 text-[#CFB87C] hover:bg-[#CFB87C]/10 active:bg-[#CFB87C]/20 transition-colors"
                  aria-label="Next Week"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>

            {/* Horizontal Swipeable Date Strip */}
            {isLoadingAvailability ? (
              <div className="flex h-16 items-center justify-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <Loader2 className="size-4 animate-spin text-[#CFB87C]" />
                <span>Loading availability...</span>
              </div>
            ) : (
              <div
                ref={dateStripRef}
                className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none snap-x snap-mandatory"
              >
                {daysInWeek.map((day) => {
                  const iso = toIsoDate(day)
                  const status = dayStatus(iso, blockedDates, bookedDates)
                  const isSelected = selectedDate === iso
                  const disabled = status === 'past' || status === 'blocked'
                  const dayName = day.toLocaleDateString(undefined, { weekday: 'short' })
                  const dayNum = day.getDate()

                  return (
                    <button
                      key={iso}
                      data-date={iso}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onSelectDate(iso)
                        onSelectTime(null)
                      }}
                      className={cn(
                        'flex h-16 min-w-[58px] shrink-0 snap-center flex-col items-center justify-center rounded-sm border p-2 transition-all select-none',
                        isSelected
                          ? 'border-[#CFB87C] bg-[#CFB87C]/20 text-white ring-2 ring-[#CFB87C]/50 shadow-sm'
                          : disabled
                            ? 'cursor-not-allowed border-[var(--color-border)]/50 bg-[#121212] text-[#555555]'
                            : 'border-[var(--color-border)] bg-[#141414] text-white hover:border-[#CFB87C]/50 active:bg-white/5',
                      )}
                    >
                      <span className="text-[10px] uppercase font-medium text-[var(--color-text-secondary)]">
                        {dayName}
                      </span>
                      <span className="text-base font-bold text-white leading-tight">
                        {dayNum}
                      </span>
                      <span className="mt-1 flex items-center justify-center">
                        {status === 'available' && (
                          <span className="size-1.5 rounded-full bg-[#CFB87C]" title="Available" />
                        )}
                        {status === 'blocked' && (
                          <span className="size-1.5 rounded-full bg-red-500" title="Blocked" />
                        )}
                        {status === 'booked' && (
                          <span className="size-1.5 rounded-full bg-amber-500" title="Booked" />
                        )}
                        {status === 'past' && (
                          <span className="size-1.5 rounded-full bg-zinc-700" title="Past" />
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Date Legend */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-[var(--color-text-secondary)] border-t border-[var(--color-border)]/40">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#CFB87C]" /> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" /> Booked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-red-500" /> Blocked
              </span>
            </div>
          </div>

          {/* Time Slots Section */}
          {selectedDate ? (
            <div className="rounded-sm border border-[var(--color-border)] bg-[#1a1a1a] p-4 space-y-3">
              <p className="text-[11px] font-semibold tracking-widest text-[#CFB87C] uppercase flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span>Available Times for {formatShootDate(selectedDate)}</span>
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                {SHOOT_TIME_SLOTS.map((slot) => {
                  const taken = bookedTimesForDay.has(slot)
                  const active = selectedTime === slot
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={taken}
                      onClick={() => onSelectTime(slot)}
                      className={cn(
                        'flex h-12 items-center justify-center rounded-sm border px-3 text-sm font-medium transition-all',
                        taken
                          ? 'cursor-not-allowed border-[var(--color-border)]/50 bg-[#121212] text-[#555555] line-through'
                          : active
                            ? 'border-[#CFB87C] bg-[#CFB87C] text-black font-semibold ring-2 ring-[#CFB87C]/40 shadow-sm'
                            : 'border-[var(--color-border)] bg-[#141414] text-white hover:border-[#CFB87C]/50 active:bg-white/5',
                      )}
                    >
                      {formatShootTime(slot)}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-sm border border-dashed border-[var(--color-border)] bg-[#141414] p-4 text-center text-xs text-[var(--color-text-secondary)]">
              Select a date above to view available time slots.
            </div>
          )}

          {/* Navigation Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              className="h-11 border-[var(--color-border)] bg-[#141414] text-white hover:bg-white/5 px-4"
            >
              <ChevronLeft className="size-4 mr-1" />
              Back
            </Button>
            <Button
              type="button"
              disabled={!selectedDate || !selectedTime}
              onClick={() => setStep(3)}
              className="h-11 flex-1 bg-[#CFB87C] font-semibold text-black hover:bg-[#dcc487] flex items-center justify-center gap-2 text-sm shadow-md"
            >
              <span>Review Booking</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Secondary Skip Option */}
          <div className="pt-1 text-center">
            <button
              type="button"
              disabled={isSkipping}
              onClick={() => void onSkip()}
              className="text-xs text-[var(--color-text-secondary)] hover:text-red-300 underline underline-offset-4 transition-colors"
            >
              Need to bypass scheduling? Skip photography instead →
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 3: Notes & Confirm                                   */}
      {/* ========================================================= */}
      {step === 3 && (
        <div className="space-y-5">
          <p className="text-[11px] font-semibold tracking-widest text-[#CFB87C] uppercase">
            Step 3 — Review & Confirm Shoot
          </p>

          {/* Comprehensive Booking Summary Card */}
          <div className="rounded-sm border border-[var(--color-border)] bg-[#1a1a1a] p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-white">
                Shoot Details
              </h3>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs font-semibold text-[#CFB87C] hover:underline flex items-center gap-1"
              >
                <Edit2 className="size-3" /> Edit Details
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[var(--color-text-secondary)] text-xs">Photographer</span>
                <div className="text-right">
                  <p className="font-semibold text-white">{selectedPhotographer?.full_name}</p>
                  <span
                    className={cn(
                      'inline-block rounded-sm px-1.5 py-0.2 text-[9px] font-bold tracking-widest uppercase mt-0.5',
                      selectedPhotographer ? tierBadgeClass(selectedPhotographer.photographer_tier) : '',
                    )}
                  >
                    {selectedPhotographer?.photographer_tier}
                  </span>
                </div>
              </div>

              <div className="flex items-start justify-between gap-2 border-t border-[var(--color-border)]/40 pt-2.5">
                <span className="text-[var(--color-text-secondary)] text-xs">Date & Time</span>
                <div className="text-right">
                  <p className="font-semibold text-white">
                    {selectedDate ? formatShootDate(selectedDate) : 'Not selected'}
                  </p>
                  <p className="text-xs text-[#CFB87C] font-medium">
                    {selectedTime ? formatShootTime(selectedTime) : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-start justify-between gap-2 border-t border-[var(--color-border)]/40 pt-2.5">
                <span className="text-[var(--color-text-secondary)] text-xs">Property</span>
                <p className="font-medium text-white text-right max-w-[200px] truncate">
                  {listingAddress}
                </p>
              </div>
            </div>

            {/* Access Instructions Textarea */}
            <div className="border-t border-[var(--color-border)] pt-3.5 space-y-2">
              <label
                htmlFor="mobile-access-notes"
                className="block text-xs font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase"
              >
                Access Instructions <span className="text-[10px] lowercase text-[var(--color-text-secondary)]">(optional)</span>
              </label>
              <textarea
                id="mobile-access-notes"
                value={accessNotes}
                onChange={(e) => onChangeAccessNotes(e.target.value)}
                placeholder="Gate code, lockbox combo, key location, dog on premises..."
                rows={3}
                className="w-full rounded-sm border border-[var(--color-border)] bg-[#0d0d0d] px-3 py-2 text-sm text-white focus:outline focus:outline-1 focus:outline-[#CFB87C]"
              />
            </div>

            <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
              The photographer will be notified immediately. The listing will remain at Docs Signed until they accept your shoot request.
            </p>
          </div>

          {/* Sticky Bottom Action Bar for Mobile Submission */}
          <div className="sticky bottom-0 z-20 -mx-4 -mb-6 bg-[#121212]/95 backdrop-blur-md border-t border-[var(--color-border)] p-4 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isBooking}
              onClick={() => setStep(2)}
              className="h-11 border-[var(--color-border)] bg-[#1a1a1a] text-white hover:bg-white/5 px-4"
            >
              <ChevronLeft className="size-4 mr-1" />
              Back
            </Button>
            <Button
              type="button"
              disabled={isBooking || !selectedPhotographer || !selectedDate || !selectedTime}
              onClick={() => void onConfirm()}
              className="h-11 flex-1 bg-[#CFB87C] font-semibold text-black hover:bg-[#dcc487] flex items-center justify-center gap-2 text-sm shadow-lg"
            >
              {isBooking ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending Request...
                </>
              ) : (
                'Confirm Shoot Request →'
              )}
            </Button>
          </div>

          {/* Secondary Skip Option */}
          <div className="pt-2 text-center">
            <button
              type="button"
              disabled={isSkipping}
              onClick={() => void onSkip()}
              className="text-xs text-[var(--color-text-secondary)] hover:text-red-300 underline underline-offset-4 transition-colors"
            >
              Need to bypass scheduling? Skip photography instead →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
