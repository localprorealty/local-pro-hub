import { getAccessToken } from '@/lib/supabase'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  body?: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  /** Explicit bearer token; skips session lookup when set */
  token?: string | null
  /** Set true for public endpoints (health, webhooks) */
  skipAuth?: boolean
}

async function resolveAuthHeaders(
  options: RequestOptions,
): Promise<Record<string, string>> {
  if (options.skipAuth) return {}

  const token =
    options.token !== undefined ? options.token : await getAccessToken()

  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options
  const authHeaders = await resolveAuthHeaders(options)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data: unknown = await response.json().catch(() => undefined)

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'detail' in data &&
      typeof (data as { detail: unknown }).detail === 'string'
        ? (data as { detail: string }).detail
        : `Request failed (${response.status})`
    throw new ApiError(message, response.status, data)
  }

  return data as T
}
