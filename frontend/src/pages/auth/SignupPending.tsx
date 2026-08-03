import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useAuth } from '@/hooks/useAuth'

type PendingLocationState = {
  email?: string
}

function SignupPendingContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useAuth()
  const state = location.state as PendingLocationState | null
  const email = state?.email ?? 'your email on file'

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden px-8 py-16">
      <div className="pointer-events-none absolute -top-[20%] -right-[10%] h-[60%] w-[60%] rounded-full bg-[var(--color-gold)]/5 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-[20%] -left-[10%] h-[40%] w-[40%] rounded-full bg-[var(--color-gold)]/5 blur-[100px]" />

      <motion.div
        className="relative z-10 flex w-full max-w-lg flex-col justify-center text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mb-12 inline-flex items-center justify-center">
          <div className="relative flex size-24 items-center justify-center border border-[var(--color-gold)]/40">
            <div className="absolute inset-0 scale-125 rounded-full border border-[var(--color-gold)]/20" />
            <span className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tighter text-[var(--color-gold)]">
              LP
            </span>
          </div>
        </div>

        <h1 className="mb-6 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-white)] md:text-[28px]">
          Application received.
        </h1>

        <p className="mb-6 max-w-sm self-center text-[var(--color-text-secondary)]">
          Your broker will review and approve your access. You&apos;ll receive an
          email at{' '}
          <span className="font-medium text-[var(--color-white)]">{email}</span>{' '}
          when approved.
        </p>

        <div className="mb-4 flex w-full items-center justify-center gap-2 border border-[var(--color-gold)]/20 bg-[var(--color-surface-3)] px-4 py-2">
          <Clock className="size-4 text-[var(--color-gold)]" aria-hidden />
          <span className="text-[11px] tracking-[0.2em] text-[var(--color-gold)] uppercase">
            Pending review
          </span>
        </div>

        <button
          type="button"
          onClick={async () => {
            await signOut()
            navigate('/login', { replace: true })
          }}
          className="mt-2 self-center text-sm font-semibold text-[var(--color-gold)] transition-colors hover:text-[var(--color-white)]"
        >
          Return to sign in
        </button>
      </motion.div>
    </main>
  )
}

export default function SignupPendingPage() {
  return (
    <ErrorBoundary title="Application status">
      <SignupPendingContent />
    </ErrorBoundary>
  )
}
