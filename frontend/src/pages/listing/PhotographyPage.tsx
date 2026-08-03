import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { ShootWeekCalendar } from '@/components/booking/ShootWeekCalendar'
import { startOfWeek } from '@/lib/calendar-utils'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ListingMissionHeader } from '@/components/listing/ListingMissionHeader'
import { MissionShell } from '@/components/layout/MissionShell'
import { Button } from '@/components/ui/button'
import {
  createBooking,
  formatShootDate,
  formatShootTime,
  getListingBooking,
  getPhotographerAvailability,
  getPhotographers,
  SHOOT_TIME_SLOTS,
  tierBadgeClass,
  toMonthKey,
  type Photographer,
  type PhotographerTier,
} from '@/lib/bookings'
import { getListing, type Listing } from '@/lib/listings'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchUserProfile } from '@/lib/users'

function normalizeTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value
}

function PhotographyContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [listing, setListing] = useState<Listing | null>(null)
  const [preferredTier, setPreferredTier] = useState<PhotographerTier>('standard')
  const [photographers, setPhotographers] = useState<Photographer[]>([])
  const [selectedPhotographer, setSelectedPhotographer] = useState<Photographer | null>(null)
  const [availability, setAvailability] = useState<{
    blocked_dates: string[]
    booked_dates: Array<{ date: string; time: string }>
  } | null>(null)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [accessNotes, setAccessNotes] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [isBooking, setIsBooking] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [agentEmail, setAgentEmail] = useState<string | undefined>()

  const loadPage = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession()
      const userId = session?.user?.id
      const [listingRow, profile, allPhotographers] = await Promise.all([
        getListing(id),
        userId ? fetchUserProfile(userId) : Promise.resolve(null),
        getPhotographers(),
      ])
      if (!listingRow) throw new Error('Listing not found')
      if (listingRow.stage !== 'docs_signed') {
        navigate(`/listing/${id}`, { replace: true })
        return
      }

      const existing = await getListingBooking(id)
      if (existing) {
        navigate(`/listing/${id}`, { replace: true })
        return
      }

      setListing(listingRow)
      if (profile?.photographer_tier) {
        setPreferredTier(profile.photographer_tier)
      }
      if (profile?.email) setAgentEmail(profile.email)

      const tier = profile?.photographer_tier ?? 'standard'
      const preferred = allPhotographers.filter((p) => p.photographer_tier === tier)
      setPhotographers(preferred.length > 0 ? preferred : allPhotographers)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load page.')
    } finally {
      setIsLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  const monthKey = toMonthKey(weekStart)

  useEffect(() => {
    if (!selectedPhotographer) {
      setAvailability(null)
      return
    }

    let cancelled = false
    const loadAvailability = async () => {
      setIsLoadingAvailability(true)
      try {
        const data = await getPhotographerAvailability(selectedPhotographer.id, monthKey)
        if (!cancelled) setAvailability(data)
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : 'Could not load availability.',
          )
        }
      } finally {
        if (!cancelled) setIsLoadingAvailability(false)
      }
    }

    void loadAvailability()
    return () => {
      cancelled = true
    }
  }, [selectedPhotographer, monthKey])

  const blockedSet = useMemo(
    () => new Set(availability?.blocked_dates ?? []),
    [availability?.blocked_dates],
  )
  const bookedDateSet = useMemo(
    () => new Set((availability?.booked_dates ?? []).map((b) => b.date)),
    [availability?.booked_dates],
  )
  const bookedTimesForDay = useMemo(() => {
    if (!selectedDate) return new Set<string>()
    return new Set(
      (availability?.booked_dates ?? [])
        .filter((b) => b.date === selectedDate)
        .map((b) => normalizeTime(b.time)),
    )
  }, [availability?.booked_dates, selectedDate])

  const handleConfirm = async () => {
    if (!id || !selectedPhotographer || !selectedDate || !selectedTime) return
    setIsBooking(true)
    setBookingError(null)
    try {
      await createBooking({
        listing_id: id,
        photographer_id: selectedPhotographer.id,
        shoot_date: selectedDate,
        shoot_time: selectedTime,
        access_notes: accessNotes.trim() || undefined,
      })
      navigate(`/listing/${id}`, {
        state: {
          bookingSuccess:
            'Shoot request sent — awaiting photographer confirmation',
        },
      })
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Booking failed.')
    } finally {
      setIsBooking(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-text-secondary)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading...
      </div>
    )
  }

  if (loadError || !listing || !id) {
    return (
      <div className="rounded-sm border border-red-500/30 bg-red-500/5 p-6 text-red-300">
        {loadError ?? 'Listing not found'}
      </div>
    )
  }

  const listingHubPath = `/listing/${id}`

  return (
    <MissionShell
      role="agent"
      email={agentEmail}
      hideDefaultHeader
      headerSlot={
        <ListingMissionHeader
          backTo={listingHubPath}
          backLabel="Back to listing"
          title="Book Photography"
          subtitle={listing.address_full ?? 'Unnamed listing'}
          email={agentEmail}
        />
      }
    >
      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <section>
            <p className="mb-3 text-[10px] tracking-widest text-[#CFB87C] uppercase">
              Photographer
            </p>
            <div className="space-y-3">
              {photographers.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
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
                        setSelectedPhotographer(photographer)
                        setSelectedDate(null)
                        setSelectedTime(null)
                      }}
                      className={`w-full rounded-sm border bg-[#1a1a1a] p-4 text-left transition-colors ${
                        selected
                          ? 'border-[#CFB87C]'
                          : 'border-[var(--color-border)] hover:border-[#CFB87C]/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-white">{photographer.full_name}</p>
                        <span
                          className={`rounded-sm px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${tierBadgeClass(photographer.photographer_tier)}`}
                        >
                          {photographer.photographer_tier}
                        </span>
                      </div>
                      {photographer.phone ? (
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {photographer.phone}
                        </p>
                      ) : null}
                      <p className="mt-3 text-xs font-bold tracking-widest text-[#CFB87C] uppercase">
                        {selected ? 'Selected' : 'Select'}
                      </p>
                    </button>
                  )
                })
              )}
            </div>
            {photographers.some((p) => p.photographer_tier === preferredTier) ? (
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                Showing your preferred {preferredTier} tier first.
              </p>
            ) : null}
          </section>

          <AnimatePresence>
            {selectedPhotographer ? (
              <motion.div
                key={selectedPhotographer.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                {isLoadingAvailability ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <Loader2 className="size-4 animate-spin" />
                    Loading calendar...
                  </div>
                ) : (
                  <ShootWeekCalendar
                    weekStart={weekStart}
                    blockedDates={blockedSet}
                    bookedDates={bookedDateSet}
                    selectedDate={selectedDate}
                    onWeekChange={setWeekStart}
                    onSelectDate={(iso) => {
                      setSelectedDate(iso)
                      setSelectedTime(null)
                    }}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                  />
                )}

                {selectedDate ? (
                  <div className="mt-4">
                    <p className="mb-2 text-[10px] tracking-widest text-[#CFB87C] uppercase">
                      Time
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {SHOOT_TIME_SLOTS.map((slot) => {
                        const taken = bookedTimesForDay.has(slot)
                        const active = selectedTime === slot
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={taken}
                            onClick={() => setSelectedTime(slot)}
                            className={`rounded-sm border px-3 py-2 text-sm ${
                              taken
                                ? 'cursor-not-allowed border-[var(--color-border)] bg-[#141414] text-[#555555]'
                                : active
                                  ? 'border-[#CFB87C] bg-[#CFB87C]/15 text-white'
                                  : 'border-[var(--color-border)] bg-[#1a1a1a] text-white hover:border-[#CFB87C]/50'
                            }`}
                          >
                            {formatShootTime(slot)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <aside className="rounded-sm border border-[var(--color-border)] bg-[#1a1a1a] p-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-white">
            Booking Summary
          </h2>

          {selectedPhotographer && selectedDate && selectedTime ? (
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
                <div>
                  <p className="text-[var(--color-text-secondary)]">Photographer</p>
                  <p className="font-semibold text-white">{selectedPhotographer.full_name}</p>
                </div>
                <span
                  className={`rounded-sm px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${tierBadgeClass(selectedPhotographer.photographer_tier)}`}
                >
                  {selectedPhotographer.photographer_tier}
                </span>
              </div>
              <div>
                <p className="text-[var(--color-text-secondary)]">Date</p>
                <p className="text-white">{formatShootDate(selectedDate)}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-secondary)]">Time</p>
                <p className="text-white">{formatShootTime(selectedTime)}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-secondary)]">Property</p>
                <p className="text-white">{listing.address_full ?? 'Address not set'}</p>
              </div>

              <div className="pt-2">
                <label
                  htmlFor="access-notes"
                  className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase"
                >
                  Access Instructions (optional)
                </label>
                <textarea
                  id="access-notes"
                  value={accessNotes}
                  onChange={(event) => setAccessNotes(event.target.value)}
                  placeholder="Gate code, key location, dog..."
                  className="mt-2 min-h-24 w-full rounded-sm border border-[var(--color-border)] bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:outline focus:outline-2 focus:outline-[#CFB87C]"
                />
              </div>

              {bookingError ? (
                <p className="text-sm text-red-300" role="alert">
                  {bookingError}
                </p>
              ) : null}

              <Button
                type="button"
                disabled={isBooking}
                onClick={() => void handleConfirm()}
                className="h-11 w-full rounded-sm bg-[#CFB87C] font-semibold text-[#0a0a0a] hover:bg-[#dcc487]"
              >
                {isBooking ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  'Request Shoot →'
                )}
              </Button>

              <p className="text-xs text-[var(--color-text-secondary)]">
                The photographer is notified immediately. The listing stays at Docs Signed until
                they accept.
              </p>
            </div>
          ) : (
            <p className="mt-6 text-sm text-[var(--color-text-secondary)]">
              Select a photographer, date, and time to review your booking.
            </p>
          )}
        </aside>
      </div>
    </MissionShell>
  )
}

export default function PhotographyPage() {
  return (
    <ErrorBoundary title="Book Photography">
      <PhotographyContent />
    </ErrorBoundary>
  )
}
