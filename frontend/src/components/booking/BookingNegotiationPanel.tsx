import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { BookingMessagesList } from '@/components/booking/BookingMessagesList'
import { Button } from '@/components/ui/button'
import {
  agentRespondToBooking,
  formatShootDate,
  formatShootTime,
  getBookingMessages,
  getListingBooking,
  SHOOT_TIME_SLOTS,
  type ListingBooking,
  type SuggestedAlternate,
  parseSuggestedAlternate,
} from '@/lib/bookings'
import { getPhotographyPath } from '@/lib/listings'

type BookingNegotiationPanelProps = {
  listingId: string
  listingStage: string
  onBookingUpdated?: () => void
}

function parseSuggested(value: unknown): SuggestedAlternate | null {
  return parseSuggestedAlternate(value)
}

export function BookingNegotiationPanel({
  listingId,
  listingStage,
  onBookingUpdated,
}: BookingNegotiationPanelProps) {
  const [booking, setBooking] = useState<ListingBooking | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isActing, setIsActing] = useState(false)
  const [showCounter, setShowCounter] = useState(false)
  const [counterDate, setCounterDate] = useState('')
  const [counterTime, setCounterTime] = useState('14:00')
  const [counterNote, setCounterNote] = useState('')

  const loadBooking = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const row = await getListingBooking(listingId)
      setBooking(row)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load booking.')
    } finally {
      setIsLoading(false)
    }
  }, [listingId])

  useEffect(() => {
    void loadBooking()
  }, [loadBooking])

  const respond = async (
    action: 'accept_alternate' | 'counter',
    extra?: { alternate_index?: number },
  ) => {
    if (!booking) return
    setIsActing(true)
    setActionError(null)
    try {
      await agentRespondToBooking(booking.id, {
        action,
        alternate_index: extra?.alternate_index,
        shoot_date: action === 'counter' ? counterDate : undefined,
        shoot_time: action === 'counter' ? counterTime : undefined,
        note: action === 'counter' ? counterNote.trim() || undefined : undefined,
      })
      setShowCounter(false)
      await loadBooking()
      onBookingUpdated?.()
    } catch (respondError) {
      setActionError(
        respondError instanceof Error ? respondError.message : 'Could not send response.',
      )
    } finally {
      setIsActing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <Loader2 className="size-4 animate-spin" />
        Loading shoot request...
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>
  }

  if (!booking) {
    if (listingStage === 'docs_signed') {
      return (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No shoot scheduled yet.{' '}
          <Link to={getPhotographyPath(listingId)} className="text-[#CFB87C] underline">
            Book photography
          </Link>
        </p>
      )
    }
    return null
  }

  const suggested = parseSuggested(booking.suggested_alternate)
  const messages = getBookingMessages(booking)
  const statusLabel =
    booking.status === 'pending'
      ? 'Awaiting photographer'
      : booking.status === 'alt_suggested'
        ? 'Photographer suggested alternates'
        : booking.status === 'confirmed'
          ? 'Shoot confirmed'
          : booking.status

  return (
    <div className="mt-4 rounded-sm border border-[var(--color-border)] bg-[#0a0a0a]/60 p-4">
      <p className="text-[10px] tracking-widest text-[#CFB87C] uppercase">Shoot request</p>
      <p className="mt-1 text-sm font-semibold text-white">{statusLabel}</p>

      <div className="mt-3 grid gap-2 text-sm">
        <p className="text-[var(--color-text-secondary)]">
          Photographer:{' '}
          <span className="text-white">{booking.photographer_name ?? '—'}</span>
        </p>
        <p className="text-[var(--color-text-secondary)]">
          Proposed:{' '}
          <span className="text-white">
            {formatShootDate(booking.shoot_date)} at {formatShootTime(booking.shoot_time)}
          </span>
        </p>
      </div>

      {messages.length > 0 ? (
        <div className="mt-4">
          <BookingMessagesList messages={messages} />
        </div>
      ) : null}

      {booking.status === 'alt_suggested' && suggested ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Pick an alternate or send a counter-offer. The photographer must accept before the
            listing moves to Shoot Booked.
          </p>
          <div className="flex flex-wrap gap-2">
            {suggested.options.map((option, index) => (
              <Button
                key={`${option.date}-${option.time}`}
                type="button"
                disabled={isActing}
                onClick={() => void respond('accept_alternate', { alternate_index: index })}
                className="rounded-sm bg-[#CFB87C] text-[#0a0a0a] hover:bg-[#dcc487]"
              >
                Accept {formatShootDate(option.date)} · {formatShootTime(option.time)}
              </Button>
            ))}
          </div>
          {!showCounter ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCounter(true)}
              className="rounded-sm border-[var(--color-border)] text-white"
            >
              Suggest a different date →
            </Button>
          ) : (
            <div className="space-y-3 border-t border-[var(--color-border)] pt-3">
              <input
                type="date"
                value={counterDate}
                onChange={(event) => setCounterDate(event.target.value)}
                className="h-10 w-full rounded-sm border border-[var(--color-border)] bg-[#1a1a1a] px-3 text-sm text-white"
              />
              <select
                value={counterTime}
                onChange={(event) => setCounterTime(event.target.value)}
                className="h-10 w-full rounded-sm border border-[var(--color-border)] bg-[#1a1a1a] px-3 text-sm text-white"
              >
                {SHOOT_TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {formatShootTime(slot)}
                  </option>
                ))}
              </select>
              <textarea
                value={counterNote}
                onChange={(event) => setCounterNote(event.target.value)}
                placeholder="Optional note for photographer"
                className="min-h-16 w-full rounded-sm border border-[var(--color-border)] bg-[#1a1a1a] px-3 py-2 text-sm text-white"
              />
              <Button
                type="button"
                disabled={isActing || !counterDate}
                onClick={() => void respond('counter')}
                className="w-full rounded-sm bg-[#CFB87C] text-[#0a0a0a]"
              >
                {isActing ? 'Sending...' : 'Send counter-offer'}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {booking.status === 'pending' ? (
        <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
          Waiting for the photographer to accept or suggest another time.
        </p>
      ) : null}

      {booking.status === 'confirmed' ? (
        <p className="mt-3 text-xs text-emerald-300">
          Both parties agreed — this listing is ready for Shoot Booked.
        </p>
      ) : null}

      {actionError ? (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  )
}
