import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DeleteDraftButton } from '@/components/listings/DeleteDraftButton'
import {
  PIPELINE_STAGES,
  STAGE_LABEL,
  canDeleteListing,
  formatGoLiveDate,
  listingSpecsFromForm,
  stageIndex,
  type ListingRow,
} from '@/lib/listings'

type PipelineListingCardProps = {
  listing: ListingRow
  index: number
  listingPath: string
  ctaLabel?: string
  agentId?: string | null
  showViewForm?: boolean
  onDraftDeleted?: () => void
}

export function PipelineListingCard({
  listing,
  index,
  listingPath,
  ctaLabel = 'Continue',
  agentId,
  showViewForm = false,
  onDraftDeleted,
}: PipelineListingCardProps) {
  const showDelete =
    canDeleteListing(listing.stage) && !!agentId && listing.agent_id === agentId
  const specs = listingSpecsFromForm(listing.form_data)
  const activeIndex = stageIndex(listing.stage)
  const stageBadgeClass =
    listing.stage === 'draft' || listing.stage === 'docs_pending'
      ? 'border border-[var(--color-border)] bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]'
      : 'bg-[var(--color-gold)] text-[var(--color-black)]'

  return (
    <motion.article
      className="group flex min-h-32 flex-col border border-[var(--color-border)] bg-[var(--color-surface-2)] transition-all hover:border-[var(--color-gold-border)] lg:flex-row"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ x: 6 }}
    >
      <div className="w-1.5 shrink-0 bg-[var(--color-gold)] transition-all group-hover:w-2" />

      <div className="flex flex-[1.5] flex-col justify-center px-6 py-5">
        <h3 className="text-lg font-semibold leading-tight text-[var(--color-white)]">
          {listing.address_full ?? 'Unnamed listing'}
        </h3>
        {(() => {
          const agentObj = Array.isArray(listing.agent) ? listing.agent[0] : listing.agent
          const agentName = agentObj?.full_name
          if (!agentName) return null
          return (
            <p className="text-xs text-[var(--color-gold)] font-medium mt-1">
              Agent: {agentName}
            </p>
          )
        })()}
        <div className="mt-1 flex flex-wrap items-center gap-4 text-[11px] tracking-widest text-[var(--color-text-secondary)] uppercase">
          <span>{specs.beds} BD</span>
          <span>{specs.baths} BA</span>
          <span>{specs.sqft} SQFT</span>
        </div>
        {listing.brokermint_transaction_id ? (
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            BM ID:{' '}
            <a
              href={`https://my.brokermint.com/#/transactions/${listing.brokermint_transaction_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[#CFB87C] hover:underline"
            >
              {listing.brokermint_transaction_id}
            </a>
          </div>
        ) : null}
        <div className="mt-2">
          <span
            className={`px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${stageBadgeClass}`}
          >
            {STAGE_LABEL[listing.stage]}
          </span>
        </div>
      </div>

      <div className="flex flex-[1.2] flex-col justify-center border-t border-[var(--color-border)]/30 px-6 py-5 lg:border-t-0 lg:border-x">
        <div className="mb-2 flex items-center gap-2">
          {PIPELINE_STAGES.map((stage, dotIndex) => (
            <div
              key={stage}
              className={`size-1.5 rounded-full ${
                dotIndex <= activeIndex
                  ? 'bg-[var(--color-gold)]'
                  : 'bg-[var(--color-border)]'
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-[var(--color-white)]">Current phase</p>
        <p className="text-sm font-semibold text-[var(--color-gold)]">
          {STAGE_LABEL[listing.stage]}
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-5 lg:items-end">
        <div className="lg:text-right">
          <p className="text-[11px] tracking-wide text-[var(--color-text-secondary)] uppercase">
            Go Live Date
          </p>
          <p className="text-lg font-semibold text-[var(--color-white)]">
            {formatGoLiveDate(listing.go_live_date)}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-3 lg:justify-end">
          {showDelete ? (
            <DeleteDraftButton
              listingId={listing.id}
              agentId={agentId!}
              variant="icon"
              onDeleted={onDraftDeleted}
            />
          ) : null}
          {showViewForm && (
            <Link
              to={`/listing/${listing.id}/form`}
              className="inline-flex items-center justify-center whitespace-nowrap shrink-0 gap-1.5 text-xs font-bold tracking-wider text-[var(--color-text-secondary)] hover:text-white uppercase border border-[var(--color-border)] px-3.5 py-1.5 rounded-sm hover:border-[var(--color-gold)] transition-colors"
            >
              View Form
            </Link>
          )}
          <Link
            to={listingPath}
            className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-[var(--color-gold)] uppercase transition-all group-hover:gap-3 whitespace-nowrap shrink-0"
          >
            {ctaLabel}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </motion.article>
  )
}
