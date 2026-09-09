import lpLogo from '@/assets/branding/LP_Gold.png'
import { BookPagePreviewFrame } from '@/components/marketing/listing-book/BookPagePreviewFrame'
import { EXPORT_BODY_TEXT, EXPORT_LABEL_CAPS } from '@/lib/export-text-styles'
import type { AgentMarketingProfile, ListingMarketingContext } from '@/lib/marketing-types'

type BookCoverPageProps = {
  context: ListingMarketingContext
  heroPhoto: string | null
  agent?: AgentMarketingProfile
  pageId?: string
}

const PAGE_WIDTH = 900
const PAGE_HEIGHT = 1200

export function BookCoverPage({
  context,
  heroPhoto,
  agent,
  pageId = 'book-page-cover',
}: BookCoverPageProps) {
  return (
    <BookPagePreviewFrame
      pageId={pageId}
      width={PAGE_WIDTH}
      height={PAGE_HEIGHT}
      exportBg="#111827"
      className="relative overflow-hidden bg-neutral-900"
      style={{ fontFamily: "'Montserrat', 'Mont', sans-serif" }}
    >
      <div
        className="absolute inset-5 pointer-events-none z-10"
        style={{ border: '2px solid rgba(255,255,255,0.8)' }}
      />
      <img
        src={lpLogo}
        alt="LocalPRO"
        className="absolute right-8 top-8 h-10 w-auto object-contain drop-shadow-md z-10"
      />
      {heroPhoto ? (
        <img src={heroPhoto} alt="Cover" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-neutral-800" />
      )}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }} />
      <div
        className="absolute bottom-24 left-1/2 w-[80%] -translate-x-1/2 px-8 py-6 text-center text-black z-10"
        style={{
          border: `1px solid ${agent?.brand_color_primary ? agent.brand_color_primary : 'rgba(255,255,255,0.6)'}`,
          backgroundColor: 'rgba(255,255,255,0.95)',
        }}
      >
        <p className="text-4xl font-bold" style={EXPORT_BODY_TEXT}>
          {context.address_line1}
        </p>
        <p className="mt-2 text-lg uppercase" style={EXPORT_LABEL_CAPS}>
          {context.address_city}, {context.address_state}
        </p>
        {agent?.brand_logo_url && (
          <div className="mt-4 flex flex-col items-center">
            <p
              className="mb-1 text-[10px] uppercase tracking-widest text-neutral-500"
              style={EXPORT_LABEL_CAPS}
            >
              Presented by
            </p>
            <img
              src={agent.brand_logo_url}
              alt="Agent Brand"
              className="max-h-8 max-w-[140px] object-contain"
            />
          </div>
        )}
      </div>
    </BookPagePreviewFrame>
  )
}
