import { BookPagePreviewFrame } from '@/components/marketing/listing-book/BookPagePreviewFrame'
import { EXPORT_BODY_TEXT, EXPORT_LABEL_CAPS } from '@/lib/export-text-styles'
import type {
  AgentMarketingProfile,
  ListingMarketingContext,
  NeighborhoodGuide,
} from '@/lib/marketing-types'

type BookNeighborhoodPageProps = {
  context: ListingMarketingContext
  guide: NeighborhoodGuide
  neighborhoodPhoto: string | null
  agent?: AgentMarketingProfile
  pageId?: string
}

const PAGE_WIDTH = 900
const PAGE_HEIGHT = 1200

export function BookNeighborhoodPage({
  context,
  guide,
  neighborhoodPhoto,
  agent,
  pageId = 'book-page-neighborhood',
}: BookNeighborhoodPageProps) {
  const city = context.address_city || 'North Texas'
  const brandColor = agent?.brand_color_primary || '#CFB87C'

  return (
    <BookPagePreviewFrame
      pageId={pageId}
      width={PAGE_WIDTH}
      height={PAGE_HEIGHT}
      exportBg="#ffffff"
      className="overflow-hidden bg-white text-black"
      style={{ fontFamily: "'Montserrat', 'Mont', sans-serif" }}
    >
      <div className="relative" style={{ height: 420 }}>
        {neighborhoodPhoto ? (
          <img src={neighborhoodPhoto} alt="Neighborhood" className="size-full object-cover" />
        ) : (
          <div
            className="size-full"
            style={{
              background:
                'linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 50%, #CFB87C 100%)',
            }}
          />
        )}
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white">
          <p className="text-sm font-semibold" style={EXPORT_LABEL_CAPS}>
            LET&apos;S EXPLORE {city.toUpperCase()}, TEXAS
          </p>
          <p
            className="mt-3 text-6xl text-white"
            style={{ ...EXPORT_BODY_TEXT, fontFamily: "'Dancing Script', cursive" }}
          >
            Welcome Home
          </p>
        </div>
      </div>

      <div className="max-h-[780px] space-y-4 overflow-hidden px-8 py-6 text-sm leading-relaxed">
        <p className="line-clamp-3 overflow-hidden text-ellipsis" style={{ ...EXPORT_BODY_TEXT, color: '#262626' }}>
          {guide.intro}
        </p>

        <div
          className="grid grid-cols-2 gap-6 border-b border-neutral-200 py-4"
          style={{ borderTop: `2px solid ${brandColor}` }}
        >
          <div>
            <p className="mb-2 text-xs font-bold" style={EXPORT_LABEL_CAPS}>
              Commute Times
            </p>
            <ul className="space-y-1">
              {guide.commute_times.slice(0, 3).map((item) => (
                <li key={item.destination} className="truncate" style={EXPORT_BODY_TEXT}>
                  <span className="font-semibold">{item.destination}:</span> {item.time}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold" style={EXPORT_LABEL_CAPS}>
              Boundaries
            </p>
            <p className="line-clamp-2 overflow-hidden text-ellipsis" style={EXPORT_BODY_TEXT}>
              {guide.boundaries}
            </p>
            <p className="mt-3 text-xs font-bold" style={EXPORT_LABEL_CAPS}>
              Nearby
            </p>
            <p className="mt-1 line-clamp-2 overflow-hidden text-ellipsis" style={EXPORT_BODY_TEXT}>
              {guide.nearby_neighborhoods}
            </p>
          </div>
        </div>

        {(
          [
            ['What to Expect', guide.what_to_expect],
            ['The Lifestyle', guide.the_lifestyle],
            ['Unexpected Appeal', guide.unexpected_appeal],
            ['The Market', guide.the_market],
            ["You'll Fall in Love", guide.youll_fall_in_love],
          ] as const
        ).map(([heading, text]) => (
          <div key={heading}>
            <p className="text-xs font-bold" style={{ ...EXPORT_LABEL_CAPS, color: brandColor }}>
              {heading}
            </p>
            <p className="mt-1 line-clamp-2 overflow-hidden text-ellipsis" style={EXPORT_BODY_TEXT}>
              {text}
            </p>
          </div>
        ))}
      </div>
    </BookPagePreviewFrame>
  )
}
