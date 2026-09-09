import lpLogo from '@/assets/branding/LP_Gold.png'
import { BookPagePreviewFrame } from '@/components/marketing/listing-book/BookPagePreviewFrame'
import { EXPORT_BODY_TEXT, EXPORT_LABEL_CAPS } from '@/lib/export-text-styles'
import type { AgentMarketingProfile } from '@/lib/marketing-types'

type BookAgentBioPageProps = {
  agent: AgentMarketingProfile
  bio: string
  pageId?: string
}

const PAGE_WIDTH = 900
const PAGE_HEIGHT = 1200

export function BookAgentBioPage({
  agent,
  bio,
  pageId = 'book-page-agent',
}: BookAgentBioPageProps) {
  return (
    <BookPagePreviewFrame
      pageId={pageId}
      width={PAGE_WIDTH}
      height={PAGE_HEIGHT}
      exportBg="#ffffff"
      className="relative overflow-hidden bg-white px-10 py-12 text-black"
      style={{ fontFamily: "'Montserrat', 'Mont', sans-serif" }}
    >
      <p className="text-5xl font-bold" style={EXPORT_BODY_TEXT}>
        {agent.full_name}
      </p>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div
          className="h-0.5 w-8"
          style={{ backgroundColor: agent.brand_color_primary || '#CFB87C' }}
        />
        <p className="text-center text-sm font-semibold" style={EXPORT_LABEL_CAPS}>
          Realtor®
        </p>
        <div
          className="h-0.5 w-8"
          style={{ backgroundColor: agent.brand_color_primary || '#CFB87C' }}
        />
      </div>

      <div className="mt-10 grid grid-cols-[1fr_280px] gap-8">
        <div>
          {agent.brand_logo_url && (
            <div className="mb-6">
              <img
                src={agent.brand_logo_url}
                alt="Agent Brand"
                className="max-h-12 max-w-[180px] object-contain"
              />
            </div>
          )}
          <p
            className="text-sm leading-relaxed"
            style={{ ...EXPORT_BODY_TEXT, color: '#404040' }}
          >
            {bio}
          </p>

          <p
            className="mt-10 text-xs font-bold"
            style={{ ...EXPORT_LABEL_CAPS, color: '#000000' }}
          >
            Contact Information
          </p>
          <div
            className="mt-2 mb-3 h-0.5 w-12"
            style={{ backgroundColor: agent.brand_color_primary || '#CFB87C' }}
          />
          <p className="mt-3 font-semibold" style={EXPORT_BODY_TEXT}>
            {agent.email}
          </p>
          <p className="mt-1 font-semibold" style={EXPORT_BODY_TEXT}>
            {agent.phone}
          </p>
        </div>

        {agent.headshot_url ? (
          <img
            src={agent.headshot_url}
            alt={agent.full_name}
            className="aspect-square w-full object-cover"
            style={{
              boxShadow: `0 0 0 3px ${agent.brand_color_primary || '#CFB87C'}`,
            }}
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-neutral-200 text-neutral-500">
            Headshot
          </div>
        )}
      </div>

      <img
        src={lpLogo}
        alt="LocalPRO"
        className="absolute bottom-10 right-10 h-14 w-auto object-contain"
      />
    </BookPagePreviewFrame>
  )
}
