import { BookPagePreviewFrame } from '@/components/marketing/listing-book/BookPagePreviewFrame'
import { EXPORT_BODY_TEXT, EXPORT_LABEL_CAPS } from '@/lib/export-text-styles'
import type { ListingMarketingContext } from '@/lib/marketing-types'

type BookCoverPageProps = {
  context: ListingMarketingContext
  heroPhoto: string | null
  pageId?: string
}

const PAGE_WIDTH = 900
const PAGE_HEIGHT = 1200

export function BookCoverPage({
  context,
  heroPhoto,
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
        className="absolute inset-5"
        style={{ border: '2px solid rgba(255,255,255,0.8)' }}
      />
      {heroPhoto ? (
        <img src={heroPhoto} alt="Cover" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-neutral-800" />
      )}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }} />
      <div
        className="absolute bottom-24 left-1/2 w-[80%] -translate-x-1/2 px-8 py-6 text-center text-black"
        style={{
          border: '1px solid rgba(255,255,255,0.6)',
          backgroundColor: 'rgba(255,255,255,0.95)',
        }}
      >
        <p className="text-4xl font-bold" style={EXPORT_BODY_TEXT}>
          {context.address_line1}
        </p>
        <p className="mt-2 text-lg uppercase" style={EXPORT_LABEL_CAPS}>
          {context.address_city}, {context.address_state}
        </p>
      </div>
    </BookPagePreviewFrame>
  )
}
