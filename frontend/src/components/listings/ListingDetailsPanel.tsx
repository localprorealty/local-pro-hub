import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export type ListingHubTab = 'action' | 'photos' | 'share' | 'docs' | 'details'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { BookingNegotiationPanel } from '@/components/booking/BookingNegotiationPanel'
import { ListingIdBadge } from '@/components/listings/ListingIdBadge'
import { ListingImageLibrary } from '@/components/listings/ListingImageLibrary'
import {
  fetchListingShareStatus,
  generateListingShareLink,
  updateListingShareStatus,
  fetchListingComments,
  deleteListingComment,
  markListingCommentsRead,
  type ShareLinkStatus,
  type PublicComment,
} from '@/lib/public-share'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildFormDataFromRows, flattenFormData } from '@/lib/listing-form'
import {
  PIPELINE_STAGES,
  STAGE_GUIDANCE,
  STAGE_LABEL,
  TYPE_LABEL,
  canDeleteListing,
  generateListingDescription,
  getListingFormPath,
  getGoLivePath,
  getMarketingPath,
  getMlsPath,
  getPhotographyPath,
  getNextStage,
  type ListingRow,
  type ListingStage,
  type ListingUpdatePayload,
} from '@/lib/listings'

type ListingDetailsPanelProps = {
  listing: ListingRow
  canManage?: boolean
  onClose: () => void
  onSave: (listingId: string, payload: ListingUpdatePayload) => Promise<void>
  onAdvanceStage?: (listingId: string, nextStage: ListingStage) => Promise<void>
  onDelete?: (listingId: string) => Promise<void>
  onBookingUpdated?: () => void
}

export function ListingDetailsPanel({
  listing,
  canManage = false,
  onClose,
  onSave,
  onAdvanceStage,
  onDelete,
  onBookingUpdated,
}: ListingDetailsPanelProps) {
  const [description, setDescription] = useState(listing.description_generated ?? '')
  const [fieldRows, setFieldRows] = useState(() => flattenFormData(listing.form_data))
  const [isSaving, setIsSaving] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Public Share Link & Comments State
  const [shareStatus, setShareStatus] = useState<ShareLinkStatus | null>(null)
  const [loadingShareStatus, setLoadingShareStatus] = useState(false)
  const [togglingShare, setTogglingShare] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  const [comments, setComments] = useState<PublicComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null)
  const [commentDeleteError, setCommentDeleteError] = useState<string | null>(null)
  const [showDeleteDraftConfirm, setShowDeleteDraftConfirm] = useState(false)

  useEffect(() => {
    if (!listing.id) return
    let isMounted = true

    setLoadingShareStatus(true)
    fetchListingShareStatus(listing.id)
      .then((status) => {
        if (isMounted) setShareStatus(status)
      })
      .catch(() => {
        if (isMounted) {
          setShareStatus({
            token: null,
            is_publicly_shared: false,
            share_url: null,
          })
        }
      })
      .finally(() => {
        if (isMounted) setLoadingShareStatus(false)
      })

    setLoadingComments(true)
    fetchListingComments(listing.id)
      .then((list) => {
        if (isMounted) setComments(list)
      })
      .catch(() => {
        if (isMounted) setComments([])
      })
      .finally(() => {
        if (isMounted) setLoadingComments(false)
      })

    return () => {
      isMounted = false
    }
  }, [listing.id])

  const handleToggleShare = async () => {
    if (!listing.id) return
    setTogglingShare(true)
    setShareError(null)
    try {
      if (!shareStatus?.token) {
        const res = await generateListingShareLink(listing.id)
        setShareStatus(res)
      } else {
        const nextShared = !shareStatus.is_publicly_shared
        const res = await updateListingShareStatus(listing.id, nextShared)
        setShareStatus(res)
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to update share link')
    } finally {
      setTogglingShare(false)
    }
  }

  const confirmRegenerateToken = async () => {
    if (!listing.id) return
    setTogglingShare(true)
    setShareError(null)
    try {
      const res = await updateListingShareStatus(listing.id, true, true)
      setShareStatus(res)
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to regenerate link')
    } finally {
      setTogglingShare(false)
    }
  }

  const handleCopyLink = () => {
    if (!shareStatus?.token) return
    const fullUrl = `${window.location.origin}/share/${shareStatus.token}`
    navigator.clipboard.writeText(fullUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return
    const commentId = commentToDelete
    setDeletingCommentId(commentId)
    try {
      await deleteListingComment(listing.id, commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (err) {
      setCommentDeleteError(err instanceof Error ? err.message : 'Failed to delete comment')
    } finally {
      setDeletingCommentId(null)
      setCommentToDelete(null)
    }
  }

  const handleGenerateDescription = async () => {
    setIsGeneratingDescription(true)
    setGenerateError(null)
    try {
      const res = await generateListingDescription(listing.id)
      setDescription(res.description)
      setSaveMessage('Description generated and saved.')
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : 'Description generation failed.',
      )
    } finally {
      setIsGeneratingDescription(false)
    }
  }

  const guidance = STAGE_GUIDANCE[listing.stage]
  const nextStage = getNextStage(listing.stage)
  const formPath = getListingFormPath(listing.id)
  const goLivePath = getGoLivePath(listing.id)
  const marketingPath = getMarketingPath(listing.id)
  const mlsPath = getMlsPath(listing.id)
  const photographyPath = getPhotographyPath(listing.id)

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    setSaveMessage(null)
    try {
      await onSave(listing.id, {
        description_generated: description,
        form_data: buildFormDataFromRows(fieldRows),
      })
      setSaveMessage('Saved successfully.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAdvance = async () => {
    if (!onAdvanceStage || !nextStage) return
    setIsAdvancing(true)
    setActionError(null)
    try {
      await onAdvanceStage(listing.id, nextStage)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not advance stage.')
    } finally {
      setIsAdvancing(false)
    }
  }

  const confirmDeleteDraft = async () => {
    if (!onDelete || !canDeleteListing(listing.stage)) return
    setIsDeleting(true)
    setActionError(null)
    try {
      await onDelete(listing.id)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete listing.')
      setIsDeleting(false)
    }
  }

  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: ListingHubTab =
    tabParam === 'photos' || tabParam === 'share' || tabParam === 'docs' || tabParam === 'details'
      ? tabParam
      : 'action'

  const handleSelectTab = (tab: ListingHubTab) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', tab)
    setSearchParams(nextParams, { replace: true })
  }

  useEffect(() => {
    if (activeTab === 'share' && listing.id) {
      void markListingCommentsRead(listing.id).then(() => {
        window.dispatchEvent(new CustomEvent('comments-read'))
      })
    }
  }, [activeTab, listing.id])

  const TABS: { id: ListingHubTab; label: string; icon: typeof Sparkles }[] = [
    { id: 'action', label: 'Stage Action', icon: Sparkles },
    { id: 'photos', label: 'Photos & Media', icon: Camera },
    { id: 'share', label: 'Client Share', icon: Globe },
    { id: 'docs', label: 'Documents', icon: FileText },
    { id: 'details', label: 'Property Copy & Details', icon: FileText },
  ]

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="space-y-6">
        {/* Persistent Top Summary Card */}
        <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs tracking-widest text-[var(--color-gold)] uppercase">
                Listing Hub
              </p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--color-white)]">
                {listing.address_full ?? 'Unnamed listing'}
              </h3>
              <div className="mt-1.5">
                <ListingIdBadge id={listing.id} />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-sm border-[var(--color-border)] bg-transparent text-[var(--color-white)] hover:bg-[var(--color-gold-dim)]"
              onClick={onClose}
            >
              Back to dashboard
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                Type
              </p>
              <p className="text-sm font-medium text-[var(--color-white)]">
                {TYPE_LABEL[listing.listing_type]}
              </p>
            </div>
            <div>
              <p className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                MLS
              </p>
              <p className="text-sm font-medium text-[var(--color-white)]">
                {listing.mls_number ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                List Price
              </p>
              <p className="text-sm font-medium text-[var(--color-white)]">
                {listing.list_price ? `$${listing.list_price.toLocaleString()}` : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex border-b border-[var(--color-border)] gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold tracking-wider uppercase whitespace-nowrap transition-all border-b-2 -mb-px ${
                  isActive
                    ? 'border-[var(--color-gold)] text-[var(--color-gold)] bg-[var(--color-gold)]/5'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-white hover:border-zinc-700'
                }`}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
                {tab.id === 'share' && comments.length > 0 ? (
                  <span className="rounded-full bg-[var(--color-gold)]/20 px-1.5 py-0.2 text-[10px] font-bold text-[var(--color-gold)] border border-[var(--color-gold)]/30">
                    {comments.length}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* Tab 1: Stage Action */}
        {activeTab === 'action' && (
          <div className="space-y-6">
            <div className="rounded-sm border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/5 p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs tracking-widest text-[var(--color-gold)] uppercase font-semibold">
                  Current Phase: {STAGE_LABEL[listing.stage]}
                </p>
              </div>
              <h4 className="mt-1 text-lg font-semibold text-[var(--color-white)]">
                {guidance.headline}
              </h4>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {guidance.description}
              </p>

              {canManage &&
              (listing.stage === 'docs_signed' || listing.stage === 'shoot_booked') ? (
                <div className="mt-4 border-t border-[var(--color-gold)]/20 pt-4">
                  <BookingNegotiationPanel
                    listingId={listing.id}
                    listingStage={listing.stage}
                    onBookingUpdated={onBookingUpdated}
                  />
                </div>
              ) : null}

              {canManage ? (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {listing.stage === 'draft' ? (
                    <Button
                      asChild
                      className="h-10 rounded-sm bg-[var(--color-gold)] px-5 font-semibold text-[var(--color-black)] hover:bg-[#dcc487]"
                    >
                      <Link to={formPath}>Continue NTREIS form →</Link>
                    </Button>
                  ) : null}

                  {listing.stage === 'docs_signed' ? (
                    <Button
                      asChild
                      className="h-10 rounded-sm bg-[var(--color-gold)] px-5 font-semibold text-[var(--color-black)] hover:bg-[#dcc487]"
                    >
                      <Link to={photographyPath}>Book photography →</Link>
                    </Button>
                  ) : null}

                  {listing.stage === 'marketing' ? (
                    <>
                      <Button
                        asChild
                        className="h-10 rounded-sm bg-[var(--color-gold)] px-5 font-semibold text-[var(--color-black)] hover:bg-[#dcc487]"
                      >
                        <Link to={marketingPath}>Select marketing assets →</Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="h-10 rounded-sm border-[var(--color-border)] bg-transparent text-[var(--color-white)] hover:bg-[var(--color-gold-dim)]"
                      >
                        <Link to={mlsPath}>Finalize MLS submission →</Link>
                      </Button>
                    </>
                  ) : null}

                  {listing.stage === 'mls_submitted' ? (
                    <Button
                      asChild
                      className="h-10 rounded-sm bg-[var(--color-gold)] px-5 font-semibold text-[var(--color-black)] hover:bg-[#dcc487]"
                    >
                      <Link to={goLivePath}>Go Live →</Link>
                    </Button>
                  ) : null}

                  {listing.stage !== 'draft' && listing.stage !== 'closed' ? (
                    <Button
                      asChild
                      variant="outline"
                      className="h-10 rounded-sm border-[var(--color-border)] bg-transparent text-[var(--color-white)] hover:bg-[var(--color-gold-dim)]"
                    >
                      <Link to={formPath}>Edit NTREIS form</Link>
                    </Button>
                  ) : null}

                  {canManage && guidance.advanceLabel && nextStage && onAdvanceStage ? (
                    <Button
                      type="button"
                      onClick={() => void handleAdvance()}
                      disabled={isAdvancing}
                      className="h-10 rounded-sm bg-[var(--color-gold)] px-5 font-semibold text-[var(--color-black)] hover:bg-[#dcc487] disabled:opacity-60"
                    >
                      {isAdvancing ? 'Updating...' : guidance.advanceLabel}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {actionError ? (
                <p className="mt-3 text-sm text-red-300" role="alert">
                  {actionError}
                </p>
              ) : null}
            </div>

            {canManage && canDeleteListing(listing.stage) && onDelete ? (
              <div className="flex items-center justify-between rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-white)]">Delete draft</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Remove this unfinished listing from your drafts.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteDraftConfirm(true)}
                  disabled={isDeleting}
                  className="border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                >
                  <Trash2 className="mr-2 size-4" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {/* Tab 2: Photos & Media */}
        {activeTab === 'photos' && (
          <div className="space-y-6">
            {(listing.stage === 'draft' || listing.stage === 'docs_pending') && (
              <div className="flex items-start gap-3 rounded-sm border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 p-4 text-xs text-[var(--color-gold)]">
                <Info className="size-4 shrink-0 mt-0.5" />
                <p>
                  Photos are typically booked after docs are signed, but you can upload early drafts anytime.
                </p>
              </div>
            )}
            <ListingImageLibrary listingId={listing.id} canManage={canManage} />
          </div>
        )}

        {/* Tab 3: Client Share & Feedback */}
        {activeTab === 'share' && (
          <div className="space-y-6">
            {(listing.stage === 'draft' || listing.stage === 'docs_pending') && (
              <div className="flex items-start gap-3 rounded-sm border border-blue-500/30 bg-blue-500/10 p-4 text-xs text-blue-300">
                <Info className="size-4 shrink-0 mt-0.5" />
                <p>
                  Public sharing is typically activated once photos are booked and approved. You can generate a preview link now if needed, but client feedback features activate during the Marketing stage.
                </p>
              </div>
            )}

            {/* Public Listing Share Link Card */}
            <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded bg-[#241e15] text-[#CFB87C]">
                    <Globe className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold tracking-wider text-[var(--color-white)] uppercase">
                      Public Listing Share Link
                    </h4>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                      Read-only presentation for clients & prospective buyers (no login required)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                      shareStatus?.is_publicly_shared
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                        : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/40'
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        shareStatus?.is_publicly_shared ? 'bg-emerald-400' : 'bg-zinc-500'
                      }`}
                    />
                    {shareStatus?.is_publicly_shared ? 'Publicly Active' : 'Private (Inactive)'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Anyone with this link can view the pipeline milestone progress, property specifications,
                  high-res photos, and leave direct feedback. Sensitive documents, BrokerMint IDs, seller
                  contacts, and access codes are strictly excluded.
                </p>

                {shareError ? (
                  <p className="text-xs text-red-400" role="alert">
                    {shareError}
                  </p>
                ) : null}

                {loadingShareStatus ? (
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Checking share link status...</span>
                  </div>
                ) : shareStatus?.token ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/share/${shareStatus.token}`}
                        className="h-9 flex-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs text-stone-300 font-mono select-all focus:outline-none focus:border-[var(--color-gold)]"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyLink}
                        className="h-9 border-[var(--color-gold-border)] bg-transparent text-xs text-[var(--color-gold)] hover:bg-[var(--color-gold-dim)]"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="mr-1.5 size-3.5 text-emerald-400" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1.5 size-3.5" />
                            Copy Link
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-9 border-[var(--color-border)] bg-transparent text-xs text-white hover:bg-[var(--color-surface)]"
                      >
                        <a
                          href={`/share/${shareStatus.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5"
                        >
                          <ExternalLink className="size-3.5" />
                          View Page
                        </a>
                      </Button>
                    </div>

                    {canManage ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleToggleShare()}
                          disabled={togglingShare}
                          className={`h-8 text-xs ${
                            shareStatus.is_publicly_shared
                              ? 'border-amber-700/50 text-amber-300 hover:bg-amber-950/20'
                              : 'border-emerald-700/50 text-emerald-300 hover:bg-emerald-950/20'
                          }`}
                        >
                          {togglingShare ? (
                            <>
                              <Loader2 className="mr-1.5 size-3 animate-spin" />
                              Updating...
                            </>
                          ) : shareStatus.is_publicly_shared ? (
                            'Deactivate Public Link'
                          ) : (
                            'Activate Public Link'
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowRegenerateConfirm(true)}
                          disabled={togglingShare}
                          className="h-8 text-[11px] text-[var(--color-text-secondary)] hover:text-red-300 hover:bg-red-950/10"
                        >
                          <RefreshCw className="mr-1.5 size-3" />
                          Regenerate Secret Token
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : canManage ? (
                  <div>
                    <Button
                      type="button"
                      onClick={() => void handleToggleShare()}
                      disabled={togglingShare}
                      className="h-9 rounded-sm bg-[var(--color-gold)] px-4 text-xs font-semibold text-black hover:bg-[#dcc487] disabled:opacity-60"
                    >
                      {togglingShare ? (
                        <>
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Globe className="mr-1.5 size-3.5" />
                          Create Public Share Link
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-secondary)] italic">
                    No public share link has been created for this listing yet.
                  </p>
                )}
              </div>
            </div>

            {/* Client & Visitor Feedback (Comments Moderation) Card */}
            <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded bg-[#241e15] text-[#CFB87C]">
                    <MessageSquare className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold tracking-wider text-[var(--color-white)] uppercase">
                      Client & Visitor Feedback
                    </h4>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                      Feedback and questions submitted from the public listing share page
                    </p>
                  </div>
                </div>

                <span className="rounded bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-mono text-[var(--color-gold)] border border-[var(--color-border)]">
                  {comments.length}
                </span>
              </div>

              {loadingComments ? (
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-3">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Loading feedback...</span>
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)] italic py-2">
                  No feedback comments received yet. Share the link with your clients to receive direct input.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {comments.map((comment) => {
                    let timeAgo = 'recently'
                    try {
                      timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })
                    } catch {
                      timeAgo = ''
                    }

                    return (
                      <div
                        key={comment.id}
                        className="flex items-start justify-between gap-3 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">
                              {comment.commenter_name}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-secondary)]">
                              {timeAgo}
                            </span>
                          </div>
                          <p className="text-xs text-stone-300 whitespace-pre-wrap leading-relaxed">
                            {comment.comment_text}
                          </p>
                        </div>

                        {canManage ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setCommentToDelete(comment.id)}
                            disabled={deletingCommentId === comment.id}
                            className="h-7 w-7 p-0 text-stone-400 hover:text-red-400 hover:bg-red-950/20"
                            title="Delete comment"
                          >
                            {deletingCommentId === comment.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </Button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Documents (BrokerMint) */}
        {activeTab === 'docs' && (
          <div className="space-y-6">
            {listing.brokermint_transaction_id ? (
              <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 space-y-4">
                <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-4">
                  <div>
                    <h4 className="text-sm font-semibold tracking-wider text-white uppercase">
                      BrokerMint Transaction Documents
                    </h4>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      Curated Document Folder: <strong className="text-white">IABS, Listing Agreement, and disclosures</strong>
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[var(--color-gold)] bg-[#1a1a1a] px-2.5 py-1 rounded border border-[#2a2a2a]">
                    ID: {listing.brokermint_transaction_id}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <a
                    href={`https://my.brokermint.com/#/transactions/${listing.brokermint_transaction_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-10 px-5 rounded-sm bg-[#1a1a1a] border border-[#2a2a2a] text-xs font-semibold text-[#CFB87C] hover:bg-[#2a2a2a] transition-colors"
                  >
                    Open BrokerMint Transaction ↗
                  </a>

                  {canManage && listing.stage === 'docs_pending' && (
                    <Button
                      type="button"
                      onClick={() => void handleAdvance()}
                      disabled={isAdvancing}
                      className="h-10 rounded-sm bg-[var(--color-gold)] px-5 text-xs font-bold text-black uppercase tracking-wider hover:bg-[#dcc487] disabled:opacity-60"
                    >
                      {isAdvancing ? 'Marking...' : 'Mark Docs Signed ✓'}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-sm border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] p-8 text-center text-xs text-[var(--color-text-secondary)]">
                <FileText className="mx-auto size-8 text-stone-500 mb-2" />
                <p className="font-medium text-white">No BrokerMint Transaction Connected Yet</p>
                <p className="mt-1">
                  A BrokerMint transaction and document checklist are automatically initiated once the NTREIS form is submitted.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Property Copy & Details */}
        {activeTab === 'details' && (
          <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                  AI Description
                </Label>
                {canManage ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleGenerateDescription()}
                    disabled={isGeneratingDescription}
                    className="h-7 border-[var(--color-gold-border)] bg-transparent px-2.5 text-xs text-[var(--color-gold)] hover:bg-[var(--color-gold-dim)] hover:text-[var(--color-gold)] disabled:opacity-50"
                  >
                    {isGeneratingDescription ? (
                      <>
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        Generating...
                      </>
                    ) : description.trim() ? (
                      <>
                        <Sparkles className="mr-1.5 size-3.5" />
                        Regenerate
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1.5 size-3.5" />
                        Generate Description
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
              {generateError ? (
                <p className="mt-2 text-xs text-red-400" role="alert">
                  {generateError}
                </p>
              ) : null}
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-2 min-h-28 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-white)] focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
              />
            </div>

            {/* Raw Form Fields Collapsible Accordion */}
            <div className="border-t border-[var(--color-border)] pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced((open) => !open)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] transition-colors"
              >
                {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                <span>{showAdvanced ? 'Hide' : 'Show'} raw NTREIS form fields ({fieldRows.length})</span>
              </button>

              {showAdvanced ? (
                <div className="mt-4 grid gap-3 max-h-96 overflow-y-auto pr-1">
                  {fieldRows.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      No form data yet for this listing.
                    </p>
                  ) : (
                    fieldRows.map((field, index) => (
                      <div key={field.key}>
                        <Label className="text-[11px] text-[var(--color-text-secondary)]">
                          {field.key}
                        </Label>
                        <Input
                          value={field.value}
                          onChange={(event) =>
                            setFieldRows((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, value: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          className="mt-1 h-9 rounded-sm border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-white)] text-xs font-mono"
                        />
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3 border-t border-[var(--color-border)] pt-4">
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="h-10 rounded-sm bg-[var(--color-gold)] px-5 font-semibold text-[var(--color-black)] hover:bg-[#dcc487] disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </Button>
              {saveMessage ? (
                <p className="text-sm text-emerald-300">{saveMessage}</p>
              ) : null}
              {saveError ? <p className="text-sm text-red-300">{saveError}</p> : null}
            </div>
          </div>
        )}
      </div>

      {/* Right-hand Column: Pipeline Sidebar (Unchanged) */}
      <aside className="h-fit sticky top-24 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
        <h4 className="mb-4 text-xs tracking-widest text-[var(--color-gold)] uppercase">
          Pipeline
        </h4>
        <ul className="space-y-3">
          {PIPELINE_STAGES.map((stage) => {
            const active = stage === listing.stage
            return (
              <li
                key={stage}
                className={`flex items-center gap-2 text-sm ${
                  active
                    ? 'font-semibold text-[var(--color-gold)]'
                    : 'text-[var(--color-text-secondary)]'
                }`}
              >
                {active ? (
                  <CircleDot className="size-4" aria-hidden />
                ) : (
                  <Circle className="size-4" aria-hidden />
                )}
                {STAGE_LABEL[stage]}
              </li>
            )
          })}
        </ul>
      </aside>

      {/* Confirm Regenerate Client Share Token Dialog (Gold variant) */}
      <ConfirmDialog
        open={showRegenerateConfirm}
        onOpenChange={setShowRegenerateConfirm}
        title="Regenerate client share link?"
        description="Regenerating this link will immediately invalidate any existing links you have shared with clients. Anyone with the old link will no longer be able to access the page."
        confirmLabel="Regenerate link"
        variant="gold"
        isLoading={togglingShare}
        onConfirm={confirmRegenerateToken}
      />

      {/* Confirm Delete Comment Dialog (Destructive) */}
      <ConfirmDialog
        open={Boolean(commentToDelete)}
        onOpenChange={(open) => !open && setCommentToDelete(null)}
        title="Delete comment?"
        description="Are you sure you want to delete this comment? This cannot be undone."
        confirmLabel="Delete comment"
        variant="destructive"
        isLoading={Boolean(deletingCommentId)}
        onConfirm={confirmDeleteComment}
      />

      {/* Comment Delete Error Notice (Single OK button) */}
      <ConfirmDialog
        open={Boolean(commentDeleteError)}
        onOpenChange={(open) => !open && setCommentDeleteError(null)}
        title="Comment deletion failed"
        description={commentDeleteError}
        confirmLabel="OK"
        variant="gold"
        singleButton
      />

      {/* Confirm Delete Draft Listing Dialog (Destructive) */}
      <ConfirmDialog
        open={showDeleteDraftConfirm}
        onOpenChange={setShowDeleteDraftConfirm}
        title="Delete draft listing?"
        description="This draft listing will be permanently removed. This cannot be undone."
        confirmLabel="Delete draft"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={confirmDeleteDraft}
      />
    </section>
  )
}
