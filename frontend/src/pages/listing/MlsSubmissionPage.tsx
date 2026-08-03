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
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`size-2.5 rounded-full ${
                  extensionDetected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <div>
                <p className="text-sm font-medium text-white">
                  {extensionDetected
                    ? 'LP Fill extension detected'
                    : 'Extension not installed'}
                </p>
                {extensionDetected ? (
                  <p className="text-xs text-emerald-400/80">V2.4.1 connected</p>
                ) : (
                  <a
                    href="https://chrome.google.com/webstore"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#CFB87C] underline"
                  >
                    Download from Chrome Web Store
                  </a>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open('https://ntreis.net', '_blank', 'noopener,noreferrer')}
              className="shrink-0 rounded-sm border-[var(--color-border)] bg-transparent text-xs text-white hover:bg-[#1a1a1a]"
            >
              Open NTREIS Matrix
              <ExternalLink className="ml-2 size-3.5" />
            </Button>
          </div>
        </div>

        <section className="rounded-md border border-[var(--color-border)] bg-[#1a1a1a] p-6">
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">
            How to submit your listing
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--color-text-secondary)]">
            <li>
              Open{' '}
              <button
                type="button"
                onClick={() => window.open('https://ntreis.net', '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center gap-1 text-[#CFB87C] hover:underline"
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

        <section className="rounded-md border border-[var(--color-border)] bg-[#1a1a1a] p-6">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
            <p className="text-sm text-white">
              <span className="font-semibold text-[#CFB87C]">{completeCount}</span>
              <span className="text-[var(--color-text-secondary)]"> / {totalCount} sections complete</span>
            </p>
            <span className="text-sm font-semibold text-[#CFB87C]">{progressPct}%</span>
          </div>

          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
            {sectionRows.map((row) => {
              const synced = row.status === 'complete'
              return (
                <li
                  key={row.name}
                  className="flex items-center justify-between gap-3 rounded-sm border border-[var(--color-border)]/60 bg-[#0a0a0a]/50 px-4 py-2.5"
                >
                  <div className="flex items-center gap-2 text-sm text-white">
                    {synced ? (
                      <Check className="size-4 text-emerald-400" aria-hidden />
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

        <section className="rounded-md border border-[var(--color-border)] bg-[#1a1a1a] p-6">
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
              className="mt-1 accent-[#CFB87C]"
            />
            <span className="text-sm text-white">
              I have reviewed and submitted this listing on NTREIS
            </span>
          </label>

          <Button
            type="button"
            disabled={!confirmedSubmitted || isAdvancing}
            onClick={() => void handleContinue()}
            className="mt-6 h-12 w-full rounded-sm bg-[#CFB87C] text-sm font-bold tracking-wide text-[#0a0a0a] uppercase hover:bg-[#dcc487] disabled:opacity-50"
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
            <p className="mt-4 text-sm text-red-300" role="alert">
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
