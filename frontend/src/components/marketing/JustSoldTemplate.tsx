import lpLogo from '@/assets/branding/LP_Gold.png'
import { MarketingPreviewFrame } from '@/components/marketing/MarketingPreviewFrame'
import { EXPORT_BODY_TEXT } from '@/lib/export-text-styles'
import type { AgentMarketingProfile, ListingMarketingContext } from '@/lib/marketing-types'

const WIDTH = 1080
const HEIGHT = 1080

type JustSoldTemplateProps = {
  context: ListingMarketingContext
  agent: AgentMarketingProfile
  heroPhoto: string | null
  scale?: number
  elementId?: string
}

function JustSoldBody({
  context,
  agent,
  heroPhoto,
}: Omit<JustSoldTemplateProps, 'scale' | 'elementId'>) {
  return (
    <>
      <header
        className="relative flex shrink-0 items-end justify-between bg-black px-10 pb-6"
        style={{ height: 180 }}
      >
        <div className="relative" style={{ height: 140 }}>
          <p className="text-[96px] font-bold leading-none text-white" style={EXPORT_BODY_TEXT}>
            JUST
          </p>
          <p
            className="absolute left-2 top-[52px] text-[120px] leading-none text-[#CFB87C]"
            style={{ ...EXPORT_BODY_TEXT, fontFamily: "'Dancing Script', cursive" }}
          >
            Sold
          </p>
        </div>
        <div className="mb-2 text-right">
          <p
            className="text-2xl font-semibold uppercase text-white"
            style={EXPORT_BODY_TEXT}
          >
            {context.address_line1}
          </p>
          <p
            className="mt-1 text-xl uppercase"
            style={{ ...EXPORT_BODY_TEXT, color: 'rgba(255,255,255,0.9)' }}
          >
            {context.address_city}, {context.address_state}
          </p>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 bg-neutral-900">
        {heroPhoto ? (
          <img src={heroPhoto} alt="Property" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-neutral-800 text-2xl text-neutral-500">
            Hero photo
          </div>
        )}
      </div>

      <footer
        className="flex shrink-0 items-center justify-between bg-black px-10"
        style={{ height: 160 }}
      >
        <div className="flex items-center gap-5">
          {agent.headshot_url ? (
            <img
              src={agent.headshot_url}
              alt={agent.full_name}
              className="size-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full bg-neutral-800 text-sm text-neutral-400">
              Photo
            </div>
          )}
          <div>
            <p className="text-2xl font-bold text-white" style={EXPORT_BODY_TEXT}>
              {agent.full_name}
            </p>
            <p
              className="text-lg"
              style={{ ...EXPORT_BODY_TEXT, color: 'rgba(255,255,255,0.85)' }}
            >
              {agent.phone}
            </p>
            <p
              className="text-base"
              style={{ ...EXPORT_BODY_TEXT, color: 'rgba(255,255,255,0.7)' }}
            >
              {agent.email}
            </p>
          </div>
        </div>
        <img src={lpLogo} alt="LocalPRO" className="h-14 w-auto object-contain" />
      </footer>
    </>
  )
}

export function JustSoldTemplate({
  context,
  agent,
  heroPhoto,
  scale = 0.5,
  elementId = 'marketing-just-sold',
}: JustSoldTemplateProps) {
  return (
    <MarketingPreviewFrame
      exportId={elementId}
      width={WIDTH}
      height={HEIGHT}
      exportBg="#000000"
      previewScale={scale}
      className="flex flex-col bg-black text-white"
      style={{ fontFamily: "'Montserrat', 'Mont', system-ui, sans-serif" }}
    >
      <JustSoldBody context={context} agent={agent} heroPhoto={heroPhoto} />
    </MarketingPreviewFrame>
  )
}
