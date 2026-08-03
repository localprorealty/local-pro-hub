import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

function readSupabaseEnv(): { url: string; anonKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env',
    )
  }

  return { url, anonKey }
}

/** Singleton Supabase browser client — use this for all auth/DB access in the app. */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  const { url, anonKey } = readSupabaseEnv()
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}

export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await getSupabaseClient().auth.getSession()
  if (error) return null
  return data.session?.access_token ?? null
}
