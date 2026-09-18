import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { FloatingUtilityStack } from '@/components/theme/FloatingUtilityStack'
import { ListingDetailsPanel } from '@/components/listings/ListingDetailsPanel'
import { ListingIdBadge } from '@/components/listings/ListingIdBadge'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { ProfileMenu } from '@/components/profile/ProfileMenu'
import type { UserRole } from '@/lib/auth'
import {
  LISTING_COLUMNS,
  advanceListingStage,
  deleteListing,
  getListingContinuePath,
  isUnstartedDraft,
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
  const menuRole =
    role === 'admin'
      ? 'admin'
      : role === 'marketing' || role === 'photographer' || role === 'transaction_coordinator'
        ? role
        : 'agent'
  const canManage =
    !!listing &&
    !!currentUserId &&
    (role === 'transaction_coordinator' ||
      role === 'admin' ||
      (role === 'agent' && listing.agent_id === currentUserId))

  useEffect(() => {
    const state = location.state as { bookingSuccess?: string } | null
    if (state?.bookingSuccess) {
      setBookingSuccess(state.bookingSuccess)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.pathname, location.state, navigate])

  const reloadListing = useCallback(async () => {
    if (!listingId) return
    let queryRes: { data: any; error: any } = await getSupabaseClient()
      .from('listings')
      .select(`${LISTING_COLUMNS}, agent:users!agent_id(full_name, email), creator:users!created_by(full_name)`)
      .eq('id', listingId)
      .maybeSingle()

    if (queryRes.error) {
      queryRes = await getSupabaseClient()
        .from('listings')
        .select(`${LISTING_COLUMNS}, agent:users!agent_id(full_name, email)`)
        .eq('id', listingId)
        .maybeSingle()
    }

    if (queryRes.error) {
      queryRes = await getSupabaseClient()
        .from('listings')
        .select(LISTING_COLUMNS)
        .eq('id', listingId)
        .maybeSingle()
    }

    if (queryRes.error) throw queryRes.error
    if (queryRes.data) setListing((queryRes.data as unknown) as ListingRow)
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

        let queryRes: { data: any; error: any } = await getSupabaseClient()
          .from('listings')
          .select(`${LISTING_COLUMNS}, agent:users!agent_id(full_name, email), creator:users!created_by(full_name)`)
          .eq('id', listingId)
          .maybeSingle()

        if (queryRes.error) {
          queryRes = await getSupabaseClient()
            .from('listings')
            .select(`${LISTING_COLUMNS}, agent:users!agent_id(full_name, email)`)
            .eq('id', listingId)
            .maybeSingle()
        }

        if (queryRes.error) {
          queryRes = await getSupabaseClient()
            .from('listings')
            .select(LISTING_COLUMNS)
            .eq('id', listingId)
            .maybeSingle()
        }

        if (queryRes.error) throw queryRes.error
        if (!isMounted) return
        if (!queryRes.data) {
          setListing(null)
          setError('Listing not found.')
          return
        }

        const row = (queryRes.data as unknown) as ListingRow
        if (isUnstartedDraft(row) && session?.user?.id === row.agent_id) {
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
    if (data) {
      setListing((prev) => ({
        ...(prev ?? {}),
        ...(data as ListingRow),
        agent: prev?.agent,
        creator: prev?.creator,
      }))
    }
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
    <main className="relative min-h-svh bg-[var(--color-bg-base)] text-[var(--color-text)] px-4 py-6 sm:px-6 sm:py-8 md:px-8">
      <header className="mb-6 sm:mb-8 flex items-start justify-between border-b border-[var(--color-border)] pb-4 sm:pb-6">
        <div className="flex min-w-0 items-start gap-4">
          <Link
            to={backPath}
            className="mt-1 shrink-0 rounded-sm p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
            aria-label="Back to overview"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <p className="mb-2 text-xs tracking-widest text-[var(--color-gold)] uppercase">
              Mission Control
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-text)]">
              Listing Hub
            </h1>
            {listing ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <span>{listing.address_full ?? 'Unnamed listing'}</span>
                <span className="text-[var(--color-text-tertiary)]">·</span>
                <ListingIdBadge id={listing.id} />
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell role={menuRole} />
          <ProfileMenu role={menuRole} />
        </div>
      </header>

      {bookingSuccess ? (
        <p className="mb-6 rounded-sm border border-[var(--color-gold-border)] bg-[var(--color-gold-dim)] px-4 py-3 text-sm text-[var(--color-gold)]">
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

      <FloatingUtilityStack formPageLayout={false} />
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
