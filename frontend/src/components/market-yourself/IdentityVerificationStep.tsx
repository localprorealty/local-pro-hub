import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  getAvatarConsentStatus,
  isConsentApproved,
  startAvatarConsent,
} from '@/lib/marketing-video'

const POLL_INTERVAL_MS = 5_000

type IdentityVerificationStepProps = {
  consentStatus: string | null
  onVerified: () => void
  autoStart?: boolean
}

function isAlreadyConsentedError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('already been provided') || lower.includes('already provided')
}

export function IdentityVerificationStep({
  consentStatus,
  onVerified,
  autoStart = true,
}: IdentityVerificationStepProps) {
  const [isStarting, setIsStarting] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(consentStatus)
  const [error, setError] = useState<string | null>(null)
  const [consentStarted, setConsentStarted] = useState(false)
  const [isApproved, setIsApproved] = useState(() => isConsentApproved(consentStatus))
  const autoStartRef = useRef(false)
  const advancedRef = useRef(false)
  const pollTimerRef = useRef<number | null>(null)

  const markApproved = useCallback(() => {
    setIsApproved(true)
    setError(null)
  }, [])

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setIsPolling(false)
  }, [])

  const checkConsent = useCallback(async (): Promise<boolean> => {
    try {
      const result = await getAvatarConsentStatus()
      setCurrentStatus(result.consent_status)
      if (!result.consent_required || isConsentApproved(result.consent_status)) {
        markApproved()
        stopPolling()
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check verification status.')
      return false
    }
  }, [markApproved, stopPolling])

  const startPolling = useCallback(() => {
    stopPolling()
    setIsPolling(true)
    void checkConsent()
    pollTimerRef.current = window.setInterval(() => {
      void checkConsent()
    }, POLL_INTERVAL_MS)
  }, [checkConsent, stopPolling])

  const handleStartConsent = useCallback(async () => {
    setIsStarting(true)
    setError(null)
    try {
      const result = await startAvatarConsent()
      setCurrentStatus(result.consent_status)
      if (!result.consent_required || isConsentApproved(result.consent_status)) {
        markApproved()
        return
      }
      if (!result.consent_url) {
        throw new Error('HeyGen did not return a verification link.')
      }
      setConsentStarted(true)
      startPolling()
      window.location.href = result.consent_url
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start verification.'
      if (isAlreadyConsentedError(message)) {
        const approved = await checkConsent()
        if (approved) return
        markApproved()
        return
      }
      setError(message)
    } finally {
      setIsStarting(false)
    }
  }, [checkConsent, markApproved, startPolling])

  useEffect(() => {
    if (!autoStart || autoStartRef.current) return
    autoStartRef.current = true
    void (async () => {
      const approved = await checkConsent()
      if (!approved) {
        void handleStartConsent()
      }
    })()
  }, [autoStart, checkConsent, handleStartConsent])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('consent') === 'done') {
      startPolling()
    }
    return () => stopPolling()
  }, [startPolling, stopPolling])

  useEffect(() => {
    if (!isApproved || advancedRef.current) return
    advancedRef.current = true
    onVerified()
  }, [isApproved, onVerified])

  if (isApproved) {
    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-sm border border-[#2a2a2a] bg-[#1a1a1a] p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-[#CFB87C]" aria-hidden />
        <div>
          <h2 className="text-xl font-semibold text-white">Identity verified</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Taking you to video options…
          </p>
        </div>
        <Loader2 className="mx-auto size-5 animate-spin text-[#CFB87C]" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-sm border border-[#2a2a2a] bg-[#1a1a1a] p-8">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-6 shrink-0 text-[#CFB87C]" aria-hidden />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Verify your identity</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Your 30-second training video is saved — this step is <strong className="text-white">not</strong>{' '}
              creating another avatar and costs <strong className="text-white">$0</strong>. HeyGen will ask you to
              read a short phrase on camera to confirm it&apos;s really you.
            </p>
            {currentStatus ? (
              <p className="mt-2 text-xs text-amber-200/90">
                Status: <span className="font-medium">{currentStatus}</span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void handleStartConsent()}
              disabled={isStarting || isPolling}
              className="bg-[#CFB87C] text-[#0a0a0a] hover:bg-[#dcc487]"
            >
              {isStarting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Checking verification...
                </>
              ) : consentStarted ? (
                'Open verification again'
              ) : (
                'Start identity verification'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void checkConsent()}
              disabled={isStarting || isPolling}
              className="border-[#333] text-white hover:bg-[#111]"
            >
              I already completed this
            </Button>
            {isPolling ? (
              <span className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <Loader2 className="size-3.5 animate-spin" />
                Waiting for approval...
              </span>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
