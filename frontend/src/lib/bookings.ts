import { api } from '@/lib/api'

export type PhotographerTier = 'elite' | 'standard' | 'basic'

export interface Photographer {
  id: string
  full_name: string
  photographer_tier: PhotographerTier
  phone?: string
}

export interface AvailabilityData {
  blocked_dates: string[]
  booked_dates: Array<{ date: string; time: string }>
}

export interface BookingRequest {
  listing_id: string
  photographer_id: string
  shoot_date: string
  shoot_time: string
  access_notes?: string
}

export interface PhotographerShoot {
  id: string
  listing_id: string
  shoot_date: string
  shoot_time: string
  status: string
  access_notes: string | null
  suggested_alternate: unknown
  property_address: string
  listing_type: string | null
  agent_name: string | null
  agent_phone: string | null
  agent_email: string | null
}

export type SuggestedAlternate = {
  options: Array<{ date: string; time: string }>
  note?: string
  proposed_by?: 'photographer' | 'agent'
}

export type BookingMessage = {
  from: 'agent' | 'photographer'
  label: string
  text: string
}

export function parseSuggestedAlternate(value: unknown): SuggestedAlternate | null {
  if (!value || typeof value !== 'object') return null
  const row = value as SuggestedAlternate
  if (!Array.isArray(row.options)) return null
  return row
}

/** Notes visible to both agent and photographer during shoot negotiation. */
export function getBookingMessages(booking: {
  status: string
  access_notes: string | null
  suggested_alternate: unknown
}): BookingMessage[] {
  const messages: BookingMessage[] = []
  const suggested = parseSuggestedAlternate(booking.suggested_alternate)
  const access = booking.access_notes?.trim()
  const negotiationNote = suggested?.note?.trim()

  if (access) {
    messages.push({
      from: 'agent',
      label: 'Message from agent',
      text: access,
    })
  }

  if (negotiationNote && negotiationNote !== access) {
    const from: 'agent' | 'photographer' =
      suggested?.proposed_by === 'photographer'
        ? 'photographer'
        : suggested?.proposed_by === 'agent'
          ? 'agent'
          : booking.status === 'alt_suggested'
            ? 'photographer'
            : 'agent'

    messages.push({
      from,
      label: from === 'photographer' ? 'Note from photographer' : 'Note from agent',
      text: negotiationNote,
    })
  }

  return messages
}

export interface ListingBooking {
  id: string
  listing_id: string
  photographer_id: string
  shoot_date: string
  shoot_time: string
  status: string
  access_notes: string | null
  suggested_alternate: SuggestedAlternate | null
  created_at?: string
  photographer_name: string | null
  photographer_phone: string | null
  photographer_tier: PhotographerTier | null
}

export const SHOOT_TIME_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
] as const

export function formatShootTime(value: string): string {
  const normalized = value.length >= 5 ? value.slice(0, 5) : value
  const [hourStr, minuteStr] = normalized.split(':')
  const hour = Number(hourStr)
  const minute = Number(minuteStr)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatShootDate(value: string): string {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function toMonthKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function tierBadgeClass(tier: PhotographerTier): string {
  if (tier === 'elite') return 'bg-[#CFB87C] text-[#0a0a0a]'
  if (tier === 'standard') return 'bg-[#3B8BD4] text-white'
  return 'bg-[#555555] text-white'
}

export async function getPhotographers(tier?: string): Promise<Photographer[]> {
  const path = tier
    ? `/bookings/photographers?tier=${encodeURIComponent(tier)}`
    : '/bookings/photographers'
  return api<Photographer[]>(path)
}

export async function getPhotographerAvailability(
  photographerId: string,
  month: string,
): Promise<AvailabilityData> {
  return api<AvailabilityData>(
    `/bookings/photographer/${photographerId}/availability?month=${month}`,
  )
}

export async function createBooking(
  req: BookingRequest,
): Promise<{ success: boolean; booking_id: string }> {
  return api<{ success: boolean; booking_id: string }>('/bookings/create', {
    method: 'POST',
    body: req,
  })
}

export async function getListingBooking(
  listingId: string,
): Promise<ListingBooking | null> {
  return api<ListingBooking | null>(`/bookings/listing/${listingId}`)
}

export async function agentRespondToBooking(
  bookingId: string,
  payload: {
    action: 'accept_alternate' | 'counter'
    alternate_index?: number
    shoot_date?: string
    shoot_time?: string
    note?: string
  },
): Promise<void> {
  await api(`/bookings/${bookingId}/agent-respond`, {
    method: 'POST',
    body: payload,
  })
}

export async function getMyShoots(): Promise<PhotographerShoot[]> {
  return api<PhotographerShoot[]>('/bookings/my-shoots')
}

export async function confirmBooking(bookingId: string): Promise<void> {
  await api(`/bookings/${bookingId}/confirm`, { method: 'PUT' })
}

export async function completeBooking(bookingId: string): Promise<void> {
  await api(`/bookings/${bookingId}/complete`, { method: 'PUT' })
}

export async function suggestAlternate(
  bookingId: string,
  payload: {
    suggested_dates: string[]
    suggested_times: string[]
    note?: string
  },
): Promise<void> {
  await api(`/bookings/${bookingId}/suggest-alternate`, {
    method: 'POST',
    body: payload,
  })
}

export async function updateBlockedDates(blockedDates: string[]): Promise<void> {
  await api('/bookings/photographer/blocked-dates', {
    method: 'PUT',
    body: { blocked_dates: blockedDates },
  })
}
