import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Loader2, RefreshCw } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ListingMissionLayout } from '@/components/listing/ListingMissionLayout'
import { PipelineDotNav } from '@/components/listing/SubmissionPortalSidebar'
import { Button } from '@/components/ui/button'
import {
  generateListingDescription,
  getListing,
  markListingLive,
  saveListingDescription,
  type Listing,
} from '@/lib/listings'
import { fetchUserProfile } from '@/lib/users'
import { getSupabaseClient } from '@/lib/supabase'

const DESCRIPTION_LIMIT = 1000

const MILESTONES = [
  'Docs signed',
  'Photos taken',
  'Marketing requested',
  'MLS submitted',
] as const

function initialDescription(listing: Listing): string {
  const fromForm = listing.form_data?.property_description
  if (typeof fromForm === 'string' && fromForm.trim()) return fromForm.trim()
  if (listing.description_generated?.trim()) return listing.description_generated.trim()
  return ''
}

function defaultGoLiveDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function GoLiveContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [listing, setListing] = useState<Listing | null>(null)
  const [description, setDescription] = useState('')
  const [goLiveDate, setGoLiveDate] = useState(defaultGoLiveDate)
  const [skipOwnDescription, setSkipOwnDescription] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGoingLive, setIsGoingLive] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [agentEmail, setAgentEmail] = useState<string | undefined>()
  const [hasGenerated, setHasGenerated] = useState(false)
  const [copiedListingId, setCopiedListingId] = useState(false)

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
      if (listingRow.stage !== 'mls_submitted') {
        navigate(`/listing/${id}`, { replace: true })
        return
      }
      setListing(listingRow)
      setDescription(initialDescription(listingRow))
      if (listingRow.go_live_date) setGoLiveDate(listingRow.go_live_date)
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

  const charCount = description.length
  const hadInitialDescription = Boolean(listing && initialDescription(listing))
  const canGoLive = hasGenerated || skipOwnDescription || hadInitialDescription

  const handleGenerate = async () => {
    if (!id) return
    setIsGenerating(true)
    setActionError(null)
    try {
      const result = await generateListingDescription(id)
      setDescription(result.description.slice(0, DESCRIPTION_LIMIT))
      setHasGenerated(true)
      setSkipOwnDescription(false)
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Description generation failed.',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!description.trim()) return
    await navigator.clipboard.writeText(description)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyListingId = async () => {
    if (!id) return
    await navigator.clipboard.writeText(id)
    setCopiedListingId(true)
    window.setTimeout(() => setCopiedListingId(false), 2000)
  }

  const handleGoLive = async () => {
    if (!id || !canGoLive) return
    const trimmed = description.trim()
    if (!skipOwnDescription && !trimmed) {
      setActionError('Add a description or click Skip — use my own.')
      return
    }

    setIsGoingLive(true)
    setActionError(null)
    try {
      const saved = await saveListingDescription(id, trimmed)
      if (!saved) throw new Error('Could not save description.')

      const ok = await markListingLive(id, goLiveDate)
      if (!ok) throw new Error('Could not mark listing live.')

      navigate(`/dashboard?live=${id}`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Go live failed.')
      setIsGoingLive(false)
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
      title="Go Live"
      subtitle={listing.address_full ?? 'Unnamed listing'}
      email={agentEmail}
    >
      <div className="mx-auto grid max-w-2xl gap-8 lg:grid-cols-[auto_1fr]">
        <PipelineDotNav activeIndex={2} />

        <div className="space-y-8">
          <div>
            <div className="mb-2 flex items-center justify-between text-[10px] tracking-[0.2em] text-[var(--color-text-secondary)] uppercase">
              <span>Step 11 of 11</span>
              <span>100% complete</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[#2a2a2a]">
              <div className="h-full w-full rounded-full bg-[#CFB87C]" />
            </div>
          </div>

          <div className="rounded-md border border-emerald-500/30 bg-emerald-600 px-6 py-4 text-center">
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
              Ready to go live
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {MILESTONES.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300"
              >
                <Check className="size-3.5" aria-hidden />
                {label}
              </span>
            ))}
          </div>

          {listing.brokermint_transaction_id ? (
            <div className="rounded-md border border-[var(--color-border)] bg-[#1a1a1a] p-5 space-y-3">
              <h5 className="text-xs tracking-wider text-white uppercase font-semibold">Linked BrokerMint Transaction</h5>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Access transaction checklists, documents, and participant roles.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`https://my.brokermint.com/#/transactions/${listing.brokermint_transaction_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-10 px-5 rounded-sm bg-[#111111] border border-[#2a2a2a] text-xs font-semibold text-[#CFB87C] hover:bg-[#2a2a2a] transition-colors"
                >
                  Open BrokerMint Transaction ↗
                </a>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  (ID: <strong className="text-white font-mono">{listing.brokermint_transaction_id}</strong>)
                </span>
              </div>
            </div>
          ) : null}

          <div className="rounded-md border border-[var(--color-border)] bg-[#1a1a1a] p-5 space-y-3">
            <h5 className="text-xs tracking-wider text-white uppercase font-semibold">LocalPRO Listing Credentials</h5>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Copy your LocalPRO Listing ID to load it inside the Chrome Extension helper.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleCopyListingId()}
                className="inline-flex items-center justify-center h-10 px-5 rounded-sm bg-[#111111] border border-[#2a2a2a] text-xs font-semibold text-[#CFB87C] hover:bg-[#2a2a2a] transition-colors"
              >
                {copiedListingId ? 'Copied!' : 'Copy Listing ID'}
              </button>
              <span className="text-xs text-[var(--color-text-secondary)]">
                (ID: <strong className="text-white font-mono">{id}</strong>)
              </span>
            </div>
          </div>

          <section className="rounded-md border border-[var(--color-border)] bg-[#1a1a1a] p-5">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-[var(--color-text-secondary)] uppercase">
                Listing description
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => void handleGenerate()}
                  className="inline-flex items-center gap-1.5 text-xs text-[#CFB87C] hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-white"
                >
                  <Copy className="size-3.5" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <textarea
              value={description}
              onChange={(event) => {
                setDescription(event.target.value.slice(0, DESCRIPTION_LIMIT))
                setSkipOwnDescription(false)
              }}
              placeholder="Generate or paste your MLS-ready property description."
              className="mt-4 min-h-44 w-full resize-y rounded-sm border-0 bg-transparent text-sm leading-relaxed text-white focus:outline-none"
            />
            <p className="mt-2 text-right text-xs text-[var(--color-text-secondary)]">
              {charCount} / {DESCRIPTION_LIMIT}
            </p>

            {!canGoLive ? (
              <button
                type="button"
                onClick={() => {
                  setSkipOwnDescription(true)
                  if (!description.trim()) {
                    setDescription(
                      typeof listing.form_data?.property_description === 'string'
                        ? listing.form_data.property_description
                        : listing.description_generated ?? 'Listing now live on MLS.',
                    )
                  }
                }}
                className="mt-2 text-xs text-[var(--color-text-secondary)] underline hover:text-[#CFB87C]"
              >
                Skip — use my own description
              </button>
            ) : null}
          </section>

          <div className="text-center">
            <label
              htmlFor="go-live-date"
              className="text-[10px] font-semibold tracking-[0.2em] text-[var(--color-text-secondary)] uppercase"
            >
              When should this go live?
            </label>
            <input
              id="go-live-date"
              type="date"
              value={goLiveDate}
              onChange={(event) => setGoLiveDate(event.target.value)}
              className="mt-3 block w-full rounded-md border border-[var(--color-border)] bg-[#1a1a1a] px-4 py-3 text-center text-white focus:outline focus:outline-2 focus:outline-[#CFB87C]"
            />
          </div>

          <Button
            type="button"
            disabled={!canGoLive || isGoingLive}
            onClick={() => void handleGoLive()}
            className="h-14 w-full rounded-sm bg-[#CFB87C] text-base font-bold tracking-wide text-[#0a0a0a] uppercase hover:bg-[#dcc487] disabled:opacity-50"
          >
            {isGoingLive ? (
              <>
                <Loader2 className="mr-2 size-5 animate-spin" />
                Going live...
              </>
            ) : (
              'Mark as live →'
            )}
          </Button>

          {actionError ? (
            <p className="text-center text-sm text-red-300" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>
      </div>
    </ListingMissionLayout>
  )
}

export default function GoLivePage() {
  return (
    <ErrorBoundary title="Go Live">
      <GoLiveContent />
    </ErrorBoundary>
  )
}
