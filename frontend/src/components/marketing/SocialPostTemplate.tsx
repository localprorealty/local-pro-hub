import { MarketingPreviewFrame } from '@/components/marketing/MarketingPreviewFrame'
import { EXPORT_BODY_TEXT } from '@/lib/export-text-styles'
import type { AgentMarketingProfile, ListingMarketingContext } from '@/lib/marketing-types'

const WIDTH = 1080
const HEIGHT = 1080

export type SocialPostVariant = 'just_sold' | 'under_contract' | 'open_house' | 'new_listing'

export type SocialPostTemplateProps = {
  variant: SocialPostVariant
  context: ListingMarketingContext
  agent: AgentMarketingProfile
  heroPhoto: string | null
  scale?: number
  elementId?: string
}

function SocialPostBody({
  variant,
  context,
  agent,
  heroPhoto,
}: Omit<SocialPostTemplateProps, 'scale' | 'elementId'>) {
  const primaryGold = agent.brand_color_primary || '#C8A951'
  const goldGradient = agent.brand_color_primary
    ? `linear-gradient(90deg, ${agent.brand_color_primary}dd 0%, #FFFFFF 40%, ${agent.brand_color_primary} 70%, #FFFFFF 90%, ${agent.brand_color_primary}dd 100%)`
    : 'linear-gradient(90deg, #96782E 0%, #C8A951 18%, #FBEAAF 36%, #BA973E 58%, #F7E7AC 80%, #96782E 100%)'

  // Format address nicely (e.g. 8911 BONTURA RD, GRANBURY, TEXAS 76049)
  const fullAddress =
    context.address_full ||
    [context.address_line1, context.address_city, context.address_state, context.address_zip]
      .filter(Boolean)
      .join(', ')

  // Price formatting for "new_listing"
  const displayPrice = context.list_price || 'Price upon request'

  return (
    <div className="relative flex size-full flex-col bg-white overflow-hidden" style={{ width: WIDTH, height: HEIGHT }}>
      {/* Top Section: Hero Photo (640px) */}
      <div className="relative shrink-0" style={{ height: 640 }}>
        {/* Photo with overflow hidden */}
        <div className="relative size-full overflow-hidden bg-neutral-900">
          {heroPhoto ? (
            <img src={heroPhoto} alt="Property" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center bg-neutral-800 text-3xl font-light text-neutral-400">
              Property Photo
            </div>
          )}
        </div>

        {/* Gold Metallic Divider Bar (16px) */}
        <div
          className="absolute inset-x-0 bottom-0 z-10"
          style={{
            height: 16,
            background: goldGradient,
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}
        />

        {/* New Listing: Center Price Pill Badge */}
        {variant === 'new_listing' && (
          <div
            className="absolute left-1/2 z-30 flex items-center justify-center rounded-full bg-black px-10 py-2.5 text-white shadow-2xl"
            style={{
              bottom: -22,
              transform: 'translateX(-50%)',
              fontFamily: "'Montserrat', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: 28,
              letterSpacing: '0.04em',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
            }}
          >
            {displayPrice}
          </div>
        )}
      </div>

      {/* Bottom Section: White Card (424px) */}
      <div
        className="relative flex flex-1 items-center justify-between bg-white px-12 py-6"
        style={{ height: 424 }}
      >
        {/* Left Column: Headline, Address & Brokerage */}
        <div className="flex flex-1 flex-col justify-center min-w-0 pr-6" style={{ maxWidth: 600 }}>
          {/* Headline Lockup */}
          {variant === 'under_contract' && (
            <div className="relative leading-none">
              <div
                style={{
                  ...EXPORT_BODY_TEXT,
                  fontFamily: "'Great Vibes', 'Alex Brush', 'Dancing Script', cursive",
                  fontSize: 110,
                  lineHeight: 0.82,
                  color: '#000000',
                  marginLeft: 4,
                  letterSpacing: '0.01em',
                }}
              >
                Under
              </div>
              <div
                style={{
                  ...EXPORT_BODY_TEXT,
                  fontFamily: "'Playfair Display', 'Cinzel', 'Didot', 'Bodoni MT', serif",
                  fontSize: 84,
                  fontWeight: 500,
                  letterSpacing: '0.14em',
                  color: '#000000',
                  marginTop: -10,
                  lineHeight: 1,
                }}
              >
                CONTRACT
              </div>
            </div>
          )}

          {variant === 'open_house' && (
            <div className="relative leading-none">
              <div
                style={{
                  ...EXPORT_BODY_TEXT,
                  fontFamily: "'Great Vibes', 'Alex Brush', 'Dancing Script', cursive",
                  fontSize: 116,
                  lineHeight: 0.82,
                  color: '#000000',
                  marginLeft: 4,
                  letterSpacing: '0.01em',
                }}
              >
                Open
              </div>
              <div
                style={{
                  ...EXPORT_BODY_TEXT,
                  fontFamily: "'Playfair Display', 'Cinzel', 'Didot', 'Bodoni MT', serif",
                  fontSize: 94,
                  fontWeight: 500,
                  letterSpacing: '0.18em',
                  color: '#000000',
                  marginTop: -12,
                  lineHeight: 1,
                }}
              >
                HOUSE
              </div>
            </div>
          )}

          {variant === 'just_sold' && (
            <div className="relative flex items-baseline leading-none">
              <span
                style={{
                  ...EXPORT_BODY_TEXT,
                  fontFamily: "'Great Vibes', 'Alex Brush', 'Dancing Script', cursive",
                  fontSize: 118,
                  lineHeight: 0.82,
                  color: '#000000',
                  marginRight: 16,
                  letterSpacing: '0.01em',
                }}
              >
                Just
              </span>
              <span
                style={{
                  ...EXPORT_BODY_TEXT,
                  fontFamily: "'Playfair Display', 'Cinzel', 'Didot', 'Bodoni MT', serif",
                  fontSize: 98,
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  color: '#000000',
                  lineHeight: 1,
                }}
              >
                SOLD
              </span>
            </div>
          )}

          {variant === 'new_listing' && (
            <div className="relative leading-none">
              <div
                style={{
                  ...EXPORT_BODY_TEXT,
                  fontFamily: "'Great Vibes', 'Alex Brush', 'Dancing Script', cursive",
                  fontSize: 114,
                  lineHeight: 0.82,
                  color: '#000000',
                  marginLeft: 4,
                  letterSpacing: '0.01em',
                }}
              >
                New
              </div>
              <div
                style={{
                  ...EXPORT_BODY_TEXT,
                  fontFamily: "'Playfair Display', 'Cinzel', 'Didot', 'Bodoni MT', serif",
                  fontSize: 86,
                  fontWeight: 500,
                  letterSpacing: '0.14em',
                  color: '#000000',
                  marginTop: -12,
                  lineHeight: 1,
                }}
              >
                LISTING
              </div>
            </div>
          )}

          {/* Address Line */}
          <p
            className="truncate uppercase"
            style={{
              ...EXPORT_BODY_TEXT,
              fontFamily: "'Montserrat', system-ui, sans-serif",
              fontSize: 22,
              fontWeight: 500,
              color: '#1a1a1a',
              letterSpacing: '0.04em',
              marginTop: 18,
            }}
          >
            {fullAddress}
          </p>

          {/* Thin Gold Separator Line */}
          <div
            style={{
              marginTop: 14,
              marginBottom: 20,
              height: 2,
              width: '100%',
              maxWidth: 600,
              backgroundColor: primaryGold,
            }}
          />

          {/* Brokerage Brand Lockup */}
          <div className="flex items-center">
            <span
              style={{
                ...EXPORT_BODY_TEXT,
                fontFamily: "'Montserrat', system-ui, sans-serif",
                fontSize: 21,
                fontWeight: 500,
                letterSpacing: '0.06em',
                color: '#000000',
              }}
            >
              LOCAL
            </span>
            <span
              style={{
                ...EXPORT_BODY_TEXT,
                fontFamily: "'Montserrat', system-ui, sans-serif",
                fontSize: 21,
                fontWeight: 900,
                letterSpacing: '0.06em',
                color: agent.brand_color_secondary || '#000000',
              }}
            >
              PRO
            </span>
            <span
              style={{
                ...EXPORT_BODY_TEXT,
                fontFamily: "'Montserrat', system-ui, sans-serif",
                fontSize: 21,
                fontWeight: 400,
                letterSpacing: '0.18em',
                color: '#000000',
                marginLeft: 8,
              }}
            >
              REALTY
            </span>

            {agent.brand_logo_url && (
              <img
                src={agent.brand_logo_url}
                alt="Brand"
                className="ml-6 max-h-8 max-w-[120px] object-contain"
              />
            )}
          </div>
        </div>

        {/* Right Column: Circular Agent Headshot */}
        <div className="shrink-0 flex items-center justify-center">
          <div
            className="relative overflow-hidden rounded-full shadow-lg"
            style={{
              width: 314,
              height: 314,
              border: `9px solid ${primaryGold}`,
              boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
            }}
          >
            {agent.headshot_url ? (
              <img
                src={agent.headshot_url}
                alt={agent.full_name}
                className="size-full rounded-full object-cover"
              />
            ) : (
              <div
                className="flex size-full items-center justify-center rounded-full"
                style={{
                  background: '#2B2824',
                  color: primaryGold,
                }}
              >
                <span
                  style={{
                    ...EXPORT_BODY_TEXT,
                    fontFamily: "'Montserrat', system-ui, sans-serif",
                    fontSize: 60,
                    fontWeight: 700,
                  }}
                >
                  {agent.full_name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'LP'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SocialPostTemplate({
  variant,
  context,
  agent,
  heroPhoto,
  scale = 0.5,
  elementId,
}: SocialPostTemplateProps) {
  const defaultExportId = `marketing-${variant.replace('_', '-')}`
  const exportId = elementId || defaultExportId

  return (
    <MarketingPreviewFrame
      exportId={exportId}
      width={WIDTH}
      height={HEIGHT}
      exportBg="#FFFFFF"
      previewScale={scale}
      className="flex flex-col bg-white text-black shadow-lg"
      style={{ fontFamily: "'Montserrat', system-ui, sans-serif" }}
    >
      <SocialPostBody
        variant={variant}
        context={context}
        agent={agent}
        heroPhoto={heroPhoto}
      />
    </MarketingPreviewFrame>
  )
}
