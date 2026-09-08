import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AgentSidebar } from '@/components/layout/AgentSidebar'
import { PipelineListingCard } from '@/components/listings/PipelineListingCard'
import { ProfileMenu } from '@/components/profile/ProfileMenu'
import { Input } from '@/components/ui/input'
import type { UserRole } from '@/lib/auth'
import {
  LISTING_COLUMNS,
  getListingContinuePath,
  getListingCtaLabel,
  type ListingRow,
} from '@/lib/listings'
import { getSupabaseClient } from '@/lib/supabase'

type DashboardPageProps = {
  role: Exclude<UserRole, 'admin'>
}

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

function DashboardContent({ role }: DashboardPageProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [listings, setListings] = useState<ListingRow[]>([])
  const [agentId, setAgentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<PipelineTab>('active')
  const [chipFilter, setChipFilter] = useState<'all' | 'needs_action' | 'pending_photo'>('all')
  const [liveBannerId, setLiveBannerId] = useState<string | null>(
    () => searchParams.get('live'),
  )

  const liveListing = useMemo(
    () => listings.find((row) => row.id === liveBannerId) ?? null,
    [listings, liveBannerId],
  )

  useEffect(() => {
    const liveId = searchParams.get('live')
    if (liveId) {
      setLiveBannerId(liveId)
      const next = new URLSearchParams(searchParams)
      next.delete('live')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!liveBannerId) return
    const timer = window.setTimeout(() => setLiveBannerId(null), 8000)
    return () => window.clearTimeout(timer)
  }, [liveBannerId])

  const loadListings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession()
      if (session?.user?.id) setAgentId(session.user.id)

      const { data, error: queryError } = await getSupabaseClient()
        .from('listings')
        .select(LISTING_COLUMNS)
        .order('updated_at', { ascending: false })

      if (queryError) throw queryError
      setListings((data ?? []) as ListingRow[])
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load listings.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadListings()
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
    <main className="relative min-h-svh">
      <div className="grid min-h-svh lg:grid-cols-[220px_1fr]">
        <AgentSidebar role={role} />

        <section className="flex min-h-svh flex-col">
          {liveBannerId ? (
            <motion.div
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex items-center justify-between bg-[#CFB87C] px-6 py-3 text-sm font-bold text-black"
            >
              <span>
                Listing is LIVE — {liveListing?.address_full ?? 'Your listing'}
              </span>
              <button
                type="button"
                onClick={() => setLiveBannerId(null)}
                className="opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          ) : null}

          <header className="flex items-start justify-between border-b border-[var(--color-border)] px-8 py-8">
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-white)]">
                Overview
              </h1>
              <div className="mt-4 flex flex-wrap gap-6">
                {PIPELINE_TABS.map((tab) => {
                  const isActive = activeTab === tab
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`text-sm transition-colors ${
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
            </div>
            <div className="flex items-center gap-4">
              {role === 'agent' ? (
                <button
                  type="button"
                  onClick={() => navigate('/listing/new')}
                  className="inline-flex items-center gap-2 rounded-sm border border-[var(--color-gold)] bg-[var(--color-gold)] px-4 py-2 font-[family-name:var(--font-display)] text-xs font-bold tracking-wide text-black uppercase transition-opacity hover:opacity-90"
                >
                  <Plus className="size-4" />
                  Start New Listing
                </button>
              ) : null}
              <label className="relative hidden sm:block">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search listings..."
                  className="h-10 w-64 rounded-sm border-0 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] pr-3 pl-10 text-[var(--color-white)]"
                />
              </label>
              <ProfileMenu role={role} />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-8 py-10">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 sm:hidden">
                <label className="relative w-full">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search listings..."
                    className="h-10 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] pr-3 pl-10 text-[var(--color-white)]"
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
                  pipelines
                </p>
              </div>

              {isLoading ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Loading listings...
                </p>
              ) : error ? (
                <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-6 text-red-200">
                  {error}
                </div>
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
                      agentId={role === 'agent' ? agentId : null}
                      onDraftDeleted={() => void loadListings()}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default function DashboardPage({ role }: DashboardPageProps) {
  return (
    <ErrorBoundary title="Dashboard">
      <DashboardContent role={role} />
    </ErrorBoundary>
  )
}
