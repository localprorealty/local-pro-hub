import { api, ApiError } from '@/lib/api'
import { getAccessToken } from '@/lib/supabase'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export type ExtractResult = {
  value: unknown
  confident: boolean
  clarification_needed: string | null
}

export type ExtractPayload = {
  transcription: string
  field_key: string
  field_type: string
  field_label: string
  options?: string[]
  current_value?: unknown
}

export async function transcribeAudio(blob: Blob): Promise<{ text: string }> {
  const formData = new FormData()
  formData.append('audio', blob, 'audio.webm')

  const token = await getAccessToken()
  const response = await fetch(`${API_BASE_URL}/voice/transcribe`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  const data: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'detail' in data &&
      typeof (data as { detail: unknown }).detail === 'string'
        ? (data as { detail: string }).detail
        : `Transcription failed (${response.status})`
    throw new ApiError(message, response.status, data)
  }

  return data as { text: string }
}

export async function extractFieldValue(payload: ExtractPayload): Promise<ExtractResult> {
  return api<ExtractResult>('/voice/extract', {
    method: 'POST',
    body: payload,
  })
}
