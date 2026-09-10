import { API_BASE_URL } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase'

export type PublicPipelineStage = {
  key: string
  label: string
  status: 'completed' | 'current' | 'upcoming'
}

export type PublicPhoto = {
  id: string
  url: string
  category: string
  caption?: string
  is_hero: boolean
  sort_order: number
}

export type PublicComment = {
  id: string
  commenter_name: string
  comment_text: string
  created_at: string
}

export type PublicAgentInfo = {
  name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  brand_logo_url: string | null
}

export type BrokerageInfo = {
  name: string
  tagline: string
  address: string
  phone: string
  website: string
}

export type PublicListingSpecs = {
  property_type?: string
  bedrooms?: number | string
  bathrooms_full?: number | string
  bathrooms_half?: number | string
  square_feet?: number | string
  year_built?: number | string
  subdivision?: string
}

export type PublicListingShareData = {
  id: string
  token: string
  address_full: string
  list_price?: number | null
  stage: string
  specs: PublicListingSpecs
  description: string
  pipeline: PublicPipelineStage[]
  photos: PublicPhoto[]
  comments: PublicComment[]
  agent: PublicAgentInfo
  brokerage: BrokerageInfo
}

export type ShareLinkStatus = {
  token: string | null
  is_publicly_shared: boolean
  share_url: string | null
  created_at?: string | null
}

export type CreateCommentInput = {
  commenter_name: string
  comment_text: string
  hp_website?: string
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const session = await getSupabaseClient().auth.getSession()
  const token = session.data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Public, unauthenticated endpoint: Retrieve sanitized listing details & photos.
 */
export async function fetchPublicListingShare(token: string): Promise<PublicListingShareData> {
  const res = await fetch(`${API_BASE_URL}/public/share/${encodeURIComponent(token)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || 'This shared listing was not found or is currently inactive.')
  }
  return res.json()
}

/**
 * Public, unauthenticated endpoint: Submit client or visitor feedback.
 * Includes rate limiting and honeypot protection.
 */
export async function submitPublicComment(
  token: string,
  input: CreateCommentInput,
): Promise<PublicComment> {
  const res = await fetch(`${API_BASE_URL}/public/share/${encodeURIComponent(token)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || 'Failed to submit feedback. Please try again.')
  }
  return res.json()
}

/**
 * Agent authenticated endpoint: Retrieve current share link status.
 */
export async function fetchListingShareStatus(listingId: string): Promise<ShareLinkStatus> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/listings/${listingId}/share-link`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || 'Failed to retrieve share link status.')
  }
  return res.json()
}

/**
 * Agent authenticated endpoint: Generate a 192-bit secure share token and activate sharing.
 */
export async function generateListingShareLink(listingId: string): Promise<ShareLinkStatus> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/listings/${listingId}/share-link`, {
    method: 'POST',
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || 'Failed to generate share link.')
  }
  return res.json()
}

/**
 * Agent authenticated endpoint: Toggle sharing on/off or regenerate the secure token.
 */
export async function updateListingShareStatus(
  listingId: string,
  isShared: boolean,
  regenerateToken = false,
): Promise<ShareLinkStatus> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/listings/${listingId}/share-link`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ is_publicly_shared: isShared, regenerate_token: regenerateToken }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || 'Failed to update share link.')
  }
  return res.json()
}

/**
 * Agent authenticated endpoint: Get all comments on the listing.
 */
export async function fetchListingComments(listingId: string): Promise<PublicComment[]> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/listings/${listingId}/comments`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || 'Failed to fetch comments.')
  }
  return res.json()
}

/**
 * Agent authenticated endpoint: Moderate / delete a comment.
 */
export async function deleteListingComment(listingId: string, commentId: string): Promise<void> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/listings/${listingId}/comments/${commentId}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || 'Failed to delete comment.')
  }
}

export type UnreadComment = {
  id: string
  listing_id: string
  address_full: string
  commenter_name: string
  comment_text: string
  created_at: string
  read_at?: string | null
}

export type UnreadCommentsResponse = {
  count: number
  unread: UnreadComment[]
}

/**
 * Agent authenticated endpoint: Fetch unread comments across all of an agent's listings.
 */
export async function fetchUnreadComments(): Promise<UnreadCommentsResponse> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/listings/comments/unread`, { headers })
  if (!res.ok) {
    return { count: 0, unread: [] }
  }
  return res.json()
}

/**
 * Agent authenticated endpoint: Mark all comments for a listing as read.
 */
export async function markListingCommentsRead(listingId: string): Promise<void> {
  const headers = await getAuthHeader()
  await fetch(`${API_BASE_URL}/listings/${listingId}/comments/mark-read`, {
    method: 'POST',
    headers,
  }).catch(() => {
    // Non-blocking mark read
  })
}

