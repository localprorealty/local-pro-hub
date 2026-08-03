import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Loader2, Phone } from 'lucide-react'

import { ShootWeekCalendar } from '@/components/booking/ShootWeekCalendar'
import { startOfWeek } from '@/lib/calendar-utils'
import { BookingMessagesList } from '@/components/booking/BookingMessagesList'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MissionShell } from '@/components/layout/MissionShell'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  completeBooking,
  confirmBooking,
  formatShootDate,
  formatShootTime,
  getBookingMessages,
  getMyShoots,
  getPhotographerAvailability,
  suggestAlternate,
  tierBadgeClass,
  toIsoDate,
  toMonthKey,
  updateBlockedDates,
  type PhotographerShoot,
  type PhotographerTier,
} from '@/lib/bookings'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchUserProfile } from '@/lib/users'

function endTimeLabel(startTime: string): string {
  const normalized = startTime.length >= 5 ? startTime.slice(0, 5) : startTime
  const [h, m] = normalized.split(':').map(Number)
  const end = new Date()
  end.setHours(h + 3, m, 0, 0)
  return `${formatShootTime(startTime)} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

function PhotographerCalendarContent() {
  const [shoots, setShoots] = useState<PhotographerShoot[]>([])
  const [photographerId, setPhotographerId] = useState<string | null>(null)
  const [photographerName, setPhotographerName] = useState('')
  const [photographerTier, setPhotographerTier] = useState<PhotographerTier>('standard')
  const [agentEmail, setAgentEmail] = useState<string | undefined>()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month')
  const [selectedShoot, setSelectedShoot] = useState<PhotographerShoot | null>(null)
  const [blockedDates, setBlockedDates] = useState<string[]>([])
  const [showBlockPicker, setShowBlockPicker] = useState(false)
  const [blockRange, setBlockRange] = useState<Date[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingBlock, setIsSavingBlock] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSuggest, setShowSuggest] = useState(false)
  const [suggestDate, setSuggestDate] = useState<Date | undefined>()
  const [suggestTime, setSuggestTime] = useState('14:00')
  const [suggestNote, setSuggestNote] = useState('')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession()
      const userId = session?.user?.id
      if (!userId) throw new Error('Not signed in')

      const profile = await fetchUserProfile(userId)
      setPhotographerId(userId)
      setPhotographerName(profile?.full_name ?? 'Photographer')
      if (profile?.photographer_tier) setPhotographerTier(profile.photographer_tier)
      if (profile?.email) setAgentEmail(profile.email)

      const [myShoots, availability] = await Promise.all([
        getMyShoots(),
        getPhotographerAvailability(userId, toMonthKey(new Date())),
      ])
      setShoots(myShoots)
      setBlockedDates(availability.blocked_dates)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load bookings.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!photographerId) return
    let cancelled = false
    const loadMonth = async () => {
      try {
        const availability = await getPhotographerAvailability(
          photographerId,
          toMonthKey(weekStart),
        )
        if (!cancelled) setBlockedDates(availability.blocked_dates)
      } catch {
        /* non-critical */
      }
    }
    void loadMonth()
    return () => {
      cancelled = true
    }
  }, [photographerId, weekStart])

  const bookedDateSet = useMemo(
    () => new Set(shoots.map((s) => s.shoot_date)),
    [shoots],
  )
  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates])

  const shootsOnDate = useMemo(() => {
    if (!selectedShoot) return []
    return shoots.filter((s) => s.shoot_date === selectedShoot.shoot_date)
  }, [selectedShoot, shoots])

  const handleSelectDate = (iso: string) => {
    const match = shoots.find((s) => s.shoot_date === iso)
    if (match) setSelectedShoot(match)
  }

  const handleBlockSave = async () => {
    if (blockRange.length === 0) return
    setIsSavingBlock(true)
    setError(null)
    try {
      const newDates = blockRange.map((d) => toIsoDate(d))
      const merged = Array.from(new Set([...blockedDates, ...newDates])).sort()
      await updateBlockedDates(merged)
      setBlockedDates(merged)
      setShowBlockPicker(false)
      setBlockRange([])
    } catch (blockError) {
      setError(blockError instanceof Error ? blockError.message : 'Could not block dates.')
    } finally {
      setIsSavingBlock(false)
    }
  }

  const runAction = async (
    id: string,
    action: 'confirm' | 'complete' | 'suggest',
  ) => {
    setActionLoading(id)
    setError(null)
    try {
      if (action === 'confirm') {
        await confirmBooking(id)
        await loadData()
        setSelectedShoot(null)
      } else if (action === 'complete') {
        await completeBooking(id)
        await loadData()
        setSelectedShoot(null)
      } else if (action === 'suggest' && suggestDate) {
        await suggestAlternate(id, {
          suggested_dates: [toIsoDate(suggestDate)],
          suggested_times: [suggestTime],
          note: suggestNote.trim() || undefined,
        })
        await loadData()
        setShowSuggest(false)
        setSuggestNote('')
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed.')
    } finally {
      setActionLoading(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-text-secondary)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading bookings...
      </div>
    )
  }

  return (
    <MissionShell
      role="photographer"
      email={agentEmail}
      title="My Bookings"
      subtitle={photographerName}
    >
      {error ? (
        <p className="mb-4 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Tap a booked day to view shoot details.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowBlockPicker((open) => !open)}
          className="rounded-sm border-[var(--color-border)] bg-transparent text-white hover:bg-[#CFB87C]/10"
        >
          <CalendarDays className="mr-2 size-4" />
          Block Date Range
        </Button>
      </div>

      {showBlockPicker ? (
        <div className="mb-6 rounded-sm border border-[var(--color-border)] bg-[#1a1a1a] p-4">
          <p className="mb-3 text-sm text-white">Select dates to block</p>
          <Calendar
            mode="multiple"
            selected={blockRange}
            onSelect={(dates) => setBlockRange(dates ?? [])}
            className="mx-auto"
          />
          <div className="mt-4 flex gap-3">
            <Button
              type="button"
              disabled={isSavingBlock || blockRange.length === 0}
              onClick={() => void handleBlockSave()}
              className="rounded-sm bg-[#CFB87C] text-[#0a0a0a] hover:bg-[#dcc487]"
            >
              {isSavingBlock ? 'Saving...' : 'Save blocked dates'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowBlockPicker(false)
                setBlockRange([])
              }}
              className="rounded-sm border-[var(--color-border)] text-white"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        <ShootWeekCalendar
          weekStart={weekStart}
          blockedDates={blockedSet}
          bookedDates={bookedDateSet}
          selectedDate={selectedShoot?.shoot_date ?? null}
          onWeekChange={setWeekStart}
          onSelectDate={handleSelectDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <AnimatePresence mode="wait">
          {selectedShoot ? (
            <motion.aside
              key={selectedShoot.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className="h-fit rounded-sm border border-[var(--color-border)] bg-[#1a1a1a] p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="text-xs tracking-widest text-[#CFB87C] uppercase">
                  {selectedShoot.listing_type ?? 'Listing'}
                </span>
                <span
                  className={`rounded-sm px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${tierBadgeClass(photographerTier)}`}
                >
                  {photographerTier}
                </span>
              </div>

              <h3 className="text-xl font-semibold leading-snug text-white">
                {selectedShoot.property_address}
              </h3>

              <div className="mt-4 space-y-2 text-sm">
                <p className="text-[var(--color-text-secondary)]">
                  Agent:{' '}
                  <span className="text-white">{selectedShoot.agent_name ?? '—'}</span>
                </p>
                {selectedShoot.agent_phone ? (
                  <a
                    href={`tel:${selectedShoot.agent_phone}`}
                    className="inline-flex items-center gap-2 text-[#CFB87C] hover:underline"
                  >
                    <Phone className="size-4" />
                    {selectedShoot.agent_phone}
                  </a>
                ) : null}
                <p className="text-white">
                  Time: {endTimeLabel(selectedShoot.shoot_time)}
                </p>
                <p className="text-xs tracking-widest text-[var(--color-text-secondary)] uppercase">
                  Status: {selectedShoot.status}
                </p>
              </div>

              <div className="mt-4">
                <BookingMessagesList messages={getBookingMessages(selectedShoot)} />
              </div>

              <div className="mt-6 space-y-2">
                {selectedShoot.status === 'pending' ? (
                  <>
                    <Button
                      type="button"
                      disabled={actionLoading === selectedShoot.id}
                      onClick={() => void runAction(selectedShoot.id, 'confirm')}
                      className="h-10 w-full rounded-sm bg-[#CFB87C] font-semibold text-[#0a0a0a]"
                    >
                      {actionLoading === selectedShoot.id
                        ? 'Updating...'
                        : 'Accept shoot date'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowSuggest((open) => !open)}
                      className="h-10 w-full rounded-sm border-[var(--color-border)] text-white"
                    >
                      Suggest alternate date →
                    </Button>
                  </>
                ) : null}

                {selectedShoot.status === 'alt_suggested' ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Waiting for the agent to pick an alternate or counter-offer.
                  </p>
                ) : null}

                {selectedShoot.status === 'confirmed' ? (
                  <Button
                    type="button"
                    disabled={actionLoading === selectedShoot.id}
                    onClick={() => void runAction(selectedShoot.id, 'complete')}
                    className="h-10 w-full rounded-sm bg-[#CFB87C] font-semibold text-[#0a0a0a]"
                  >
                    {actionLoading === selectedShoot.id ? 'Updating...' : 'Mark complete'}
                  </Button>
                ) : null}
              </div>

              {showSuggest && selectedShoot.status === 'pending' ? (
                <div className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4">
                  <Calendar
                    mode="single"
                    selected={suggestDate}
                    onSelect={setSuggestDate}
                  />
                  <select
                    value={suggestTime}
                    onChange={(event) => setSuggestTime(event.target.value)}
                    className="h-10 w-full rounded-sm border border-[var(--color-border)] bg-[#0a0a0a] px-3 text-sm text-white"
                  >
                    {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map(
                      (slot) => (
                        <option key={slot} value={slot}>
                          {formatShootTime(slot)}
                        </option>
                      ),
                    )}
                  </select>
                  <textarea
                    value={suggestNote}
                    onChange={(event) => setSuggestNote(event.target.value)}
                    placeholder="Optional note for the agent"
                    className="min-h-16 w-full rounded-sm border border-[var(--color-border)] bg-[#0a0a0a] px-3 py-2 text-sm text-white"
                  />
                  <Button
                    type="button"
                    disabled={!suggestDate || actionLoading === selectedShoot.id}
                    onClick={() => void runAction(selectedShoot.id, 'suggest')}
                    className="w-full rounded-sm bg-[#CFB87C] text-[#0a0a0a]"
                  >
                    Send suggestion
                  </Button>
                </div>
              ) : null}

              {shootsOnDate.length > 1 ? (
                <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                  {shootsOnDate.length} shoots on this day — showing first match.
                </p>
              ) : null}
            </motion.aside>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex h-48 items-center justify-center rounded-sm border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]"
            >
              Select a booked day to view details
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-10">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg text-white">
          Upcoming shoots
        </h2>
        <div className="overflow-x-auto rounded-sm border border-[var(--color-border)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#1a1a1a] text-[10px] tracking-widest text-[var(--color-text-secondary)] uppercase">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {shoots.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                    No bookings yet.
                  </td>
                </tr>
              ) : (
                shoots.map((shoot) => (
                  <tr
                    key={shoot.id}
                    className="cursor-pointer border-b border-[var(--color-border)]/50 hover:bg-[#1a1a1a]/60"
                    onClick={() => setSelectedShoot(shoot)}
                  >
                    <td className="px-4 py-3 text-white">
                      {formatShootDate(shoot.shoot_date)}
                    </td>
                    <td className="px-4 py-3 text-white">{shoot.property_address}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {shoot.agent_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {formatShootTime(shoot.shoot_time)}
                    </td>
                    <td className="px-4 py-3 text-[#CFB87C]">{shoot.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MissionShell>
  )
}

export default function PhotographerCalendarPage() {
  return (
    <ErrorBoundary title="Photographer Calendar">
      <PhotographerCalendarContent />
    </ErrorBoundary>
  )
}
