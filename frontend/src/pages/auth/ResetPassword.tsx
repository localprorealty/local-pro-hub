import { type FormEvent, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'
import { GridBackground } from '@/components/layout/GridBackground'
import { SecureAuthNote } from '@/components/auth/SecureAuthNote'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSupabaseClient } from '@/lib/supabase'
import lpMonogram from '@/assets/branding/LP_Gold.png'

const fieldClass =
  'h-11 rounded-sm border-[#cfc4c5] bg-white px-4 text-[var(--color-black)] shadow-none focus-visible:border-[var(--color-gold)] focus-visible:ring-1 focus-visible:ring-[var(--color-gold)]'

function ResetPasswordForm() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    try {
      const { error: updateError } = await getSupabaseClient().auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess(true)
        setTimeout(() => {
          navigate('/dashboard', { replace: true })
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="relative flex h-svh min-h-0 w-full flex-col overflow-hidden bg-[var(--color-white)] md:flex-1">
      <GridBackground variant="light" />
      <div className="relative z-10 shrink-0 border-b border-[#f4f3f2] px-8 py-6 md:hidden">
        <img
          src={lpMonogram}
          alt="LocalPRO"
          className="h-10 w-auto object-contain object-left"
        />
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <motion.div
          className="flex min-h-full flex-col justify-center px-8 py-12 md:px-16 lg:px-20"
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <div className="mx-auto w-full max-w-xl">
            <header className="mb-8 space-y-2 text-left">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-black)]">
                Create New Password
              </h2>
              <p className="text-[13px] text-[var(--color-text-secondary)]">
                Enter your new secure password below
              </p>
            </header>

            {success ? (
              <div className="space-y-4">
                <p className="text-sm text-emerald-600">
                  Password updated successfully! Redirecting you to the dashboard...
                </p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[14px] font-medium text-[#888888]">
                    New Password
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className={fieldClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-[14px] font-medium text-[#888888]">
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className={fieldClass}
                  />
                </div>

                {error ? (
                  <motion.p
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-600"
                  >
                    {error}
                  </motion.p>
                ) : null}

                <SecureAuthNote />

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 h-11 w-full rounded-sm bg-[var(--color-black)] font-semibold text-[var(--color-gold)] hover:bg-[var(--color-gold)] hover:text-[var(--color-black)] disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Updating…
                    </>
                  ) : (
                    'Update password'
                  )}
                </Button>
              </form>
            )}

            <footer className="mt-12 border-t border-[#f4f3f2] pt-8">
              <div className="flex items-start gap-2 text-[#888888]">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <p className="text-[11px] tracking-tight uppercase">
                  For agent use only. Unauthorized access prohibited.
                </p>
              </div>
            </footer>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function ResetPasswordPageContent() {
  return (
    <main className="flex h-svh w-full overflow-hidden">
      <AuthBrandPanel variant="login" />
      <ResetPasswordForm />
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <ErrorBoundary title="Reset Password">
      <ResetPasswordPageContent />
    </ErrorBoundary>
  )
}
