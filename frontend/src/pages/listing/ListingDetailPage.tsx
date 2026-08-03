import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ListingDetailsPanel } from '@/components/listings/ListingDetailsPanel'
import { ProfileMenu } from '@/components/profile/ProfileMenu'
import type { UserRole } from '@/lib/auth'
import {
  LISTING_COLUMNS,
  advanceListingStage,
  deleteListing,
  getListingContinuePath,
  type ListingRow,
  type ListingUpdatePayload,
} from '@/lib/listings'
import { getSupabaseClient } from '@/lib/supabase'

type ListingDetailPageProps = {
  role: UserRole
}

function listingPath(id: string): string {
  return `/listing/${id}`
}

function backPathForRole(role: UserRole | null | undefined): string {
  if (role === 'admin') return '/admin/pipeline'
  return '/dashboard'
}

function ListingDetailContent({ role }: ListingDetailPageProps) {
  const { listingId } = useParams<{ listingId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null)
  const [listing, setListing] = useState<ListingRow | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const backPath = backPathForRole(role)
  const menuRole = role === 'admin' ? 'admin' : role === 'marketing' || role === 'photographer' ? role : 'agent'
  const canManage =
    role === 'agent' &&
    !!listing &&
    !!currentUserId &&
    listing.agent_id === currentUserId

  useEffect(() => {
    const state = location.state as { bookingSuccess?: string } | null
    if (state?.bookingSuccess) {
      setBookingSuccess(state.bookingSuccess)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.pathname, location.state, navigate])

  const reloadListing = useCallback(async () => {
    if (!listingId) return
    const { data, error: queryError } = await getSupabaseClient()
      .from('listings')
      .select(LISTING_COLUMNS)
      .eq('id', listingId)
      .maybeSingle()
    if (queryError) throw queryError
    if (data) setListing(data as ListingRow)
  }, [listingId])

  useEffect(() => {
    if (!listingId) return
    let isMounted = true

    const loadListing = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const {
          data: { session },
        } = await getSupabaseClient().auth.getSession()
        if (isMounted && session?.user?.id) {
          setCurrentUserId(session.user.id)
        }

        const { data, error: queryError } = await getSupabaseClient()
          .from('listings')
          .select(LISTING_COLUMNS)
          .eq('id', listingId)
          .maybeSingle()

        if (queryError) throw queryError
        if (!isMounted) return
        if (!data) {
          setListing(null)
          setError('Listing not found.')
          return
        }

        const row = data as ListingRow
        if (row.stage === 'draft' && session?.user?.id === row.agent_id) {
          navigate(getListingContinuePath(row), { replace: true })
          return
        }

        setListing(row)
      } catch (loadError) {
        if (!isMounted) return
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load listing.',
        )
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadListing()
    return () => {
      isMounted = false
    }
  }, [listingId, navigate])

  const saveListingChanges = async (
    id: string,
    payload: ListingUpdatePayload,
  ) => {
    const { data, error: updateError } = await getSupabaseClient()
      .from('listings')
      .update({
        description_generated: payload.description_generated,
        form_data: payload.form_data,
      })
      .eq('id', id)
      .select(LISTING_COLUMNS)
      .single()

    if (updateError) throw updateError
    if (data) setListing(data as ListingRow)
  }

  const handleAdvanceStage = async (id: string) => {
    if (!listing) return
    const advanced = await advanceListingStage(id, listing.stage)
    if (!advanced) {
      throw new Error('Failed to update listing stage.')
    }
    setListing((prev) => (prev ? { ...prev, stage: advanced } : prev))
  }

  const handleDelete = async (id: string) => {
    if (!currentUserId) throw new Error('Not signed in.')
    const ok = await deleteListing(id, currentUserId)
    if (!ok) {
      throw new Error(
        'Could not delete listing. Only draft listings you own can be deleted.',
      )
    }
    navigate(backPath, { replace: true })
  }

  return (
    <main className="relative min-h-svh px-6 py-8 md:px-8">
      <header className="mb-8 flex items-start justify-between border-b border-[var(--color-border)] pb-6">
        <div className="flex min-w-0 items-start gap-4">
          <Link
            to={backPath}
            className="mt-1 shrink-0 rounded-sm p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[#1a1a1a] hover:text-white"
            aria-label="Back to overview"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <p className="mb-2 text-xs tracking-widest text-[var(--color-gold)] uppercase">
              Mission Control
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-white)]">
              Listing Hub
            </h1>
            {listing ? (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {listing.address_full ?? 'Unnamed listing'}
              </p>
            ) : null}
          </div>
        </div>
        <ProfileMenu role={menuRole} />
      </header>

      {bookingSuccess ? (
        <p className="mb-6 rounded-sm border border-[#CFB87C]/40 bg-[#CFB87C]/10 px-4 py-3 text-sm text-[#CFB87C]">
          {bookingSuccess}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Loading listing...</p>
      ) : error ? (
        <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-6 text-red-200">
          <p>{error}</p>
          <Link
            to={backPath}
            className="mt-4 inline-block text-sm text-[var(--color-gold)] underline"
          >
            Back to overview
          </Link>
        </div>
      ) : listing ? (
        <ListingDetailsPanel
          key={`${listing.id}-${listing.stage}`}
          listing={listing}
          canManage={canManage}
          onClose={() => navigate(backPath)}
          onSave={saveListingChanges}
          onAdvanceStage={canManage ? handleAdvanceStage : undefined}
          onDelete={canManage ? handleDelete : undefined}
          onBookingUpdated={() => void reloadListing()}
        />
      ) : null}

      {listing ? (
        <p className="mt-8 text-xs text-[var(--color-text-secondary)]">
          Shareable link:{' '}
          <span className="text-[var(--color-gold)]">{window.location.origin}{listingPath(listing.id)}</span>
        </p>
      ) : null}
    </main>
  )
}

export default function ListingDetailPage(props: ListingDetailPageProps) {
  return (
    <ErrorBoundary title="Listing">
      <ListingDetailContent {...props} />
    </ErrorBoundary>
  )
}
