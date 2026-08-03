import { api } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase'

export type ListingType = 'listing' | 'buyer' | 'lease'

export type ListingStage =
  | 'draft'
  | 'docs_pending'
  | 'docs_signed'
  | 'shoot_booked'
  | 'marketing'
  | 'mls_submitted'
  | 'live'
  | 'closed'

export interface PropertyAddress {
  street_number: string
  street_direction?: string
  street_name: string
  street_type?: string
  street_dir_suffix?: string
  unit_number?: string
  city: string
  state: string
  zip_code: string
  county: string
  subdivision?: string
  mls_number?: string
}

export type Listing = {
  id: string
  agent_id: string
  listing_type: ListingType
  stage: ListingStage
  address_full: string | null
  mls_number: string | null
  list_price: number | null
  go_live_date: string | null
  description_generated: string | null
  form_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
  brokermint_transaction_id: string | null
}

/** @deprecated Prefer `Listing` — kept for pipeline/dashboard compatibility */
export type ListingRow = Listing & { agent_id?: string }

export const LISTING_COLUMNS =
  'id, listing_type, stage, address_full, mls_number, list_price, go_live_date, description_generated, form_data, created_at, updated_at, agent_id, brokermint_transaction_id'

export const PIPELINE_STAGES: ListingStage[] = [
  'draft',
  'docs_pending',
  'docs_signed',
  'shoot_booked',
  'marketing',
  'mls_submitted',
  'live',
  'closed',
]

export const STAGE_LABEL: Record<ListingStage, string> = {
  draft: 'Draft',
  docs_pending: 'Docs Pending',
  docs_signed: 'Docs Signed',
  shoot_booked: 'Shoot Booked',
  marketing: 'Marketing',
  mls_submitted: 'MLS Submitted',
  live: 'Live',
  closed: 'Closed',
}

export const TYPE_LABEL: Record<ListingType, string> = {
  listing: 'Listing',
  buyer: 'Buyer Representation',
  lease: 'Lease',
}

export type ListingUpdatePayload = {
  description_generated: string
  form_data: Record<string, unknown> | null
}

export function stageIndex(stage: ListingStage): number {
  return PIPELINE_STAGES.indexOf(stage)
}

/** Next stage in the pipeline, when advanced manually or via integrations. */
export const STAGE_NEXT: Partial<Record<ListingStage, ListingStage>> = {
  draft: 'docs_pending',
  docs_pending: 'docs_signed',
  docs_signed: 'shoot_booked',
  shoot_booked: 'marketing',
  marketing: 'mls_submitted',
  mls_submitted: 'live',
  live: 'closed',
}

export type StageGuidance = {
  headline: string
  description: string
  advanceLabel: string | null
}

export const STAGE_GUIDANCE: Record<ListingStage, StageGuidance> = {
  draft: {
    headline: 'Finish the NTREIS form',
    description:
      'Complete the property address and 22-section form. Voice Fill can walk you through it.',
    advanceLabel: null,
  },
  docs_pending: {
    headline: 'Get documents signed',
    description:
      'Send the listing agreement and disclosures through Dot Loop. Mark signed once the seller completes them.',
    advanceLabel: 'Mark docs signed',
  },
  docs_signed: {
    headline: 'Book photography',
    description:
      'Request a shoot date with your photographer. The listing moves to Shoot Booked only after they accept.',
    advanceLabel: null,
  },
  shoot_booked: {
    headline: 'Marketing prep',
    description:
      'Photography is confirmed. Open marketing to select assets and prepare your launch.',
    advanceLabel: 'Move to marketing',
  },
  marketing: {
    headline: 'Marketing & MLS',
    description:
      'Select marketing assets, then finalize and submit your listing through NTREIS.',
    advanceLabel: null,
  },
  mls_submitted: {
    headline: 'Go live',
    description:
      'Generate your MLS description, review it, then mark the listing live. Admin and marketing are notified automatically.',
    advanceLabel: null,
  },
  live: {
    headline: 'Listing is live',
    description: 'Monitor showings and offers. Close the listing when the transaction completes.',
    advanceLabel: 'Mark closed',
  },
  closed: {
    headline: 'Archived',
    description: 'This listing is closed and appears under Archived.',
    advanceLabel: null,
  },
}

export function getNextStage(stage: ListingStage): ListingStage | null {
  return STAGE_NEXT[stage] ?? null
}

/** Where the dashboard "Continue" link should route. */
export function getListingContinuePath(
  listing: Pick<Listing, 'id' | 'stage'>,
): string {
  if (listing.stage === 'draft') {
    return `/listing/${listing.id}/form`
  }
  if (listing.stage === 'docs_signed') {
    return `/listing/${listing.id}`
  }
  if (listing.stage === 'shoot_booked') {
    return `/listing/${listing.id}`
  }
  if (listing.stage === 'marketing') {
    return getMarketingPath(listing.id)
  }
  if (listing.stage === 'mls_submitted') {
    return getGoLivePath(listing.id)
  }
  return `/listing/${listing.id}`
}

export function getListingFormPath(id: string): string {
  return `/listing/${id}/form`
}

export function getPhotographyPath(id: string): string {
  return `/listing/${id}/photography`
}

export function getGoLivePath(id: string): string {
  return `/listing/${id}/go-live`
}

export function getMarketingPath(id: string): string {
  return `/listing/${id}/marketing`
}

export function getMarketingAssetsPath(id: string): string {
  return `/listing/${id}/marketing-assets`
}

export function getMlsPath(id: string): string {
  return `/listing/${id}/mls`
}

export function getListingCtaLabel(stage: ListingStage): string {
  if (stage === 'draft') return 'Continue form'
  if (stage === 'docs_pending') return 'Send docs'
  if (stage === 'docs_signed') return 'View shoot request'
  if (stage === 'shoot_booked') return 'Next step'
  if (stage === 'marketing') return 'Open marketing'
  if (stage === 'mls_submitted') return 'Go live'
  if (stage === 'closed') return 'View'
  return 'Next step'
}

export function canDeleteListing(stage: ListingStage): boolean {
  return stage === 'draft'
}

export function formatGoLiveDate(value: string | null): string {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export async function createListing(
  agentId: string,
  listingType: ListingType,
): Promise<{ id: string } | null> {
  const { data, error } = await getSupabaseClient()
    .from('listings')
    .insert({
      agent_id: agentId,
      listing_type: listingType,
      stage: 'draft',
      form_data: {},
    })
    .select('id')
    .single()

  if (error || !data) return null
  return { id: data.id as string }
}

export async function getListing(id: string): Promise<Listing | null> {
  const { data, error } = await getSupabaseClient()
    .from('listings')
    .select(LISTING_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  return data as Listing
}

export async function updateListingStage(
  id: string,
  stage: ListingStage,
): Promise<boolean> {
  try {
    const res = await api<{ success: boolean }>(`/listings/${id}/transition`, {
      method: 'POST',
      body: { stage },
    })
    return res.success
  } catch (err) {
    console.error('Failed to transition stage:', err)
    return false
  }
}

export async function advanceListingStage(
  id: string,
  currentStage: ListingStage,
): Promise<ListingStage | null> {
  const next = getNextStage(currentStage)
  if (!next) return null
  const ok = await updateListingStage(id, next)
  return ok ? next : null
}

export async function deleteListing(
  id: string,
  agentId: string,
): Promise<boolean> {
  const supabase = getSupabaseClient()

  // 1. Delete associated bookings
  await supabase
    .from('bookings')
    .delete()
    .eq('listing_id', id)

  // 2. Delete the listing itself
  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', id)
    .eq('agent_id', agentId)
    .eq('stage', 'draft')

  return !error
}

export async function updateListingFormData(
  id: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const existing = await getListing(id)
  if (!existing) return false

  const merged: Record<string, unknown> = {
    ...(existing.form_data ?? {}),
    ...patch,
  }

  const updatePayload: Record<string, any> = { form_data: merged }
  if (patch.listing_type) {
    updatePayload.listing_type = patch.listing_type
  }

  const { error } = await getSupabaseClient()
    .from('listings')
    .update(updatePayload)
    .eq('id', id)

  return !error
}

export function formatPropertyAddress(address: PropertyAddress): string {
  const parts: string[] = []
  const street = [
    address.street_number,
    address.street_direction,
    address.street_name,
    address.street_type,
    address.street_dir_suffix,
  ]
    .filter(Boolean)
    .join(' ')
  if (street.trim()) parts.push(street.trim())
  if (address.unit_number?.trim()) parts.push(`#${address.unit_number.trim()}`)
  const cityLine = [
    address.city,
    address.state,
    address.zip_code,
  ]
    .filter(Boolean)
    .join(', ')
  if (cityLine.trim()) parts.push(cityLine.trim())
  return parts.join(', ')
}

export function propertyAddressFromFormData(
  formData: Record<string, unknown> | null,
): PropertyAddress {
  const str = (key: keyof PropertyAddress) => {
    const value = formData?.[key]
    return typeof value === 'string' ? value : ''
  }
  const opt = (key: keyof PropertyAddress) => {
    const value = formData?.[key]
    return typeof value === 'string' && value.trim() ? value : undefined
  }

  return {
    street_number: str('street_number'),
    street_direction: opt('street_direction'),
    street_name: str('street_name'),
    street_type: opt('street_type'),
    street_dir_suffix: opt('street_dir_suffix'),
    unit_number: opt('unit_number'),
    city: str('city'),
    state: str('state') || 'TX',
    zip_code: str('zip_code'),
    county: str('county'),
    subdivision: opt('subdivision'),
    mls_number: opt('mls_number'),
  }
}

export function listingSpecsFromForm(
  formData: Record<string, unknown> | null,
): { beds: string; baths: string; sqft: string } {
  const pick = (...keys: string[]) => {
    if (!formData) return '—'
    for (const key of keys) {
      const value = formData[key]
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value)
      }
    }
    return '—'
  }

  return {
    beds: pick('bedrooms', 'beds', 'bedroom_count', 'bedrooms_total'),
    baths: pick('bathrooms', 'baths', 'bathroom_count', 'bathrooms_full'),
    sqft: pick('sqft', 'square_feet', 'living_area', 'living_area_sqft'),
  }
}

export async function generateListingDescription(
  listingId: string,
): Promise<{ description: string; char_count: number }> {
  return api<{ description: string; char_count: number }>(
    `/listings/${listingId}/generate-description`,
    { method: 'POST', body: {} },
  )
}

export async function saveListingDescription(
  listingId: string,
  description: string,
): Promise<boolean> {
  const existing = await getListing(listingId)
  if (!existing) return false

  const merged: Record<string, unknown> = {
    ...(existing.form_data ?? {}),
    property_description: description,
  }

  const { error } = await getSupabaseClient()
    .from('listings')
    .update({
      description_generated: description,
      form_data: merged,
    })
    .eq('id', listingId)

  return !error
}

export async function markListingLive(
  listingId: string,
  goLiveDate?: string,
): Promise<boolean> {
  try {
    await api<{ success: boolean; stage: string }>(
      `/listings/${listingId}/go-live`,
      {
        method: 'POST',
        body: goLiveDate ? { go_live_date: goLiveDate } : {},
      },
    )
    return true
  } catch {
    return false
  }
}

export async function addMarketingAsset(
  listingId: string,
  assetId: string,
  assetName: string,
  priceCents: number,
): Promise<Record<string, string> | null> {
  try {
    const result = await api<{ success: boolean; marketing_statuses: Record<string, string> }>(
      `/listings/${listingId}/marketing/add-asset`,
      {
        method: 'POST',
        body: {
          asset_id: assetId,
          asset_name: assetName,
          price_cents: priceCents,
          paid: false,
        },
      },
    )
    return result.marketing_statuses
  } catch (error) {
    console.error('Failed to add marketing asset:', error)
    return null
  }
}
