import { type FormEvent, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Camera,
  Crown,
  Eye,
  EyeOff,
  Image,
  Loader2,
  Megaphone,
  Shield,
  Users,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'
import { GridBackground } from '@/components/layout/GridBackground'
import { SecureAuthNote } from '@/components/auth/SecureAuthNote'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import type { PhotographerTier, UserRole } from '@/lib/auth'
import { formatUsPhone, isValidMlsId } from '@/lib/format'
import { notifySignupPending } from '@/lib/notify-signup'
import lpMonogram from '@/assets/branding/LP_Gold.png'

const fieldClass =
  'h-11 rounded-sm border-[#cfc4c5] bg-white px-4 text-[var(--color-black)] shadow-none focus-visible:border-[var(--color-gold)] focus-visible:ring-1 focus-visible:ring-[var(--color-gold)]'

const ACCESS_ROLES: {
  value: UserRole
  label: string
  description: string
  icon: typeof Users
}[] = [
  {
    value: 'agent',
    label: 'Agent',
    description: 'Listing pipeline and Mission Control access.',
    icon: Users,
  },
  {
    value: 'marketing',
    label: 'Marketing',
    description: 'Campaigns, creative requests, and listing marketing.',
    icon: Megaphone,
  },
  {
    value: 'photographer',
    label: 'Photographer',
    description: 'Shoot bookings and media delivery for listings.',
    icon: Camera,
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Internal operations — broker approval required.',
    icon: Shield,
  },
]

const TIERS: {
  value: PhotographerTier
  title: string
  description: string
  icon: typeof Camera
  badge?: string
}[] = [
  {
    value: 'basic',
    title: 'Basic',
    description: 'Entry level photography, basic editing.',
    icon: Image,
  },
  {
    value: 'standard',
    title: 'Standard',
    description: 'Professional photography, standard editing.',
    icon: Camera,
  },
  {
    value: 'elite',
    title: 'Elite',
    description: 'Professional photography, premium editing, drone available.',
    icon: Crown,
    badge: 'PRO',
  },
]

function rolePageOneCopy(role: UserRole): { title: string; subtitle: string } {
  switch (role) {
    case 'marketing':
      return {
        title: 'Marketing access',
        subtitle: 'Tell us who you are — your broker will approve your account.',
      }
    case 'photographer':
      return {
        title: 'Photographer access',
        subtitle: 'Join the Local Pro media roster — approval required.',
      }
    case 'admin':
      return {
        title: 'Admin access',
        subtitle: 'Internal staff only — submit for broker review.',
      }
    default:
      return {
        title: 'Agent access',
        subtitle: 'Your broker will approve your account before Mission Control opens.',
      }
  }
}

function SignupWizard() {
  const navigate = useNavigate()
  const { signUp, signOut, isLoading } = useAuth()

  const [requestedRole, setRequestedRole] = useState<UserRole>('agent')
  const [step, setStep] = useState<1 | 2>(1)
  const [error, setError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [mlsId, setMlsId] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [marketingFocus, setMarketingFocus] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [photographerNote, setPhotographerNote] = useState('')
  const [photographerTier, setPhotographerTier] =
    useState<PhotographerTier>('standard')

  const totalSteps = requestedRole === 'agent' ? 2 : 1
  const pageCopy = useMemo(() => rolePageOneCopy(requestedRole), [requestedRole])
  const isAgent = requestedRole === 'agent'

  const validateCommon = (): boolean => {
    if (!fullName.trim()) {
      setError('Enter your full name.')
      return false
    }
    if (!email.trim()) {
      setError('Enter your email address.')
      return false
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return false
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return false
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid US phone number.')
      return false
    }
    return true
  }

  const validateAgentFields = (): boolean => {
    if (!isValidMlsId(mlsId)) {
      setError('MLS ID must be exactly 7 digits.')
      return false
    }
    if (!licenseNumber.trim()) {
      setError('Enter your license number.')
      return false
    }
    return true
  }

  const buildLicenseValue = (): string => {
    if (requestedRole === 'marketing') return marketingFocus.trim()
    if (requestedRole === 'admin') return adminNote.trim()
    if (requestedRole === 'photographer') return photographerNote.trim()
    return licenseNumber.trim()
  }

  const submitSignup = async () => {
    setError(null)

    const { data: user, error: signUpError } = await signUp({
      email,
      password,
      fullName,
      phone,
      requestedRole,
      mlsId: isAgent ? mlsId : undefined,
      licenseNumber: buildLicenseValue() || undefined,
      photographerTier: isAgent ? photographerTier : 'standard',
    })

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (!user) {
      setError('Unable to create account. Please try again.')
      return
    }

    void notifySignupPending({
      id: user.id,
      email: email.trim(),
      full_name: fullName.trim(),
      phone,
      role: requestedRole,
      mls_id: isAgent ? mlsId : '',
      brokermint_id: buildLicenseValue(),
      photographer_tier: isAgent ? photographerTier : 'standard',
    })

    await signOut()

    navigate('/signup/pending', {
      replace: true,
      state: { email: email.trim() },
    })
  }

  const handleStepOne = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!validateCommon()) return
    if (isAgent && !validateAgentFields()) return

    if (isAgent) {
      setStep(2)
      return
    }

    void submitSignup()
  }

  const handleAgentStepTwo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submitSignup()
  }

  const handleRoleChange = (role: UserRole) => {
    setRequestedRole(role)
    setStep(1)
    setError(null)
  }

  return (
    <main className="flex h-svh w-full overflow-hidden">
      <AuthBrandPanel step={step} totalSteps={totalSteps} variant="signup" />

      <section className="relative flex h-svh min-h-0 w-full flex-col overflow-hidden bg-[var(--color-white)] md:flex-1">
        <GridBackground variant="light" />
        <div className="relative z-10 shrink-0 border-b border-[#f4f3f2] px-8 py-6 md:hidden">
          <img
            src={lpMonogram}
            alt="LocalPRO"
            className="h-10 w-auto object-contain object-left"
          />
          <p className="mt-2 text-[11px] tracking-widest text-[#888888] uppercase">
            Step {String(step).padStart(2, '0')} of {String(totalSteps).padStart(2, '0')}
          </p>
        </div>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col justify-center px-8 py-12 md:px-16 lg:px-20">
            <div className="relative mx-auto w-full max-w-xl">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  <header className="mb-8 text-left">
                    <h2 className="mb-1 font-[family-name:var(--font-display)] text-[22px] font-semibold text-[var(--color-black)]">
                      Request access
                    </h2>
                    <p className="text-[13px] text-[#4c4546]">
                      Choose your role, then complete the form for that access type.
                    </p>
                  </header>

                  <div className="mb-8">
                    <Label className="mb-3 block text-[14px] text-[#888888]">
                      I am requesting access as
                    </Label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {ACCESS_ROLES.map((role) => {
                        const Icon = role.icon
                        const selected = requestedRole === role.value
                        return (
                          <button
                            key={role.value}
                            type="button"
                            onClick={() => handleRoleChange(role.value)}
                            className={`border p-4 text-left transition-colors ${
                              selected
                                ? 'border-[var(--color-black)] bg-[#faf9f8] shadow-[0_0_0_2px_var(--color-gold)]'
                                : 'border-[#e9e8e7] bg-white hover:border-[#cfc4c5]'
                            }`}
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <Icon
                                className={`size-5 ${selected ? 'text-[var(--color-gold)]' : 'text-[#7e7576]'}`}
                                aria-hidden
                              />
                              <span className="text-sm font-semibold tracking-wide text-[var(--color-black)] uppercase">
                                {role.label}
                              </span>
                            </div>
                            <p className="text-[12px] leading-snug text-[#4c4546]">
                              {role.description}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <header className="mb-6 text-left">
                    <h3 className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--color-black)]">
                      {pageCopy.title}
                    </h3>
                    <p className="mt-1 text-[13px] text-[#4c4546]">{pageCopy.subtitle}</p>
                  </header>

                  <form className="space-y-5" onSubmit={handleStepOne} noValidate>
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName" className="text-[14px] text-[#888888]">
                        Full name
                      </Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className={fieldClass}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-[14px] text-[#888888]">
                        Email address
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={fieldClass}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="password" className="text-[14px] text-[#888888]">
                          Password
                        </Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className={`${fieldClass} pr-11`}
                          />
                          <button
                            type="button"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            aria-pressed={showPassword}
                            onClick={() => setShowPassword((previous) => !previous)}
                            className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-[#888888] transition-colors hover:text-[var(--color-black)]"
                          >
                            {showPassword ? (
                              <EyeOff className="size-4" aria-hidden />
                            ) : (
                              <Eye className="size-4" aria-hidden />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="confirmPassword"
                          className="text-[14px] text-[#888888]"
                        >
                          Confirm password
                        </Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className={`${fieldClass} pr-11`}
                          />
                          <button
                            type="button"
                            aria-label={
                              showConfirmPassword
                                ? 'Hide confirm password'
                                : 'Show confirm password'
                            }
                            aria-pressed={showConfirmPassword}
                            onClick={() =>
                              setShowConfirmPassword((previous) => !previous)
                            }
                            className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-[#888888] transition-colors hover:text-[var(--color-black)]"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="size-4" aria-hidden />
                            ) : (
                              <Eye className="size-4" aria-hidden />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-[14px] text-[#888888]">
                        Phone number (US)
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatUsPhone(e.target.value))}
                        required
                        className={fieldClass}
                      />
                    </div>

                    {isAgent ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="mlsId" className="text-[14px] text-[#888888]">
                            MLS ID
                          </Label>
                          <Input
                            id="mlsId"
                            inputMode="numeric"
                            maxLength={7}
                            value={mlsId}
                            onChange={(e) =>
                              setMlsId(e.target.value.replace(/\D/g, '').slice(0, 7))
                            }
                            required
                            className={fieldClass}
                          />
                          <p className="text-[10px] tracking-wide text-[#888888] uppercase">
                            Must be 7 digits
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="license" className="text-[14px] text-[#888888]">
                            License number
                          </Label>
                          <Input
                            id="license"
                            value={licenseNumber}
                            onChange={(e) => setLicenseNumber(e.target.value)}
                            required
                            className={fieldClass}
                          />
                        </div>
                      </div>
                    ) : null}

                    {requestedRole === 'marketing' ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="marketingFocus" className="text-[14px] text-[#888888]">
                          Team or focus area (optional)
                        </Label>
                        <Input
                          id="marketingFocus"
                          value={marketingFocus}
                          onChange={(e) => setMarketingFocus(e.target.value)}
                          placeholder="e.g. Social, print, events"
                          className={fieldClass}
                        />
                      </div>
                    ) : null}

                    {requestedRole === 'admin' ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="adminNote" className="text-[14px] text-[#888888]">
                          Reason for access (optional)
                        </Label>
                        <Input
                          id="adminNote"
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          placeholder="e.g. Operations, approvals"
                          className={fieldClass}
                        />
                      </div>
                    ) : null}

                    {requestedRole === 'photographer' ? (
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="photographerNote"
                          className="text-[14px] text-[#888888]"
                        >
                          Experience or portfolio note (optional)
                        </Label>
                        <Input
                          id="photographerNote"
                          value={photographerNote}
                          onChange={(e) => setPhotographerNote(e.target.value)}
                          placeholder="Years shooting, portfolio URL, etc."
                          className={fieldClass}
                        />
                      </div>
                    ) : null}

                    {error ? (
                      <p role="alert" className="text-sm text-red-600">
                        {error}
                      </p>
                    ) : null}

                    <SecureAuthNote />

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="mt-2 h-12 w-full rounded-sm bg-[var(--color-gold)] font-semibold tracking-widest text-[var(--color-black)] uppercase hover:bg-[#dcc487] disabled:opacity-60"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          Processing…
                        </>
                      ) : isAgent ? (
                        <>
                          Continue
                          <ArrowRight className="size-4" aria-hidden />
                        </>
                      ) : (
                        'Submit request'
                      )}
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  <header className="mb-10 text-left">
                    <h2 className="mb-2 font-[family-name:var(--font-display)] text-[22px] font-semibold text-[var(--color-black)]">
                      Almost done
                    </h2>
                    <p className="text-[16px] text-[#4c4546]">
                      Choose your default photographer tier for listings
                    </p>
                  </header>

                  <form className="space-y-10" onSubmit={handleAgentStepTwo} noValidate>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {TIERS.map((tier) => {
                        const Icon = tier.icon
                        const selected = photographerTier === tier.value
                        return (
                          <label
                            key={tier.value}
                            className="cursor-pointer text-left"
                          >
                            <input
                              type="radio"
                              name="photographer_tier"
                              value={tier.value}
                              checked={selected}
                              onChange={() => setPhotographerTier(tier.value)}
                              className="sr-only"
                            />
                            <div
                              className={`flex h-full flex-col border p-6 transition-colors ${
                                selected
                                  ? 'border-[var(--color-black)] bg-[#faf9f8] shadow-[0_0_0_2px_var(--color-gold)]'
                                  : 'border-[#e9e8e7] bg-white hover:border-[#cfc4c5]'
                              }`}
                            >
                              <div className="mb-4 flex items-start justify-between">
                                <Icon
                                  className={`size-6 ${selected ? 'text-[var(--color-gold)]' : 'text-[#7e7576]'}`}
                                  aria-hidden
                                />
                                {tier.badge ? (
                                  <span className="bg-[var(--color-gold)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-black)]">
                                    {tier.badge}
                                  </span>
                                ) : null}
                              </div>
                              <h3 className="mb-2 text-sm font-semibold tracking-wide text-[var(--color-black)] uppercase">
                                {tier.title}
                              </h3>
                              <p className="text-[12px] leading-tight text-[#4c4546]">
                                {tier.description}
                              </p>
                            </div>
                          </label>
                        )
                      })}
                    </div>

                    {error ? (
                      <p role="alert" className="text-sm text-red-600">
                        {error}
                      </p>
                    ) : null}

                    <div className="space-y-4">
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="h-12 w-full rounded-sm bg-[var(--color-gold)] font-semibold tracking-widest text-[var(--color-black)] uppercase hover:bg-[#dcc487] disabled:opacity-60"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                            Processing…
                          </>
                        ) : (
                          'Submit request'
                        )}
                      </Button>

                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-sm text-[#4c4546] hover:text-[var(--color-black)]"
                      >
                        ← Back to details
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <footer className="mt-12 text-left">
              <p className="text-[13px] text-[#4c4546]">
                Already have access?{' '}
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 font-bold text-[var(--color-black)] hover:text-[var(--color-gold)]"
                >
                  Sign in
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </p>
            </footer>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default function SignupPage() {
  return (
    <ErrorBoundary title="Sign up">
      <SignupWizard />
    </ErrorBoundary>
  )
}
