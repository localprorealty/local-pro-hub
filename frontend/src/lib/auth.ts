/**
 * Authentication is handled exclusively by Supabase Auth in the browser.
 *
 * - Email and password are sent over HTTPS (TLS) directly to Supabase — never
 *   to the LocalPRO FastAPI backend and never stored in frontend code.
 * - Passwords are hashed by Supabase; our API never receives or logs them.
 * - In production (Netlify), the app is served over HTTPS end-to-end.
 *
 * Local `http://localhost` dev traffic stays on your machine only.
 */

export const AUTH_PROVIDER = 'supabase' as const

export type PhotographerTier = 'elite' | 'standard' | 'basic'
export type UserRole = 'agent' | 'admin' | 'photographer' | 'marketing'

export type SignUpPayload = {
  email: string
  password: string
  fullName: string
  phone: string
  requestedRole: UserRole
  mlsId?: string
  licenseNumber?: string
  photographerTier: PhotographerTier
}

export type UserProfileStatus = 'pending' | 'active' | 'suspended'

export type UserProfile = {
  id: string
  status: UserProfileStatus
  role: UserRole | null
  can_view_revenue?: boolean | null
}
