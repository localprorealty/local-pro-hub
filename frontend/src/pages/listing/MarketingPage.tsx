import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ListingMissionLayout } from '@/components/listing/ListingMissionLayout'
import { PipelineDotNav } from '@/components/listing/SubmissionPortalSidebar'
import { Button } from '@/components/ui/button'
import {
  MARKETING_ASSETS,
  STATUS_LABEL,
  statusBadgeClass,
  type MarketingAssetStatus,
} from '@/lib/marketing-assets'
import { getListing, getMarketingAssetsPath, getMlsPath, addMarketingAsset, removeMarketingAsset, type Listing } from '@/lib/listings'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchUserProfile } from '@/lib/users'

function MarketingContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [listing, setListing] = useState<Listing | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [statuses, setStatuses] = useState<Record<string, MarketingAssetStatus>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isNotifying, setIsNotifying] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null)
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
      
      if (listingRow.form_data?.marketing_statuses) {
        setStatuses(listingRow.form_data.marketing_statuses as Record<string, MarketingAssetStatus>)
        const initialSelected = new Set<string>()
        for (const [assetId, status] of Object.entries(listingRow.form_data.marketing_statuses as Record<string, string>)) {
          if (status === 'in_progress' || status === 'done') {
            initialSelected.add(assetId)
          }
        }
        setSelected(initialSelected)
      } else {
        setSelected(new Set())
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load listing.')
    } finally {
      setIsLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  const selectedAssets = useMemo(
    () => MARKETING_ASSETS.filter((asset) => selected.has(asset.id)),
    [selected],
  )

  const subtotalCents = useMemo(
    () => selectedAssets.reduce((sum, asset) => sum + asset.priceCents, 0),
    [selectedAssets],
  )

  const totalCents = subtotalCents





  const handleAddAsset = async (assetId: string) => {
    if (!id) return
    const asset = MARKETING_ASSETS.find((a) => a.id === assetId)
    if (!asset) return

    // Preemptively update local state
    setStatuses((prev) => ({ ...prev, [assetId]: 'in_progress' }))
    setSelected((prev) => {
      const next = new Set(prev)
      next.add(assetId)
      return next
    })

    const updatedStatuses = await addMarketingAsset(id, asset.id, asset.name, asset.priceCents)
    if (updatedStatuses) {
      setStatuses(updatedStatuses as Record<string, MarketingAssetStatus>)
      const newSelected = new Set<string>()
      for (const [aId, status] of Object.entries(updatedStatuses)) {
        if (status === 'in_progress' || status === 'done') {
          newSelected.add(aId)
        }
      }
      setSelected(newSelected)
    } else {
      // Rollback on failure
      setStatuses((prev) => {
        const next = { ...prev }
        delete next[assetId]
        return next
      })
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(assetId)
        return next
      })
    }
  }

  const handleRemoveAsset = async (assetId: string) => {
    if (!id) return

    // Preemptively update local state
    setStatuses((prev) => {
      const next = { ...prev }
      delete next[assetId]
      return next
    })
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(assetId)
      return next
    })

    const updatedStatuses = await removeMarketingAsset(id, assetId)
    if (updatedStatuses) {
      setStatuses(updatedStatuses as Record<string, MarketingAssetStatus>)
      const newSelected = new Set<string>()
      for (const [aId, status] of Object.entries(updatedStatuses)) {
        if (status === 'in_progress' || status === 'done') {
          newSelected.add(aId)
        }
      }
      setSelected(newSelected)
    } else {
      // Rollback on failure
      setStatuses((prev) => ({ ...prev, [assetId]: 'in_progress' }))
      setSelected((prev) => {
        const next = new Set(prev)
        next.add(assetId)
        return next
      })
    }
  }

  const handleToggleAsset = async (assetId: string) => {
    if (selected.has(assetId)) {
      await handleRemoveAsset(assetId)
    } else {
      await handleAddAsset(assetId)
    }
  }

  const handleNotify = async () => {
    setIsNotifying(true)
    setNotifyMessage(null)
    await new Promise((resolve) => setTimeout(resolve, 600))
    setNotifyMessage('Marketing team notified with your property brief.')
    setIsNotifying(false)
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
      title="Marketing"
      subtitle={`Select assets for ${listing.address_full ?? 'this listing'}`}
      email={agentEmail}
    >
      <div className="grid gap-8 lg:grid-cols-[auto_1fr_320px]">
        <PipelineDotNav activeIndex={0} />

        <div className="space-y-6">
          <section className="rounded-md border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 p-5">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--color-text)]">
              Auto-generate marketing assets
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Upload photographer photos to create a Just Sold post, listing flyer, and full
              listing book PDF with AI refinement.
            </p>
            <Button
              asChild
              className="mt-4 h-11 rounded-sm bg-[var(--color-gold)] font-semibold text-black hover:bg-[var(--color-gold)]/90"
            >
              <Link to={getMarketingAssetsPath(id)}>Create marketing assets →</Link>
            </Button>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
          {MARKETING_ASSETS.map((asset) => {
            const Icon = asset.icon
            const isSelected = selected.has(asset.id)
            const status = statuses[asset.id] ?? 'not_started'
            return (
              <article
                key={asset.id}
                className={`rounded-md border bg-[var(--color-surface)] p-5 transition-all ${
                  isSelected ? 'border-[var(--color-gold)] shadow-[0_0_15px_rgba(207,184,124,0.08)]' : 'border-[var(--color-border)] hover:border-[var(--color-gold)]/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-semibold tracking-[0.15em] text-[var(--color-text-secondary)] uppercase">
                    {asset.name}
                  </p>
                  <span className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-bold tracking-widest text-[var(--color-gold)] uppercase">
                    {asset.priceLabel}
                  </span>
                </div>

                <div className="mt-6 flex justify-center">
                  <div className={`flex size-14 items-center justify-center rounded-full transition-colors ${
                    isSelected ? 'bg-[var(--color-gold)]/20' : 'bg-[var(--color-gold)]/10'
                  }`}>
                    <Icon className="size-7 text-[var(--color-gold)]" aria-hidden />
                  </div>
                </div>

                <p className="mt-4 text-center text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  {asset.description}
                </p>

                 <div className="mt-5 flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-widest uppercase ${statusBadgeClass(status)}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleToggleAsset(asset.id)}
                    className={`group/btn rounded-sm px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase transition-colors ${
                      isSelected 
                        ? 'bg-[var(--color-gold)]/15 text-[var(--color-gold)] hover:bg-red-500/15 hover:text-red-500' 
                        : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <span className="group-hover/btn:hidden">Selected</span>
                        <span className="hidden group-hover/btn:inline">Remove</span>
                      </>
                    ) : (
                      '+ Add'
                    )}
                  </button>
                </div>
              </article>
            )
          })}
        </section>
        </div>

        <aside className="h-fit rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
          <h2 className="text-[10px] font-semibold tracking-[0.2em] text-[var(--color-gold)] uppercase">
            Marketing Summary
          </h2>

          <ul className="mt-5 space-y-3 border-b border-[var(--color-border)] pb-5">
            {selectedAssets.length === 0 ? (
              <li className="text-sm text-[var(--color-text-secondary)]">No assets selected</li>
            ) : (
              selectedAssets.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between text-sm text-[var(--color-text)]">
                  <span>{asset.name}</span>
                  <span className="text-[var(--color-text-secondary)]">
                    {`$${(asset.priceCents / 100).toFixed(2)}`}
                  </span>
                </li>
              ))
            )}
          </ul>


          {subtotalCents > 0 ? (
            <div className="mt-4 flex items-end justify-between border-t border-[var(--color-border)]/40 pt-4 mb-4">
              <div>
                <p className="text-[10px] tracking-widest text-[var(--color-text-secondary)] uppercase">
                  Total due
                </p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--color-text)]">
                  {`$${(totalCents / 100).toFixed(2)}`}
                </p>
              </div>
            </div>
          ) : null}

          <Button
            type="button"
            disabled={selectedAssets.length === 0 || isNotifying}
            onClick={() => void handleNotify()}
            className="h-12 w-full rounded-sm bg-[var(--color-gold)] text-sm font-bold tracking-wide text-black uppercase hover:bg-[var(--color-gold)]/90 disabled:opacity-50"
          >
            {isNotifying ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Notify marketing team'
            )}
          </Button>

          {notifyMessage ? (
            <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400" role="status">
              {notifyMessage}
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(getMlsPath(id))}
            className="mt-6 h-10 w-full rounded-sm border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-3)]"
          >
            Continue to MLS submission →
          </Button>
        </aside>
      </div>
    </ListingMissionLayout>
  )
}

export default function MarketingPage() {
  return (
    <ErrorBoundary title="Marketing">
      <MarketingContent />
    </ErrorBoundary>
  )
}
