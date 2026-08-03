import { Shield } from 'lucide-react'

export function SecureAuthNote() {
  return (
    <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#888888]">
      <Shield className="mt-0.5 size-3.5 shrink-0 text-[var(--color-gold)]" aria-hidden />
      <span>
        Credentials are sent over encrypted HTTPS directly to Supabase Auth. Your
        password never touches the LocalPRO API.
      </span>
    </p>
  )
}
