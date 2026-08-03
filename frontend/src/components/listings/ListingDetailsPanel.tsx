import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Circle, CircleDot, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { BookingNegotiationPanel } from '@/components/booking/BookingNegotiationPanel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildFormDataFromRows, flattenFormData } from '@/lib/listing-form'
import {
  PIPELINE_STAGES,
  STAGE_GUIDANCE,
  STAGE_LABEL,
  TYPE_LABEL,
  canDeleteListing,
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
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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

  const handleDelete = async () => {
    if (!onDelete || !canDeleteListing(listing.stage)) return
    const confirmed = window.confirm(
      'Delete this draft listing? This cannot be undone.',
    )
    if (!confirmed) return

    setIsDeleting(true)
    setActionError(null)
    try {
      await onDelete(listing.id)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete listing.')
      setIsDeleting(false)
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="space-y-6">
        <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs tracking-widest text-[var(--color-gold)] uppercase">
                Listing Hub
              </p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--color-white)]">
                {listing.address_full ?? 'Unnamed listing'}
              </h3>
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

          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                Type
              </p>
              <p className="text-sm text-[var(--color-white)]">
                {TYPE_LABEL[listing.listing_type]}
              </p>
            </div>
            <div>
              <p className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                MLS
              </p>
              <p className="text-sm text-[var(--color-white)]">
                {listing.mls_number ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                List Price
              </p>
              <p className="text-sm text-[var(--color-white)]">
                {listing.list_price ? `$${listing.list_price.toLocaleString()}` : 'N/A'}
              </p>
            </div>
          </div>

          <div className="rounded-sm border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/5 p-4">
            <p className="text-xs tracking-widest text-[var(--color-gold)] uppercase">
              {STAGE_LABEL[listing.stage]}
            </p>
            <h4 className="mt-1 text-lg font-semibold text-[var(--color-white)]">
              {guidance.headline}
            </h4>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {guidance.description}
            </p>

            {canManage &&
            (listing.stage === 'docs_signed' || listing.stage === 'shoot_booked') ? (
              <BookingNegotiationPanel
                listingId={listing.id}
                listingStage={listing.stage}
                onBookingUpdated={onBookingUpdated}
              />
            ) : null}

            {canManage ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
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
                  <Button
                    asChild
                    className="h-10 rounded-sm bg-[var(--color-gold)] px-5 font-semibold text-[var(--color-black)] hover:bg-[#dcc487]"
                  >
                    <Link to={marketingPath}>Select marketing assets →</Link>
                  </Button>
                ) : null}

                {listing.stage === 'marketing' ? (
                  <Button
                    asChild
                    variant="outline"
                    className="h-10 rounded-sm border-[var(--color-border)] bg-transparent text-[var(--color-white)] hover:bg-[var(--color-gold-dim)]"
                  >
                    <Link to={mlsPath}>Finalize MLS submission →</Link>
                  </Button>
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

            {listing.brokermint_transaction_id ? (
              <div className="mt-5 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
                <h5 className="text-xs tracking-wider text-white uppercase font-semibold">BrokerMint Transaction Documents</h5>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Curated Document Folder: <strong className="text-white">IABS, Listing Agreement, and disclosures</strong>
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={`https://my.brokermint.com/#/transactions/${listing.brokermint_transaction_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-10 px-5 rounded-sm bg-[#1a1a1a] border border-[#2a2a2a] text-xs font-semibold text-[#CFB87C] hover:bg-[#2a2a2a] transition-colors"
                  >
                    Open BrokerMint Transaction ↗
                  </a>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    (ID: <strong className="text-white font-mono">{listing.brokermint_transaction_id}</strong>)
                  </span>
                  
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
            ) : null}

            {actionError ? (
              <p className="mt-3 text-sm text-red-300" role="alert">
                {actionError}
              </p>
            ) : null}
          </div>

          {canManage && canDeleteListing(listing.stage) && onDelete ? (
            <div className="mt-4 flex items-center justify-between rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-white)]">Delete draft</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Remove this unfinished listing from your drafts.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200"
              >
                <Trash2 className="mr-2 size-4" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
          <div className="mb-4">
            <Label className="text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
              AI Description
            </Label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-white)] focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((open) => !open)}
            className="text-xs text-[var(--color-text-secondary)] underline hover:text-[var(--color-gold)]"
          >
            {showAdvanced ? 'Hide' : 'Show'} raw form fields
          </button>

          {showAdvanced ? (
            <div className="mt-3 grid gap-3">
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
                      className="mt-1 h-10 rounded-sm border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-white)]"
                    />
                  </div>
                ))
              )}
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
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
      </div>

      <aside className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
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
    </section>
  )
}
