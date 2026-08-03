import { type FormEvent, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'
import { GridBackground } from '@/components/layout/GridBackground'
import { SecureAuthNote } from '@/components/auth/SecureAuthNote'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import lpMonogram from '@/assets/branding/LP_Gold.png'

const fieldClass =
  'h-11 rounded-sm border-[#cfc4c5] bg-white px-4 text-[var(--color-black)] shadow-none focus-visible:border-[var(--color-gold)] focus-visible:ring-1 focus-visible:ring-[var(--color-gold)]'

function LoginForm() {
  const navigate = useNavigate()
  const { signInWithPassword, signOut, getProfile, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }

    const { data: session, error: authError } = await signInWithPassword(
      email,
      password,
    )

    if (authError) {
      setError(authError.message)
      return
    }

    if (!session?.user) {
      setError('Sign in failed. Please try again.')
      return
    }

    const profile = await getProfile(session.user.id)

    if (!profile) {
      await signOut()
      setError('Unable to load your account profile. Contact admin.')
      return
    }

    if (profile.status === 'pending') {
      await signOut()
      navigate('/signup/pending', {
        replace: true,
        state: { email: email.trim() },
      })
      return
    }

    if (profile.status === 'suspended') {
      await signOut()
      setError('Your account has been suspended. Contact your broker.')
      return
    }

    if (profile.role === 'admin') {
      navigate('/admin/pipeline', { replace: true })
      return
    }

    navigate('/dashboard', { replace: true })
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
              Welcome back
            </h2>
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              Sign in with your credentials
            </p>
          </header>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[14px] font-medium text-[#888888]">
                Email address
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@localpro.com"
                disabled={isLoading}
                className={fieldClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[14px] font-medium text-[#888888]">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className={`${fieldClass} pr-11`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((previous) => !previous)}
                  disabled={isLoading}
                  className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-[#888888] transition-colors hover:text-[var(--color-black)] disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
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
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <div className="mt-8 text-left">
            <Link
              to="/signup"
              className="group inline-flex items-center gap-1 text-[14px] text-[var(--color-black)] transition-colors hover:text-[var(--color-gold)]"
            >
              New to LP Hub?{' '}
              <span className="font-semibold">
                Request access
                <ArrowRight className="ml-0.5 inline size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>

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

function LoginPageContent() {
  return (
    <main className="flex h-svh w-full overflow-hidden">
      <AuthBrandPanel variant="login" />
      <LoginForm />
    </main>
  )
}

export default function LoginPage() {
  return (
    <ErrorBoundary title="Login">
      <LoginPageContent />
    </ErrorBoundary>
  )
}
