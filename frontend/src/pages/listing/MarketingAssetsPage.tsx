import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, Loader2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  AiRefinementPanel,
  type RefinementPageOption,
} from '@/components/marketing/AiRefinementPanel'
import { buildBookRefinementPages } from '@/components/marketing/book-refinement-pages'
import { JustSoldTemplate } from '@/components/marketing/JustSoldTemplate'
import { ListingBookTemplate } from '@/components/marketing/ListingBookTemplate'
import { ListingFlyerTemplate } from '@/components/marketing/ListingFlyerTemplate'
import { getListingBookPageIds } from '@/components/marketing/listing-book/book-page-ids'
import { PaymentStep } from '@/components/marketing/PaymentStep'
import { PhotoUploadStep } from '@/components/marketing/PhotoUploadStep'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ListingMissionLayout } from '@/components/listing/ListingMissionLayout'
import { Button } from '@/components/ui/button'
import {
  buildAgentProfile,
  buildListingContext,
  formatFooterContact,
  getDefaultNeighborhoodGuide,
  getFirstPhoto,
  getPhotosByCategories,
  listingContextForApi,
  parseFooterContact,
  slugifyAddress,
} from '@/lib/marketing-data'
import {
  downloadAsImage,
  downloadAsPdf,
  downloadListingBookPDF,
  fetchNeighborhoodGuide,
  MarketingExportError,
  refineMarketingContent,
} from '@/lib/marketing'
import type {
  AgentMarketingProfile,
  MarketingAssetTab,
  MarketingStep,
  NeighborhoodGuide,
  PhotoUpload,
} from '@/lib/marketing-types'
import { getListing, type Listing } from '@/lib/listings'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchUserProfile, type UserProfileRow } from '@/lib/users'

const TABS: { id: MarketingAssetTab; label: string }[] = [
  { id: 'just_sold', label: 'Just Sold' },
  { id: 'flyer', label: 'Listing Flyer' },
  { id: 'book', label: 'Listing Book' },
]

function MarketingAssetsContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [listing, setListing] = useState<Listing | null>(null)
  const [agentEmail, setAgentEmail] = useState<string | undefined>()
  const [userProfile, setUserProfile] = useState<UserProfileRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [step, setStep] = useState<MarketingStep>('upload')
  const [photos, setPhotos] = useState<PhotoUpload[]>([])
  const [activeTab, setActiveTab] = useState<MarketingAssetTab>('just_sold')
  const [activePageKey, setActivePageKey] = useState('flyer_description')
  const [neighborhoodGuide, setNeighborhoodGuide] = useState<NeighborhoodGuide | null>(
    null,
  )
  const [flyerDescription, setFlyerDescription] = useState('')
  const [propertyDescription, setPropertyDescription] = useState('')
  const [agentBio, setAgentBio] = useState('')
  const [agentContact, setAgentContact] = useState<
    Pick<AgentMarketingProfile, 'full_name' | 'phone' | 'email'>
  >({
    full_name: '',
    phone: '',
    email: '',
  })
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [refinementHistory, setRefinementHistory] = useState<Record<string, string[]>>({})
  const [undoStacks, setUndoStacks] = useState<Record<string, string[]>>({})
  const [refineError, setRefineError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const [hasCheckedDraft, setHasCheckedDraft] = useState(false)
  const [isDraftRestored, setIsDraftRestored] = useState(false)
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadPage = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession()
      const userId = session?.user?.id
      const token = session?.access_token
      
      const [listingRow, profile, draftRes] = await Promise.all([
        getListing(id),
        userId ? fetchUserProfile(userId) : Promise.resolve(null),
        token
          ? fetch(
              `${import.meta.env.VITE_API_BASE_URL}/listings/${id}/marketing/draft`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            )
              .then((r) => r.json())
              .catch(() => null)
          : Promise.resolve(null),
      ])

      if (!listingRow) throw new Error('Listing not found')
      if (listingRow.stage !== 'marketing') {
        navigate(`/listing/${id}`, { replace: true })
        return
      }
      setListing(listingRow)
      if (profile?.email) setAgentEmail(profile.email)
      setUserProfile(profile)

      if (draftRes && draftRes.draft) {
        const draft = draftRes.draft
        if (draft.step) setStep(draft.step)
        if (draft.activeTab) setActiveTab(draft.activeTab)
        if (draft.activePageKey) setActivePageKey(draft.activePageKey)
        if (draft.flyerDescription) setFlyerDescription(draft.flyerDescription)
        if (draft.propertyDescription) setPropertyDescription(draft.propertyDescription)
        if (draft.agentBio) setAgentBio(draft.agentBio)
        if (draft.agentContact) setAgentContact(draft.agentContact)
        if (draft.neighborhoodGuide) setNeighborhoodGuide(draft.neighborhoodGuide)
        if (draft.refinementHistory) setRefinementHistory(draft.refinementHistory)
        if (draft.undoStacks) setUndoStacks(draft.undoStacks)
        if (draft.photos) setPhotos(draft.photos)
        setIsDraftRestored(true)
      }
      setHasCheckedDraft(true)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load listing.')
    } finally {
      setIsLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    if (!listing || !hasCheckedDraft || isDraftRestored) return
    const context = buildListingContext(listing)
    setFlyerDescription(context.property_description)
    setPropertyDescription(context.property_description)
    setAgentBio(
      `${userProfile?.full_name ?? 'Your agent'} is an experienced North Texas real estate professional dedicated to guiding clients through every step of the transaction with clarity and care.`,
    )
  }, [listing, userProfile?.full_name, hasCheckedDraft, isDraftRestored])

  useEffect(() => {
    if (!userProfile || !hasCheckedDraft || isDraftRestored) return
    setAgentContact({
      full_name: userProfile.full_name?.trim() || 'Your Agent',
      phone: userProfile.phone?.trim() || '',
      email: userProfile.email?.trim() || '',
    })
  }, [userProfile, hasCheckedDraft, isDraftRestored])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  // Cleanup maxWait timer on unmount
  useEffect(() => {
    return () => {
      if (maxWaitRef.current) {
        clearTimeout(maxWaitRef.current)
      }
    }
  }, [])

  // Auto-save debounced effect
  useEffect(() => {
    if (!id || !hasCheckedDraft) return

    const saveState = async () => {
      try {
        const { getSupabaseClient } = await import('@/lib/supabase')
        const session = await getSupabaseClient().auth.getSession()
        const token = session.data.session?.access_token
        if (!token) return

        const serializablePhotos = photos.map((p) => ({
          id: p.id,
          category: p.category,
          photo_path: p.photo_path,
        }))

        const statePayload = {
          step,
          activeTab,
          activePageKey,
          flyerDescription,
          propertyDescription,
          agentBio,
          agentContact,
          neighborhoodGuide,
          refinementHistory,
          undoStacks,
          photos: serializablePhotos,
        }

        await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/listings/${id}/marketing/draft`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ state: statePayload }),
          }
        )
      } catch (err) {
        console.error('Failed to auto-save marketing draft:', err)
      }
    }

    const debounceTimeout = setTimeout(() => {
      void saveState()
      if (maxWaitRef.current) {
        clearTimeout(maxWaitRef.current)
        maxWaitRef.current = null
      }
    }, 2000)

    if (!maxWaitRef.current) {
      maxWaitRef.current = setTimeout(() => {
        void saveState()
        clearTimeout(debounceTimeout)
        maxWaitRef.current = null
      }, 10000)
    }

    return () => {
      clearTimeout(debounceTimeout)
    }
  }, [
    id,
    hasCheckedDraft,
    step,
    photos,
    activeTab,
    activePageKey,
    flyerDescription,
    propertyDescription,
    agentBio,
    agentContact,
    neighborhoodGuide,
    refinementHistory,
    undoStacks,
  ])

  const agentProfile = useMemo(() => {
    const base = buildAgentProfile(userProfile, photos)
    return {
      ...base,
      ...agentContact,
      headshot_url: base.headshot_url,
    }
  }, [agentContact, photos, userProfile])

  const listingContext = useMemo(
    () => (listing ? buildListingContext(listing) : null),
    [listing],
  )

  const heroPhoto = getFirstPhoto(photos, ['hero'])?.preview ?? null
  const interiorPhotos = getPhotosByCategories(photos, [
    'living_room',
    'kitchen',
    'dining',
  ]).map((p) => p.preview)
  const fileSlug = slugifyAddress(listingContext?.address_full ?? 'listing')

  const bootstrapAssets = useCallback(async () => {
    if (!id || !listingContext) return
    setIsBootstrapping(true)
    try {
      const city = listingContext.address_city || 'North Texas'
      try {
        const guide = await fetchNeighborhoodGuide(id)
        setNeighborhoodGuide(guide)
      } catch {
        setNeighborhoodGuide(getDefaultNeighborhoodGuide(city))
      }

      if (!agentBio.trim()) {
        const bio = await refineMarketingContent(id, {
          page_type: 'agent_bio',
          current_content: '',
          instruction:
            'Write a professional three-sentence realtor bio for a North Texas agent.',
          listing_context: listingContextForApi(listingContext),
        })
        setAgentBio(bio)
      }
    } finally {
      setIsBootstrapping(false)
    }
  }, [agentBio, id, listingContext])

  const handlePaid = () => {
    setStep('generate')
    void bootstrapAssets()
  }

  const refinementPages = useMemo((): RefinementPageOption[] => {
    if (activeTab === 'flyer') {
      return [
        {
          key: 'flyer_description',
          label: 'Property description',
          pageType: 'flyer',
          getContent: () => flyerDescription,
          applyContent: setFlyerDescription,
        },
        {
          key: 'flyer_footer',
          label: 'Footer contact info',
          pageType: 'flyer_footer',
          getContent: () => formatFooterContact(agentContact),
          applyContent: (content) => {
            const parsed = parseFooterContact(content)
            setAgentContact((prev) => ({ ...prev, ...parsed }))
          },
        },
      ]
    }
    if (activeTab === 'book' && neighborhoodGuide) {
      return buildBookRefinementPages({
        neighborhoodGuide,
        setNeighborhoodGuide,
        propertyDescription,
        setPropertyDescription,
        agentBio,
        setAgentBio,
      })
    }
    return []
  }, [activeTab, agentBio, agentContact, flyerDescription, neighborhoodGuide, propertyDescription])

  useEffect(() => {
    if (refinementPages[0]) {
      setActivePageKey(refinementPages[0].key)
    }
  }, [activeTab, refinementPages])

  const handleRefine = async (page: RefinementPageOption, instruction: string) => {
    if (!id || !listingContext) return
    setIsRefining(true)
    setRefineError(null)
    try {
      const current = page.getContent()
      setUndoStacks((prev) => ({
        ...prev,
        [page.key]: [...(prev[page.key] ?? []), current],
      }))
      const content = await refineMarketingContent(id, {
        page_type: page.pageType,
        current_content: current,
        instruction,
        listing_context: {
          ...listingContextForApi(listingContext),
          agent_name: agentProfile.full_name,
          agent_email: agentProfile.email,
          agent_phone: agentProfile.phone,
        },
      })
      page.applyContent(content)
      setRefinementHistory((prev) => ({
        ...prev,
        [page.key]: [instruction, ...(prev[page.key] ?? [])].slice(0, 3),
      }))
    } catch (error) {
      setRefineError(
        error instanceof Error ? error.message : 'Could not refine this section.',
      )
    } finally {
      setIsRefining(false)
    }
  }

  const handleUndo = (pageKey: string) => {
    const stack = undoStacks[pageKey]
    if (!stack?.length) return
    const previous = stack[stack.length - 1]
    const page = refinementPages.find((item) => item.key === pageKey)
    if (page) page.applyContent(previous)
    setUndoStacks((prev) => ({
      ...prev,
      [pageKey]: prev[pageKey]?.slice(0, -1) ?? [],
    }))
  }

  const runDownload = async (action: () => Promise<void>) => {
    setIsDownloading(true)
    setDownloadError(null)
    try {
      await action()
    } catch (error) {
      setDownloadError(
        error instanceof MarketingExportError || error instanceof Error
          ? error.message
          : 'Download failed. Try again.',
      )
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDownloadJustSold = () =>
    runDownload(() => downloadAsImage('marketing-just-sold', `localpro-just-sold-${fileSlug}`, 2))

  const handleDownloadFlyerPng = () =>
    runDownload(() => downloadAsImage('marketing-flyer', `localpro-flyer-${fileSlug}`, 2))

  const handleDownloadFlyerPdf = () =>
    runDownload(() => downloadAsPdf('marketing-flyer', `localpro-flyer-${fileSlug}`, 'portrait'))

  const handleDownloadBookPdf = () =>
    runDownload(async () => {
      const pageIds = getListingBookPageIds(photos)
      await downloadListingBookPDF(pageIds, `localpro-listing-book-${fileSlug}`)
    })

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-text-secondary)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading...
      </div>
    )
  }

  if (loadError || !listing || !id || !listingContext) {
    return (
      <div className="rounded-sm border border-red-500/30 bg-red-500/5 p-6 text-red-300">
        {loadError ?? 'Listing not found'}
      </div>
    )
  }

  return (
    <ListingMissionLayout
      listingId={id}
      title="Marketing Asset Generator"
      subtitle={listingContext.address_full}
      email={agentEmail}
    >
      {step === 'upload' ? (
        <PhotoUploadStep
          listingId={id}
          photos={photos}
          onPhotosChange={setPhotos}
          onContinue={() => setStep('payment')}
        />
      ) : null}

      {step === 'payment' ? <PaymentStep onPaid={handlePaid} /> : null}

      {step === 'generate' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#CFB87C]/15 text-[#CFB87C]'
                    : 'text-[var(--color-text-secondary)] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isBootstrapping ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Loader2 className="size-4 animate-spin" />
              Generating neighborhood guide and agent bio...
            </div>
          ) : null}

          <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
            <div className="min-w-0 flex-1 overflow-hidden rounded-md border border-[var(--color-border)] bg-[#111111]">
              <div className="max-h-[min(70vh,960px)] overflow-y-auto p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  className="min-w-0"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'just_sold' ? (
                    <JustSoldTemplate
                      context={listingContext}
                      agent={agentProfile}
                      heroPhoto={heroPhoto}
                    />
                  ) : null}

                  {activeTab === 'flyer' ? (
                    <ListingFlyerTemplate
                      context={listingContext}
                      agent={agentProfile}
                      heroPhoto={heroPhoto}
                      interiorPhotos={interiorPhotos}
                      description={flyerDescription}
                    />
                  ) : null}

                  {activeTab === 'book' && neighborhoodGuide ? (
                    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-8">
                      <ListingBookTemplate
                        context={listingContext}
                        agent={agentProfile}
                        photos={photos}
                        neighborhoodGuide={neighborhoodGuide}
                        propertyDescription={propertyDescription}
                        agentBio={agentBio}
                      />
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
              </div>
            </div>

            {refinementPages.length > 0 ? (
              <AiRefinementPanel
                activeTab={activeTab}
                pages={refinementPages}
                activePageKey={activePageKey}
                onActivePageChange={setActivePageKey}
                onRefine={handleRefine}
                refineError={refineError}
                onRefineSuccess={() => setRefineError(null)}
                history={refinementHistory}
                onUndo={handleUndo}
                isRefining={isRefining}
              />
            ) : null}
          </div>

          {downloadError ? (
            <p className="text-sm text-red-300" role="alert">
              {downloadError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {activeTab === 'just_sold' ? (
              <Button
                type="button"
                disabled={isDownloading}
                onClick={() => void handleDownloadJustSold()}
                className="rounded-sm bg-[#CFB87C] font-semibold text-[#0a0a0a] hover:bg-[#dcc487]"
              >
                <Download className="mr-2 size-4" />
                Download PNG (1080×1080)
              </Button>
            ) : null}

            {activeTab === 'flyer' ? (
              <>
                <Button
                  type="button"
                  disabled={isDownloading}
                  onClick={() => void handleDownloadFlyerPng()}
                  className="rounded-sm bg-[#CFB87C] font-semibold text-[#0a0a0a] hover:bg-[#dcc487]"
                >
                  <Download className="mr-2 size-4" />
                  Download PNG
                </Button>
                <Button
                  type="button"
                  disabled={isDownloading}
                  variant="outline"
                  onClick={() => void handleDownloadFlyerPdf()}
                  className="border-[var(--color-border)] bg-transparent text-white hover:bg-[#1a1a1a]"
                >
                  Download PDF
                </Button>
              </>
            ) : null}

            {activeTab === 'book' ? (
              <Button
                type="button"
                disabled={isDownloading || !neighborhoodGuide}
                onClick={() => void handleDownloadBookPdf()}
                className="rounded-sm bg-[#CFB87C] font-semibold text-[#0a0a0a] hover:bg-[#dcc487]"
              >
                <Download className="mr-2 size-4" />
                Download full PDF
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </ListingMissionLayout>
  )
}

export default function MarketingAssetsPage() {
  return (
    <ErrorBoundary title="Marketing Assets">
      <MarketingAssetsContent />
    </ErrorBoundary>
  )
}
