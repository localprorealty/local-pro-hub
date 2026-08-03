import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DeleteDraftButton } from '@/components/listings/DeleteDraftButton'
import { PropertySearchStep } from '@/components/listing/PropertySearchStep'
import { NtreisFormBody } from '@/components/form/NtreisFormBody'
import {
  formatPropertyAddress,
  getListing,
  propertyAddressFromFormData,
  TYPE_LABEL,
  updateListingFormData,
  type Listing,
  type PropertyAddress,
} from '@/lib/listings'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchUserProfile } from '@/lib/users'

const EMPTY_ADDRESS: PropertyAddress = {
  street_number: '',
  street_name: '',
  city: '',
  state: 'TX',
  zip_code: '',
  county: '',
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function formatSavedLabel(savedAt: Date | null): string {
  if (!savedAt) return 'Saved'
  const diffMs = Date.now() - savedAt.getTime()
  if (diffMs < 10_000) return 'Saved'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Saved just now'
  return `Saved ${mins}m ago`
}

function ListingFormContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [listing, setListing] = useState<Listing | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [address, setAddress] = useState<PropertyAddress>(EMPTY_ADDRESS)
  const [showFormSections, setShowFormSections] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [agentMlsId, setAgentMlsId] = useState<string | null>(null)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [retsFormPatch, setRetsFormPatch] = useState<Record<string, unknown>>({})
  const [preFilledKeys, setPreFilledKeys] = useState<Set<string>>(new Set())
  const listingIdRef = useRef<string | undefined>(id)

  useEffect(() => {
    listingIdRef.current = id
  }, [id])

  const persistFormData = useCallback(async (patch: Record<string, unknown>) => {
    const listingId = listingIdRef.current
    if (!listingId) return false

    setSaveStatus('saving')
    const ok = await updateListingFormData(listingId, patch)
    if (ok) {
      setSaveStatus('saved')
      setSavedAt(new Date())
      return true
    }
    setSaveStatus('error')
    return false
  }, [])

  const advanceToForm = useCallback(
    async (
      nextAddress: PropertyAddress,
      nextRets: Record<string, unknown>,
      filledKeys: string[],
    ) => {
      setIsSubmitting(true)

      const patch: Record<string, unknown> = {
        ...nextAddress,
        ...nextRets,
        address_step_complete: true,
      }
      if (filledKeys.length > 0) {
        patch._rets_prefilled_keys = filledKeys
      }

      const ok = await persistFormData(patch)
      if (!ok) {
        setIsSubmitting(false)
        return
      }

      const fullAddress = formatPropertyAddress(nextAddress)
      if (listingIdRef.current) {
        await getSupabaseClient()
          .from('listings')
          .update({
            address_full: fullAddress || null,
            mls_number: nextAddress.mls_number?.trim() || null,
          })
          .eq('id', listingIdRef.current)
      }

      setAddress(nextAddress)
      setRetsFormPatch(nextRets)
      setPreFilledKeys(new Set(filledKeys))
      setShowFormSections(true)
      setIsSubmitting(false)
    },
    [persistFormData],
  )

  useEffect(() => {
    if (!id) return
    let isMounted = true

    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const {
          data: { session },
        } = await getSupabaseClient().auth.getSession()
        const userId = session?.user?.id
        if (!userId) {
          navigate('/dashboard', { replace: true })
          return
        }
        setAgentId(userId)

        const row = await getListing(id)
        if (!isMounted) return

        if (!row || row.agent_id !== userId) {
          navigate('/dashboard', { replace: true })
          return
        }

        setListing(row)
        const parsed = propertyAddressFromFormData(row.form_data)
        setAddress(parsed)
        const addressComplete = row.form_data?.address_step_complete === true
        setShowFormSections(addressComplete)

        const storedPreFilled = row.form_data?._rets_prefilled_keys
        if (Array.isArray(storedPreFilled)) {
          const keySet = new Set(
            storedPreFilled.filter((k): k is string => typeof k === 'string'),
          )
          setPreFilledKeys(keySet)

          const addressKeys = new Set([
            'street_number',
            'street_direction',
            'street_name',
            'street_type',
            'street_dir_suffix',
            'unit_number',
            'city',
            'state',
            'zip_code',
            'county',
            'subdivision',
            'mls_number',
            'address_step_complete',
            '_rets_prefilled_keys',
          ])
          const patch: Record<string, unknown> = {}
          for (const key of keySet) {
            if (!addressKeys.has(key) && row.form_data && key in row.form_data) {
              patch[key] = row.form_data[key]
            }
          }
          setRetsFormPatch(patch)
        }

        if (row.form_data && Object.keys(row.form_data).length > 0) {
          setSavedAt(new Date(row.updated_at))
          setSaveStatus('saved')
        }
        const profile = await fetchUserProfile(userId)
        if (isMounted && profile?.mls_id) {
          setAgentMlsId(profile.mls_id)
        }
      } catch {
        if (!isMounted) return
        setLoadError('Unable to load listing.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [id, navigate])

  const handlePropertyFound = (
    formFields: Record<string, unknown>,
    addressPatch: Record<string, string>,
    filledKeys: string[],
  ) => {
    const nextAddress: PropertyAddress = { ...address }
    for (const [key, value] of Object.entries(addressPatch) as [keyof PropertyAddress, string][]) {
      if (!value.trim()) continue
      nextAddress[key] = value
    }

    const nextRets: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(formFields)) {
      if (value !== undefined && value !== null && value !== '') {
        nextRets[key] = value
      }
    }

    void advanceToForm(nextAddress, nextRets, filledKeys)
  }

  const handleSkipSearch = () => {
    void advanceToForm(address, {}, [])
  }

  const saveIndicator =
    saveStatus === 'saving'
      ? 'Saving...'
      : saveStatus === 'error'
        ? 'Error'
        : formatSavedLabel(savedAt)

  if (isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0a0a0a] text-[#888888]">
        Loading listing...
      </main>
    )
  }

  if (loadError || !listing) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[#0a0a0a] text-red-300">
        <p>{loadError ?? 'Listing not found.'}</p>
        <Link to="/dashboard" className="text-[#CFB87C] hover:underline">
          Back to dashboard
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-[#0a0a0a]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#2a2a2a] bg-[#0a0a0a]/95 px-6 py-4 backdrop-blur-sm md:px-10">
        <Link
          to="/dashboard"
          className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tighter text-[#CFB87C]"
        >
          LP
        </Link>
        <div className="flex items-center gap-2 font-[family-name:var(--font-display)] text-sm text-white">
          <span>New Listing</span>
          <span className="text-[#555555]">·</span>
          <span className="rounded border border-[#CFB87C]/40 bg-[#CFB87C]/10 px-2 py-0.5 text-xs text-[#CFB87C]">
            {TYPE_LABEL[listing.listing_type]}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {listing.stage === 'draft' && agentId ? (
            <DeleteDraftButton
              listingId={listing.id}
              agentId={agentId}
              variant="icon"
              onDeleted={() => navigate('/dashboard', { replace: true })}
            />
          ) : null}
          <p
            className={`text-xs ${
              saveStatus === 'error'
                ? 'text-red-400'
                : saveStatus === 'saving'
                  ? 'text-[#888888]'
                  : 'text-[#CFB87C]'
            }`}
          >
            {saveIndicator}
          </p>
        </div>
      </header>

      {!showFormSections ? (
        <PropertySearchStep
          onFound={handlePropertyFound}
          onSkip={handleSkipSearch}
          isSubmitting={isSubmitting}
        />
      ) : (
        <NtreisFormBody
          listingId={listing.id}
          initialFormData={listing.form_data ?? {}}
          address={address}
          agentMlsId={agentMlsId}
          retsFormPatch={retsFormPatch}
          initialPreFilledKeys={[...preFilledKeys]}
          onEditAddress={() => setShowFormSections(false)}
          onStageAdvanced={() => navigate(`/listing/${listing.id}`)}
        />
      )}
    </main>
  )
}

export default function ListingFormPage() {
  return (
    <ErrorBoundary title="Listing Form">
      <ListingFormContent />
    </ErrorBoundary>
  )
}
