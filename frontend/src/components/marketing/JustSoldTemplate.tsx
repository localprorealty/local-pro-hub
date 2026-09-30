import { SocialPostTemplate } from '@/components/marketing/SocialPostTemplate'
import type { AgentMarketingProfile, ListingMarketingContext } from '@/lib/marketing-types'

export type JustSoldTemplateProps = {
  context: ListingMarketingContext
  agent: AgentMarketingProfile
  heroPhoto: string | null
  scale?: number
  elementId?: string
}

export function JustSoldTemplate({
  context,
  agent,
  heroPhoto,
  scale = 0.5,
  elementId = 'marketing-just-sold',
}: JustSoldTemplateProps) {
  return (
    <SocialPostTemplate
      variant="just_sold"
      context={context}
      agent={agent}
      heroPhoto={heroPhoto}
      scale={scale}
      elementId={elementId}
    />
  )
}
