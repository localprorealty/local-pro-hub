import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Building2,
  Camera,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  Phone,
  Plus,
  Send,
} from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ShootWeekCalendar } from '@/components/booking/ShootWeekCalendar'
import { VendorOrderEmailModal } from '@/components/booking/VendorOrderEmailModal'
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
import { getListing, updateListingStage, type Listing } from '@/lib/listings'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchUserProfile, type UserProfileRow } from '@/lib/users'
import {
  completeVendorOrder,
  fetchAgentVendors,
  type AgentVendor,
} from '@/lib/vendors'

function normalizeTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value
}

function PhotographyContent() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'internal' | 'vendor'>(() =>
    searchParams.get('tab') === 'vendor' ? 'vendor' : 'internal',
  )

  const [listing, setListing] = useState<Listing | null>(null)
  const [preferredTier, setPreferredTier] = useState<PhotographerTier>('standard')
  const [photographers, setPhotographers] = useState<Photographer[]>([])
  const [selectedPhotographer, setSelectedPhotographer] = useState<Photographer | null>(null)

  // External vendor flow state
  const [vendors, setVendors] = useState<AgentVendor[]>([])
  const [selectedVendor, setSelectedVendor] = useState<AgentVendor | null>(null)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [isMarkingOrdered, setIsMarkingOrdered] = useState(false)
  const [agentProfile, setAgentProfile] = useState<UserProfileRow | null>(null)

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
  const [isSkipping, setIsSkipping] = useState(false)
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
      const [listingRow, profile, allPhotographers, userVendors] = await Promise.all([
        getListing(id),
        userId ? fetchUserProfile(userId) : Promise.resolve(null),
        getPhotographers(),
        fetchAgentVendors().catch(() => [] as AgentVendor[]),
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
      if (profile) {
        setAgentProfile(profile)
        if (profile.photographer_tier) {
          setPreferredTier(profile.photographer_tier)
        }
        if (profile.email) setAgentEmail(profile.email)
      }

      const tier = profile?.photographer_tier ?? 'standard'
      const preferred = allPhotographers.filter((p) => p.photographer_tier === tier)
      setPhotographers(preferred.length > 0 ? preferred : allPhotographers)

      setVendors(userVendors)
      if (userVendors.length > 0) {
        const defaultVendor = userVendors.find((v) => v.is_default) || userVendors[0]
        setSelectedVendor(defaultVendor)
      }
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

  const handleSkip = async () => {
    if (!id) return
    setIsSkipping(true)
    setBookingError(null)
    try {
      const ok = await updateListingStage(id, 'shoot_booked')
      if (ok) {
        navigate(`/listing/${id}`, {
          state: {
            bookingSuccess: 'Photography booking stage skipped.',
          },
        })
      } else {
        setBookingError('Failed to skip photography booking.')
      }
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Failed to skip.')
    } finally {
      setIsSkipping(false)
    }
  }

  const handleMarkVendorOrdered = async () => {
    if (!id) return
    setIsMarkingOrdered(true)
    setBookingError(null)
    try {
      await completeVendorOrder(id, selectedVendor?.id)
      navigate(`/listing/${id}`, {
        state: {
          bookingSuccess: `External photography marked as ordered${selectedVendor ? ` with ${selectedVendor.name}` : ''}. Listing moved to Shoot Booked.`,
        },
      })
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Failed to advance listing.')
    } finally {
      setIsMarkingOrdered(false)
    }
  }

  const handleEmailSuccess = (method: 'gmail_smtp' | 'resend', recipient: string) => {
    if (!id) return
    const viaDesc = method === 'gmail_smtp' ? 'your Gmail account' : 'LocalPRO notification service'
    navigate(`/listing/${id}`, {
      state: {
        bookingSuccess: `Order email dispatched to ${recipient} via ${viaDesc}. Listing advanced to Shoot Booked.`,
      },
    })
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
          listingId={id}
          email={agentEmail}
        />
      }
    >
      {/* Primary Tab Switcher */}
      <div className="mb-6 flex border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => {
            setActiveTab('internal')
            setSearchParams({})
          }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'internal'
              ? 'border-[#CFB87C] text-[#CFB87C]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-white'
          }`}
        >
          <Camera className="h-4 w-4" />
          In-House Photographer
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('vendor')
            setSearchParams({ tab: 'vendor' })
          }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'vendor'
              ? 'border-[#CFB87C] text-[#CFB87C]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-white'
          }`}
        >
          <Building2 className="h-4 w-4" />
          My External Vendor
        </button>
      </div>

      {bookingError ? (
        <p
          className="mb-6 rounded-sm border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          {bookingError}
        </p>
      ) : null}

      {activeTab === 'internal' ? (
        /* In-House Photographer Booking Flow */
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

                <button
                  type="button"
                  disabled={isSkipping}
                  onClick={() => void handleSkip()}
                  className="w-full rounded-sm border border-dashed border-[var(--color-border)] hover:border-red-500/40 bg-red-950/5 hover:bg-red-950/10 p-4 text-left transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-white">Skip Photography</p>
                    <span className="rounded-sm bg-red-900/25 px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase text-red-200">
                      Skip Flow
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Advance this listing to the next stage without booking photography.
                  </p>
                  <p className="mt-3 text-xs font-bold tracking-widest text-red-300 uppercase">
                    {isSkipping ? 'Skipping...' : 'Skip Photography →'}
                  </p>
                </button>
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
      ) : (
        /* My External Vendor Flow */
        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
          <div className="space-y-6">
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] tracking-widest text-[#CFB87C] uppercase">
                  Your Preferred Vendors
                </p>
                <Link
                  to="/profile"
                  className="text-xs text-[#CFB87C] hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Manage in Profile
                </Link>
              </div>

              {vendors.length === 0 ? (
                <div className="rounded-sm border border-dashed border-[var(--color-border)] bg-[#161616] p-6 text-center space-y-3">
                  <Building2 className="mx-auto h-8 w-8 text-[#CFB87C]/70" />
                  <h4 className="text-sm font-semibold text-white">No External Vendors Saved</h4>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    Add your preferred photographer or media vendor to place orders directly or
                    send order request emails with a single click.
                  </p>
                  <Button
                    asChild
                    size="sm"
                    className="mt-2 bg-[#CFB87C] text-black font-semibold hover:bg-[#dcc487]"
                  >
                    <Link to="/profile">Add Vendor in Profile Settings →</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {vendors.map((vendor) => {
                    const selected = selectedVendor?.id === vendor.id
                    return (
                      <button
                        key={vendor.id}
                        type="button"
                        onClick={() => setSelectedVendor(vendor)}
                        className={`w-full rounded-sm border bg-[#1a1a1a] p-4 text-left transition-colors ${
                          selected
                            ? 'border-[#CFB87C]'
                            : 'border-[var(--color-border)] hover:border-[#CFB87C]/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-white">{vendor.name}</p>
                          {vendor.is_default && (
                            <span className="rounded-sm bg-[#CFB87C]/15 px-2 py-0.5 text-[10px] font-bold tracking-widest text-[#CFB87C] uppercase">
                              Default
                            </span>
                          )}
                        </div>
                        {vendor.website_url && (
                          <p className="mt-1 text-xs text-[var(--color-text-secondary)] truncate flex items-center gap-1">
                            <Globe className="h-3 w-3 shrink-0 text-[#CFB87C]" />
                            {vendor.website_url.replace(/^https?:\/\//, '')}
                          </p>
                        )}
                        {vendor.email && (
                          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)] truncate flex items-center gap-1">
                            <Mail className="h-3 w-3 shrink-0 text-[var(--color-text-secondary)]" />
                            {vendor.email}
                          </p>
                        )}
                        <p className="mt-3 text-xs font-bold tracking-widest text-[#CFB87C] uppercase">
                          {selected ? 'Selected' : 'Select'}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="mt-4">
                <button
                  type="button"
                  disabled={isSkipping}
                  onClick={() => void handleSkip()}
                  className="w-full rounded-sm border border-dashed border-[var(--color-border)] hover:border-red-500/40 bg-red-950/5 hover:bg-red-950/10 p-4 text-left transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-white">Skip Photography</p>
                    <span className="rounded-sm bg-red-900/25 px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase text-red-200">
                      Skip Flow
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Advance this listing to the next stage without booking photography.
                  </p>
                  <p className="mt-3 text-xs font-bold tracking-widest text-red-300 uppercase">
                    {isSkipping ? 'Skipping...' : 'Skip Photography →'}
                  </p>
                </button>
              </div>
            </section>
          </div>

          <aside className="rounded-sm border border-[var(--color-border)] bg-[#1a1a1a] p-6 space-y-6">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-lg text-white">
                External Vendor Ordering
              </h2>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Place an order with your preferred photographer via their direct ordering portal or by sending an order email.
              </p>
            </div>

            {selectedVendor ? (
              <div className="space-y-6">
                {/* Vendor Overview Card */}
                <div className="rounded-sm border border-[var(--color-border)] bg-[#141414] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white text-base">{selectedVendor.name}</h3>
                    {selectedVendor.is_default && (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#CFB87C]">
                        Preferred Vendor
                      </span>
                    )}
                  </div>
                  {selectedVendor.website_url && (
                    <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-[#CFB87C] shrink-0" />
                      <a
                        href={selectedVendor.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-white truncate"
                      >
                        {selectedVendor.website_url}
                      </a>
                    </p>
                  )}
                  {selectedVendor.email && (
                    <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span>{selectedVendor.email}</span>
                    </p>
                  )}
                  {selectedVendor.phone && (
                    <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{selectedVendor.phone}</span>
                    </p>
                  )}
                  {selectedVendor.notes && (
                    <div className="mt-2 pt-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] italic">
                      Notes: {selectedVendor.notes}
                    </div>
                  )}
                </div>

                {/* Step 1: Order actions */}
                <div className="space-y-3">
                  <p className="text-[10px] tracking-widest text-[#CFB87C] uppercase font-semibold">
                    Step 1 — Place Your Order
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Website Portal Button */}
                    <div className="flex flex-col justify-between rounded-sm border border-[var(--color-border)] bg-[#111111] p-4 space-y-3">
                      <div>
                        <div className="flex items-center gap-2 font-medium text-white text-sm">
                          <Globe className="h-4 w-4 text-[#CFB87C]" />
                          Online Ordering Portal
                        </div>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          Open the vendor&apos;s ordering website in a new tab.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!selectedVendor.website_url}
                        onClick={() => {
                          if (selectedVendor.website_url) {
                            window.open(selectedVendor.website_url, '_blank', 'noopener,noreferrer')
                          }
                        }}
                        className="w-full border-[var(--color-border)] text-white hover:bg-white/5 flex items-center justify-center gap-2"
                      >
                        <span>Open Ordering Site</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Send Order Email Button */}
                    <div className="flex flex-col justify-between rounded-sm border border-[var(--color-border)] bg-[#111111] p-4 space-y-3">
                      <div>
                        <div className="flex items-center gap-2 font-medium text-white text-sm">
                          <Mail className="h-4 w-4 text-[#CFB87C]" />
                          Direct Order Email
                        </div>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          Dispatch an editable order email with property details pre-filled.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => setIsOrderModalOpen(true)}
                        className="w-full bg-[#CFB87C] font-semibold text-black hover:bg-[#dcc487] flex items-center justify-center gap-2"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Send Order Email...</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Step 2: Confirmation & Advance Stage */}
                <div className="rounded-sm border border-[var(--color-border)] bg-[#111111] p-4 space-y-3">
                  <p className="text-[10px] tracking-widest text-[#CFB87C] uppercase font-semibold">
                    Step 2 — Advance Listing
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    If you placed the order on the vendor&apos;s site directly, mark photography ordered below to advance this listing to <strong className="text-white">Shoot Booked</strong>.
                  </p>
                  <Button
                    type="button"
                    disabled={isMarkingOrdered}
                    onClick={() => void handleMarkVendorOrdered()}
                    className="w-full h-11 bg-white/10 hover:bg-white/15 text-white font-semibold flex items-center justify-center gap-2"
                  >
                    {isMarkingOrdered ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Advancing stage...
                      </>
                    ) : (
                      'Mark Photography Ordered →'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Select a vendor from the list on the left to view ordering actions.
              </p>
            )}
          </aside>
        </div>
      )}

      {/* Editable Order Email Modal */}
      {selectedVendor && (
        <VendorOrderEmailModal
          isOpen={isOrderModalOpen}
          onClose={() => setIsOrderModalOpen(false)}
          onSuccess={handleEmailSuccess}
          listing={listing}
          vendor={selectedVendor}
          agentProfile={agentProfile}
        />
      )}
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
