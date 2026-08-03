import { BookPagePreviewFrame } from '@/components/marketing/listing-book/BookPagePreviewFrame'
import { EXPORT_BODY_TEXT, EXPORT_LABEL_CAPS } from '@/lib/export-text-styles'
import type { ListingMarketingContext } from '@/lib/marketing-types'
import { formatSqft } from '@/lib/marketing-data'

type BookPropertyDetailsPageProps = {
  context: ListingMarketingContext
  description: string
  edgePhotos: string[]
  pageId?: string
}

const PAGE_WIDTH = 900
const PAGE_HEIGHT = 1200

export function BookPropertyDetailsPage({
  context,
  description,
  edgePhotos,
  pageId = 'book-page-details',
}: BookPropertyDetailsPageProps) {
  const leftPhoto = edgePhotos[0]
  const rightPhoto = edgePhotos[1] ?? edgePhotos[0]
  const paragraphs = description.split(/\n\n+/).filter(Boolean)
  const body =
    paragraphs.length >= 2
      ? paragraphs
      : [
          description.slice(0, Math.ceil(description.length / 2)),
          description.slice(Math.ceil(description.length / 2)),
        ].filter(Boolean)

  const leftStats = [
    `${context.bedrooms_total} BEDROOMS`,
    `${context.bathrooms_display} BATHROOMS`,
    `${formatSqft(context.living_area_sqft)} SQFT`,
  ]
  const rightStats = [
    ...(context.has_game_room ? ['GAMEROOM'] : []),
    ...(context.has_pool ? ['POOL & SPA'] : []),
  ]

  return (
    <BookPagePreviewFrame
      pageId={pageId}
      width={PAGE_WIDTH}
      height={PAGE_HEIGHT}
      exportBg="#ffffff"
      className="relative flex overflow-hidden bg-white text-black"
      style={{ fontFamily: "'Montserrat', 'Mont', sans-serif" }}
    >
      <div className="w-[200px] shrink-0">
        {leftPhoto ? (
          <img src={leftPhoto} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-neutral-300" />
        )}
      </div>

      <div className="flex flex-1 flex-col px-8 py-10 text-center">
        <p className="text-[120px] font-bold leading-none" style={EXPORT_BODY_TEXT}>
          {context.street_number || context.address_line1.split(' ')[0]}
        </p>
        <p className="mt-2 text-2xl uppercase" style={EXPORT_LABEL_CAPS}>
          {context.street_name || context.address_line1.replace(/^\S+\s*/, '')}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-8 text-left text-sm font-semibold uppercase">
          <div className="space-y-4">
            {leftStats.map((stat) => (
              <div key={stat}>
                <p style={EXPORT_BODY_TEXT}>{stat}</p>
                <div className="mt-2 h-px bg-[#CFB87C]" />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {rightStats.length > 0 ? (
              rightStats.map((stat) => (
                <div key={stat}>
                  <p style={EXPORT_BODY_TEXT}>{stat}</p>
                  <div className="mt-2 h-px bg-[#CFB87C]" />
                </div>
              ))
            ) : (
              <div>
                <p style={EXPORT_BODY_TEXT}>PREMIER FINISHES</p>
                <div className="mt-2 h-px bg-[#CFB87C]" />
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-4 text-sm leading-relaxed">
          {body.map((para, index) => (
            <p key={index} style={{ ...EXPORT_BODY_TEXT, color: '#404040' }}>
              {para}
            </p>
          ))}
        </div>

        <div className="mt-auto pt-6 text-xs uppercase" style={{ ...EXPORT_LABEL_CAPS, color: '#525252' }}>
          {context.school_district ? <p>{context.school_district}</p> : null}
          <p className="mt-1">
            {[context.elementary_school, context.middle_school, context.high_school]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      <div className="w-[200px] shrink-0">
        {rightPhoto ? (
          <img src={rightPhoto} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-neutral-300" />
        )}
      </div>
    </BookPagePreviewFrame>
  )
}
