import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'

import { AdminShell } from '@/components/admin/AdminShell'
import { PipelineListingCard } from '@/components/listings/PipelineListingCard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Input } from '@/components/ui/input'
import {
  LISTING_COLUMNS,
  getListingContinuePath,
  getListingCtaLabel,
  type ListingRow,
} from '@/lib/listings'
import { getSupabaseClient } from '@/lib/supabase'

type PipelineTab = 'active' | 'drafts' | 'archived'

const PIPELINE_TABS: PipelineTab[] = ['active', 'drafts', 'archived']

function tabLabel(tab: PipelineTab): string {
  if (tab === 'active') return 'Active'
  if (tab === 'drafts') return 'Drafts'
  return 'Archived'
}

function matchesTab(listing: ListingRow, tab: PipelineTab): boolean {
  if (tab === 'drafts') return listing.stage === 'draft'
  if (tab === 'archived') return listing.stage === 'closed'
  return listing.stage !== 'draft' && listing.stage !== 'closed'
}

function AdminPipelineContent() {
  const [listings, setListings] = useState<ListingRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<PipelineTab>('active')
  const [chipFilter, setChipFilter] = useState<'all' | 'needs_action' | 'pending_photo'>('all')

  useEffect(() => {
    let isMounted = true

    const loadListings = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { data, error: queryError } = await getSupabaseClient()
          .from('listings')
          .select(LISTING_COLUMNS)
          .order('updated_at', { ascending: false })

        if (queryError) throw queryError
        if (!isMounted) return
        setListings((data ?? []) as ListingRow[])
      } catch (loadError) {
        if (!isMounted) return
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load listings.',
        )
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadListings()
    return () => {
      isMounted = false
    }
  }, [])

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      if (!matchesTab(listing, activeTab)) return false

      const text = `${listing.address_full ?? ''} ${listing.mls_number ?? ''}`.toLowerCase()
      const matchesSearch = search.trim()
        ? text.includes(search.trim().toLowerCase())
        : true

      if (chipFilter === 'needs_action') {
        return (
          matchesSearch &&
          (listing.stage === 'docs_pending' || listing.stage === 'docs_signed')
        )
      }
      if (chipFilter === 'pending_photo') {
        return matchesSearch && listing.stage === 'shoot_booked'
      }

      return matchesSearch
    })
  }, [listings, search, activeTab, chipFilter])

  const tabCounts = useMemo(() => {
    const counts: Record<PipelineTab, number> = {
      active: 0,
      drafts: 0,
      archived: 0,
    }
    listings.forEach((listing) => {
      PIPELINE_TABS.forEach((tab) => {
        if (matchesTab(listing, tab)) counts[tab] += 1
      })
    })
    return counts
  }, [listings])

  return (
    <AdminShell title="Overview" eyebrow="Mission Control">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-8 flex flex-col gap-6 border-b border-[var(--color-border)] pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-6">
            {PIPELINE_TABS.map((tab) => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`font-medium transition-colors ${
                    isActive
                      ? 'border-b border-[var(--color-gold)] pb-1 text-[var(--color-gold)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-white)]'
                  }`}
                >
                  {tabLabel(tab)} ({tabCounts[tab]})
                </button>
              )
            })}
          </div>

          <label className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search listings..."
              className="h-10 rounded-sm border-0 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] pr-3 pl-10 text-[var(--color-white)] focus-visible:ring-0"
            />
          </label>
        </div>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            {(
              [
                ['all', 'All Listings'],
                ['needs_action', 'Needs Action'],
                ['pending_photo', 'Pending Photo'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setChipFilter(value)}
                className={`px-4 py-1.5 text-[11px] tracking-wider uppercase transition-colors ${
                  chipFilter === value
                    ? 'border border-[var(--color-gold)] bg-[var(--color-gold)]/10 text-[var(--color-gold)]'
                    : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-gold)]/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Showing{' '}
            <span className="font-semibold text-[var(--color-white)]">
              {filteredListings.length}
            </span>{' '}
            {tabLabel(activeTab).toLowerCase()} pipelines
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading listings...</p>
        ) : error ? (
          <div className="border border-red-500/40 bg-red-500/10 p-6 text-red-200">{error}</div>
        ) : filteredListings.length === 0 ? (
          <div className="flex h-32 items-center justify-center border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
            No listings in this view.
          </div>
        ) : (
          <div className="max-w-5xl space-y-6">
            {filteredListings.map((listing, index) => (
              <PipelineListingCard
                key={listing.id}
                listing={listing}
                index={index}
                listingPath={getListingContinuePath(listing)}
                ctaLabel={getListingCtaLabel(listing.stage)}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AdminShell>
  )
}

export default function AdminPipelinePage() {
  return (
    <ErrorBoundary title="Admin pipeline">
      <AdminPipelineContent />
    </ErrorBoundary>
  )
}
