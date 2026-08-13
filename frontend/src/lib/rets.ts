import { api } from '@/lib/api'
import { getAccessToken } from '@/lib/supabase'

export type RetsSearchRequest =
  | { query_type: 'mls_number'; mls_number: string }
  | {
      query_type: 'address'
      street_number: string
      street_name: string
      city?: string
    }

export type RetsPropertyMatch = {
  property: Record<string, unknown>
  raw: Record<string, string>
  label: string
}

export type RetsSearchResponse = {
  found: boolean
  property?: Record<string, unknown>
  address?: Record<string, string>
  raw?: Record<string, string>
  multiple?: RetsPropertyMatch[]
  error?: string
}

export function parsePropertySearchQuery(query: string): RetsSearchRequest {
  const trimmed = query.trim()

  const mlsOnly = trimmed.match(/^(?:MLS#?\s*)?(\d{6,9})$/i)
  if (mlsOnly) {
    return { query_type: 'mls_number', mls_number: mlsOnly[1] }
  }

  const parts = trimmed.split(',').map((part) => part.trim())
  const addressPart = parts[0] ?? ''
  const locationPart = parts.slice(1).join(', ').trim()

  const streetMatch = addressPart.match(/^(\d+)\s+(.+)$/)
  let city = ''
  if (locationPart) {
    const locParts = locationPart.split(',').map((p) => p.trim())
    city = locParts[0] || ''
  }

  return {
    query_type: 'address',
    street_number: streetMatch?.[1] ?? '',
    street_name: streetMatch?.[2] ?? addressPart,
    city,
  }
}

export async function searchRetsProperty(
  body: RetsSearchRequest,
): Promise<RetsSearchResponse> {
  return api<RetsSearchResponse>('/rets/search', {
    method: 'POST',
    body,
  })
}

export async function uploadPropertyPdf(
  file: File,
): Promise<RetsSearchResponse> {
  const token = await getAccessToken()
  const formData = new FormData()
  formData.append('file', file)
  
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
    
  const resp = await fetch(`${API_BASE_URL}/rets/upload-pdf`, {
    method: 'POST',
    headers,
    body: formData,
  })
  
  const data = await resp.json()
  if (!resp.ok) {
    const msg = data?.detail ?? 'Failed to parse PDF.'
    throw new Error(msg)
  }
  return data
}

