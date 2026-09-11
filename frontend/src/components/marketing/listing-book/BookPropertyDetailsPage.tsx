import { BookPagePreviewFrame } from '@/components/marketing/listing-book/BookPagePreviewFrame'
import { EXPORT_BODY_TEXT, EXPORT_LABEL_CAPS } from '@/lib/export-text-styles'
import type { AgentMarketingProfile, ListingMarketingContext } from '@/lib/marketing-types'
import { formatSqft } from '@/lib/marketing-data'

type BookPropertyDetailsPageProps = {
  context: ListingMarketingContext
  description: string
  edgePhotos: string[]
  agent?: AgentMarketingProfile
  pageId?: string
}

const PAGE_WIDTH = 900
const PAGE_HEIGHT = 1200

function splitIntoTwoParagraphs(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const paragraphs = trimmed.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
  if (paragraphs.length >= 2) {
    if (paragraphs.length === 2) return paragraphs
    return [paragraphs[0], paragraphs.slice(1).join('\n\n')]
  }

  // Single block of text: split at the sentence boundary closest to midpoint
  const mid = Math.floor(trimmed.length / 2)
  const sentenceEndRegex = /([.!?])\s+/g
  let bestIndex = -1
  let minDiff = Infinity
  let match: RegExpExecArray | null

  while ((match = sentenceEndRegex.exec(trimmed)) !== null) {
    const splitPoint = match.index + match[1].length
    const diff = Math.abs(splitPoint - mid)
    if (diff < minDiff) {
      minDiff = diff
      bestIndex = splitPoint
    }
  }

  if (bestIndex !== -1 && bestIndex > 0 && bestIndex < trimmed.length) {
    const p1 = trimmed.slice(0, bestIndex).trim()
    const p2 = trimmed.slice(bestIndex).trim()
    if (p1 && p2) return [p1, p2]
  }

  // Fallback: split at nearest whitespace boundary near midpoint to avoid cutting words
  const spaceRegex = /\s+/g
  let bestSpaceIndex = -1
  let minSpaceDiff = Infinity
  while ((match = spaceRegex.exec(trimmed)) !== null) {
    const diff = Math.abs(match.index - mid)
    if (diff < minSpaceDiff) {
      minSpaceDiff = diff
      bestSpaceIndex = match.index
    }
  }

  if (bestSpaceIndex !== -1) {
    const p1 = trimmed.slice(0, bestSpaceIndex).trim()
    const p2 = trimmed.slice(bestSpaceIndex).trim()
    if (p1 && p2) return [p1, p2]
  }

  return [trimmed]
}

export function BookPropertyDetailsPage({
  context,
  description,
  edgePhotos,
  agent,
  pageId = 'book-page-details',
}: BookPropertyDetailsPageProps) {
  const leftPhoto = edgePhotos[0]
  const rightPhoto = edgePhotos[1] ?? edgePhotos[0]
  const body = splitIntoTwoParagraphs(description)

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
                <div
                  className="mt-2 h-px"
                  style={{ backgroundColor: agent?.brand_color_primary || '#CFB87C' }}
                />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {rightStats.length > 0 ? (
              rightStats.map((stat) => (
                <div key={stat}>
                  <p style={EXPORT_BODY_TEXT}>{stat}</p>
                  <div
                    className="mt-2 h-px"
                    style={{ backgroundColor: agent?.brand_color_primary || '#CFB87C' }}
                  />
                </div>
              ))
            ) : (
              <div>
                <p style={EXPORT_BODY_TEXT}>PREMIER FINISHES</p>
                <div
                  className="mt-2 h-px"
                  style={{ backgroundColor: agent?.brand_color_primary || '#CFB87C' }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 max-h-[380px] space-y-4 overflow-hidden text-sm leading-relaxed">
          {body.map((para, index) => (
            <p key={index} className="line-clamp-6 overflow-hidden text-ellipsis" style={{ ...EXPORT_BODY_TEXT, color: '#404040' }}>
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
