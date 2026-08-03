import { api } from '@/lib/api'

type SignupNotifyRecord = {
  id: string
  email: string
  full_name: string
  phone: string
  role: string
  mls_id: string
  brokermint_id: string
  photographer_tier: string
}

/**
 * Notify n8n via FastAPI proxy (avoids browser CORS to ngrok/n8n).
 * Configure N8N_SIGNUP_WEBHOOK_URL in backend/.env and run the API on :8000.
 */
export async function notifySignupPending(record: SignupNotifyRecord): Promise<void> {
  try {
    await api<{ ok: boolean; skipped?: boolean }>('/internal/notify-signup-pending', {
      method: 'POST',
      body: { record },
      skipAuth: true,
    })
  } catch {
    // Non-blocking — signup still succeeds if API or n8n is down
  }
}
