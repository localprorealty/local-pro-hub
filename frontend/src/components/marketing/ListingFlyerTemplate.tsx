import lpLogo from '@/assets/branding/LP_Gold.png'
import { MarketingPreviewFrame } from '@/components/marketing/MarketingPreviewFrame'
import { EXPORT_BODY_TEXT, exportNowrap } from '@/lib/export-text-styles'
import type { AgentMarketingProfile, ListingMarketingContext } from '@/lib/marketing-types'
import { formatSqft } from '@/lib/marketing-data'

const WIDTH = 816
const HEIGHT = 1056

type ListingFlyerTemplateProps = {
  context: ListingMarketingContext
  agent: AgentMarketingProfile
  heroPhoto: string | null
  interiorPhotos: string[]
  description: string
  scale?: number
  elementId?: string
}

type FlyerBodyProps = Omit<ListingFlyerTemplateProps, 'scale' | 'elementId'>

function FlyerBody({
  context,
  agent,
  heroPhoto,
  interiorPhotos,
  description,
}: FlyerBodyProps) {
  const displayDescription = description.slice(0, 600)
  const stats = [
    `${context.bedrooms_total} BED`,
    `${context.bathrooms_display} BATH`,
    `${formatSqft(context.living_area_sqft)} SQ\u00A0FT`,
    ...(context.has_pool ? ['POOL'] : []),
    context.list_price,
  ]

  const collage = interiorPhotos.slice(0, 3)
  while (collage.length < 3) collage.push('')

  return (
    <>
      <div className="relative shrink-0" style={{ height: HEIGHT * 0.4 }}>
        {heroPhoto ? (
          <img src={heroPhoto} alt="Property" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-neutral-200 text-neutral-500">
            Hero photo
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%, transparent 100%)',
          }}
        />
        <img src={lpLogo} alt="LocalPRO" className="absolute right-6 top-6 h-12 w-auto" />
        <div className="absolute bottom-6 left-6 text-white">
          <p className="text-[72px] font-black leading-none" style={EXPORT_BODY_TEXT}>
            NEW
          </p>
          <p className="text-[72px] font-black leading-none" style={EXPORT_BODY_TEXT}>
            LISTING
          </p>
        </div>
      </div>

      <div className="shrink-0 px-8 pt-6">
        <p
          className="text-center text-[22px] font-bold uppercase text-black"
          style={EXPORT_BODY_TEXT}
        >
          {context.address_line1}
        </p>
        <p
          className="mt-1 text-center text-sm uppercase"
          style={{ ...EXPORT_BODY_TEXT, color: '#525252' }}
        >
          {context.address_city}, {context.address_state} {context.address_zip}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm font-semibold text-neutral-700">
          {stats.map((stat, index) => (
            <span key={`${stat}-${index}`} className="inline-flex items-center gap-3">
              {index > 0 ? <span style={{ color: '#d4d4d4' }}>|</span> : null}
              <span style={exportNowrap()}>{stat}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 px-10 py-6">
        <p
          className="text-center text-sm leading-relaxed"
          style={{ ...EXPORT_BODY_TEXT, color: '#404040' }}
        >
          {displayDescription ||
            'A beautifully presented home in a sought-after North Texas neighborhood.'}
        </p>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-1 px-4" style={{ height: 180 }}>
        {collage.map((src, index) => (
          <div key={index} className="h-full overflow-hidden bg-neutral-200">
            {src ? <img src={src} alt="" className="size-full object-cover" /> : null}
          </div>
        ))}
      </div>

      <footer className="shrink-0 bg-black px-8 py-5 text-center text-white">
        <p className="text-lg font-bold" style={exportNowrap()}>
          {agent.full_name} | {agent.phone} | {agent.email}
        </p>
      </footer>
    </>
  )
}

export function ListingFlyerTemplate({
  context,
  agent,
  heroPhoto,
  interiorPhotos,
  description,
  scale = 0.55,
  elementId = 'marketing-flyer',
}: ListingFlyerTemplateProps) {
  return (
    <MarketingPreviewFrame
      exportId={elementId}
      width={WIDTH}
      height={HEIGHT}
      exportBg="#ffffff"
      previewScale={scale}
      className="flex flex-col bg-white text-black"
      style={{ fontFamily: "'Montserrat', 'Mont', system-ui, sans-serif" }}
    >
      <FlyerBody
        context={context}
        agent={agent}
        heroPhoto={heroPhoto}
        interiorPhotos={interiorPhotos}
        description={description}
      />
    </MarketingPreviewFrame>
  )
}
