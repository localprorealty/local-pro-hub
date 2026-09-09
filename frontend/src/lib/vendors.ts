import { API_BASE_URL } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase'

export type AgentVendor = {
  id: string
  agent_id: string
  vendor_type: string
  name: string
  website_url: string | null
  email: string | null
  phone: string | null
  notes: string | null
  is_default: boolean
  created_at?: string
  updated_at?: string
}

export type GmailCredentialsStatus = {
  is_configured: boolean
  gmail_email: string | null
  updated_at?: string
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const session = await getSupabaseClient().auth.getSession()
  const token = session.data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchAgentVendors(): Promise<AgentVendor[]> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/vendors`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || `Failed to fetch vendors (${res.status})`)
  }
  const data = await res.json()
  return data.vendors || []
}

export async function createAgentVendor(vendor: {
  name: string
  website_url?: string | null
  email?: string | null
  phone?: string | null
  notes?: string | null
  is_default?: boolean
}): Promise<AgentVendor> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/vendors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(vendor),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || `Failed to create vendor (${res.status})`)
  }
  const data = await res.json()
  return data.vendor
}

export async function updateAgentVendor(
  vendorId: string,
  vendor: {
    name?: string
    website_url?: string | null
    email?: string | null
    phone?: string | null
    notes?: string | null
    is_default?: boolean
  },
): Promise<AgentVendor> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/vendors/${vendorId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(vendor),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || `Failed to update vendor (${res.status})`)
  }
  const data = await res.json()
  return data.vendor
}

export async function deleteAgentVendor(vendorId: string): Promise<void> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/vendors/${vendorId}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || `Failed to delete vendor (${res.status})`)
  }
}

export async function fetchGmailCredentialsStatus(): Promise<GmailCredentialsStatus> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/users/me/gmail-credentials`, { headers })
  if (!res.ok) {
    return { is_configured: false, gmail_email: null }
  }
  return res.json()
}

export async function saveGmailCredentials(
  gmail_email: string,
  app_password: string,
): Promise<{ success: boolean; is_configured: boolean; gmail_email: string }> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/users/me/gmail-credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ gmail_email, app_password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || `Failed to connect Gmail (${res.status})`)
  }
  return res.json()
}

export async function deleteGmailCredentials(): Promise<void> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/users/me/gmail-credentials`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || `Failed to disconnect Gmail (${res.status})`)
  }
}

export async function sendVendorOrderEmail(
  listingId: string,
  payload: {
    vendor_id?: string | null
    to_email: string
    subject: string
    body_text: string
    mark_completed?: boolean
  },
): Promise<{ success: boolean; method: 'gmail_smtp' | 'resend'; to_email: string; stage_updated: boolean }> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/listings/${listingId}/vendor-order-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || `Failed to send order email (${res.status})`)
  }
  return res.json()
}

export async function completeVendorOrder(
  listingId: string,
  vendorId?: string | null,
): Promise<{ success: boolean; stage: string }> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE_URL}/listings/${listingId}/vendor-order-complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ vendor_id: vendorId ?? null }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || `Failed to complete vendor order (${res.status})`)
  }
  return res.json()
}

