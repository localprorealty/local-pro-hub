import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, Loader2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ListingMissionLayout } from '@/components/listing/ListingMissionLayout'
import {
  SubmissionPortalSidebar,
  SyncedBadge,
} from '@/components/listing/SubmissionPortalSidebar'
import { Button } from '@/components/ui/button'
import {
  advanceListingStage,
  getGoLivePath,
  getListing,
  type Listing,
} from '@/lib/listings'
import {
  getSectionStatus,
  getVisibleSections,
  type FormData,
} from '@/lib/ntreis-sections'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchUserProfile } from '@/lib/users'
import { CHROME_WEBSTORE_URL } from '@/lib/constants'

function MlsSubmissionContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [listing, setListing] = useState<Listing | null>(null)
  const [confirmedSubmitted, setConfirmedSubmitted] = useState(false)
  const [extensionDetected] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [agentEmail, setAgentEmail] = useState<string | undefined>()
  const [copiedListingId, setCopiedListingId] = useState(false)

  const handleCopyListingId = async () => {
    if (!id) return
    await navigator.clipboard.writeText(id)
    setCopiedListingId(true)
    window.setTimeout(() => setCopiedListingId(false), 2000)
  }

  const loadPage = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession()
      const userId = session?.user?.id
      const [listingRow, profile] = await Promise.all([
        getListing(id),
        userId ? fetchUserProfile(userId) : Promise.resolve(null),
      ])
      if (!listingRow) throw new Error('Listing not found')
      if (listingRow.stage !== 'marketing') {
        navigate(`/listing/${id}`, { replace: true })
        return
      }
      setListing(listingRow)
      if (profile?.email) setAgentEmail(profile.email)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load listing.')
    } finally {
      setIsLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  const formData = useMemo(
    () => (listing?.form_data ?? {}) as FormData,
    [listing?.form_data],
  )

  const sectionRows = useMemo(() => {
    return getVisibleSections(formData).map((section) => ({
      name: section.name,
      status: getSectionStatus(section, formData),
    }))
  }, [formData])

  const completeCount = sectionRows.filter((row) => row.status === 'complete').length
  const totalCount = sectionRows.length
  const allComplete = totalCount > 0 && completeCount === totalCount
  const progressPct = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0

  const handleContinue = async () => {
    if (!id || !confirmedSubmitted) return
    setIsAdvancing(true)
    setActionError(null)
    try {
      const next = await advanceListingStage(id, 'marketing')
      if (!next) throw new Error('Could not update listing stage.')
      navigate(getGoLivePath(id))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not continue.')
      setIsAdvancing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-text-secondary)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading...
      </div>
    )
  }

  if (loadError || !listing || !id) {
    return (
      <div className="rounded-sm border border-red-500/30 bg-red-500/5 p-6 text-red-300">
        {loadError ?? 'Listing not found'}
      </div>
    )
  }

  return (
    <ListingMissionLayout
      listingId={id}
      title="Finalize Submission"
      subtitle="Synchronize your local property data with the NTREIS ecosystem."
      email={agentEmail}
      sidebar={
        <SubmissionPortalSidebar
          listingId={id}
          activeStep="mls"
          mlsRef={listing.mls_number}
        />
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <div
          className={`rounded-md border px-5 py-4 ${
            extensionDetected
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-amber-500/30 bg-amber-500/10'
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`size-2.5 rounded-full shrink-0 ${
                  extensionDetected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  {extensionDetected
                    ? 'LP Fill extension detected'
                    : 'Extension not installed'}
                </p>
                {extensionDetected ? (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">V2.4.1 connected</p>
                ) : (
                  <a
                    href={CHROME_WEBSTORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--color-gold)] underline hover:text-[var(--color-gold)]/80"
                  >
                    Get it from the Chrome Web Store
                  </a>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open('https://ntrdd.mlsmatrix.com/Matrix/Input', '_blank', 'noopener,noreferrer')}
              className="w-full sm:w-auto shrink-0 justify-center rounded-sm border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-3)]"
            >
              Open NTREIS Matrix
              <ExternalLink className="ml-2 size-3.5" />
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3 shadow-sm">
          <h5 className="text-xs tracking-wider text-[var(--color-text)] uppercase font-semibold">LocalPRO Listing Credentials</h5>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Copy your LocalPRO Listing ID to load it inside the Chrome Extension helper.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleCopyListingId()}
              className="inline-flex items-center justify-center h-10 px-5 rounded-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-gold)] hover:bg-[var(--color-surface-3)] transition-colors"
            >
              {copiedListingId ? 'Copied!' : 'Copy Listing ID'}
            </button>
            <span className="text-xs text-[var(--color-text-secondary)]">
              (ID: <strong className="text-[var(--color-text)] font-mono break-all">{id}</strong>)
            </span>
          </div>
        </div>

        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--color-text)] uppercase">
            How to submit your listing
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--color-text-secondary)]">
            <li>
              Open{' '}
              <button
                type="button"
                onClick={() => window.open('https://ntrdd.mlsmatrix.com/Matrix/Input', '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center gap-1 text-[var(--color-gold)] hover:underline"
              >
                NTREIS Matrix
                <ExternalLink className="size-3" />
              </button>{' '}
              in a new tab.
            </li>
            <li>Use LP Fill to sync each section from your LocalPRO form.</li>
            <li>Submit the listing in NTREIS when all sections show synced.</li>
          </ol>
        </section>

        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
            <p className="text-sm text-[var(--color-text)]">
              <span className="font-semibold text-[var(--color-gold)]">{completeCount}</span>
              <span className="text-[var(--color-text-secondary)]"> / {totalCount} sections complete</span>
            </p>
            <span className="text-sm font-semibold text-[var(--color-gold)]">{progressPct}%</span>
          </div>

          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
            {sectionRows.map((row) => {
              const synced = row.status === 'complete'
              return (
                <li
                  key={row.name}
                  className="flex items-center justify-between gap-3 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5"
                >
                  <div className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                    {synced ? (
                      <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    ) : (
                      <span className="size-4 rounded-full border border-[var(--color-border)]" />
                    )}
                    {row.name}
                  </div>
                  {synced ? <SyncedBadge /> : null}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {allComplete
              ? 'All sections complete. Submit in NTREIS when ready.'
              : 'Complete remaining form sections before submitting in NTREIS.'}
          </p>

          <label className="mt-5 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={confirmedSubmitted}
              onChange={(event) => setConfirmedSubmitted(event.target.checked)}
              className="mt-1 accent-[var(--color-gold)]"
            />
            <span className="text-sm text-[var(--color-text)]">
              I have reviewed and submitted this listing on NTREIS
            </span>
          </label>

          <Button
            type="button"
            disabled={!confirmedSubmitted || isAdvancing}
            onClick={() => void handleContinue()}
            className="mt-6 h-12 w-full rounded-sm bg-[var(--color-gold)] text-sm font-bold tracking-wide text-black uppercase hover:bg-[var(--color-gold)]/90 disabled:opacity-50"
          >
            {isAdvancing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Continuing...
              </>
            ) : (
              'Continue to go live →'
            )}
          </Button>

          {actionError ? (
            <p className="mt-4 text-sm text-red-600 dark:text-red-300" role="alert">
              {actionError}
            </p>
          ) : null}
        </section>
      </div>
    </ListingMissionLayout>
  )
}

export default function MlsSubmissionPage() {
  return (
    <ErrorBoundary title="MLS Submission">
      <MlsSubmissionContent />
    </ErrorBoundary>
  )
}
