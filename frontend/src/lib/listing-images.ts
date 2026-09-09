import { API_BASE_URL } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase'

export type ListingImage = {
  id: string
  listing_id: string
  storage_path: string
  public_url: string
  image_type: 'gallery' | 'headshot' | 'floorplan'
  category: string
  caption: string | null
  is_hero: boolean
  sort_order: number
  file_size_bytes?: number | null
  width?: number | null
  height?: number | null
  mime_type?: string
  uploaded_by?: string | null
  created_at?: string
  updated_at?: string
}

export type ListingImageUpdatePayload = {
  caption?: string | null
  category?: string
  image_type?: 'gallery' | 'headshot' | 'floorplan'
  is_hero?: boolean
  sort_order?: number
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const session = await getSupabaseClient().auth.getSession()
  const token = session.data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Fetch all image library photos for a specific listing.
 */
export async function fetchListingImages(listingId: string): Promise<ListingImage[]> {
  const authHeader = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/listings/${listingId}/images`, {
    headers: {
      ...authHeader,
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to load listing images (${res.status})`)
  }

  const data = await res.json()
  return data.images || []
}

/**
 * Upload an image (already compressed client-side) to the listing's library.
 */
export async function uploadListingImage(
  listingId: string,
  file: File,
  metadata: {
    category?: string
    caption?: string
    is_hero?: boolean
    image_type?: 'gallery' | 'headshot' | 'floorplan'
  } = {},
): Promise<ListingImage> {
  const authHeader = await getAuthHeader()
  const formData = new FormData()
  formData.append('file', file)
  if (metadata.category) formData.append('category', metadata.category)
  if (metadata.caption) formData.append('caption', metadata.caption)
  if (metadata.is_hero !== undefined) formData.append('is_hero', String(metadata.is_hero))
  if (metadata.image_type) formData.append('image_type', metadata.image_type)

  const res = await fetch(`${API_BASE_URL}/listings/${listingId}/images`, {
    method: 'POST',
    headers: {
      ...authHeader,
    },
    body: formData,
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => null)
    throw new Error(errBody?.detail || `Upload failed (${res.status})`)
  }

  const data = await res.json()
  return data.image
}

/**
 * Update image metadata (caption, category, is_hero, sort order).
 */
export async function updateListingImage(
  listingId: string,
  imageId: string,
  payload: ListingImageUpdatePayload,
): Promise<ListingImage> {
  const authHeader = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/listings/${listingId}/images/${imageId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => null)
    throw new Error(errBody?.detail || `Update failed (${res.status})`)
  }

  const data = await res.json()
  return data.image
}

/**
 * Delete an image from the listing library and Supabase storage.
 */
export async function deleteListingImage(listingId: string, imageId: string): Promise<void> {
  const authHeader = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/listings/${listingId}/images/${imageId}`, {
    method: 'DELETE',
    headers: {
      ...authHeader,
    },
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => null)
    throw new Error(errBody?.detail || `Delete failed (${res.status})`)
  }
}
