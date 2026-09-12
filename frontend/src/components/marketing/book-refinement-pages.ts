import type { Dispatch, SetStateAction } from 'react'

import type { RefinementPageOption } from '@/components/marketing/AiRefinementPanel'
import {
  formatCommuteTimes,
  parseCommuteTimes,
} from '@/lib/marketing'
import type { NeighborhoodGuide } from '@/lib/marketing-types'

type BookRefinementSources = {
  neighborhoodGuide: NeighborhoodGuide
  setNeighborhoodGuide: Dispatch<SetStateAction<NeighborhoodGuide | null>>
  propertyDescription: string
  setPropertyDescription: (value: string) => void
  agentBio: string
  setAgentBio: (value: string) => void
}

export function buildBookRefinementPages({
  neighborhoodGuide,
  setNeighborhoodGuide,
  propertyDescription,
  setPropertyDescription,
  agentBio,
  setAgentBio,
}: BookRefinementSources): RefinementPageOption[] {
  const patchGuide = (patch: Partial<NeighborhoodGuide>) => {
    setNeighborhoodGuide((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  return [
    {
      key: 'book_neighborhood_intro',
      label: 'Neighborhood — intro',
      pageType: 'neighborhood',
      threshold: 140,
      templateType: 'book',
      getContent: () => neighborhoodGuide.intro,
      applyContent: (content) => patchGuide({ intro: content }),
    },
    {
      key: 'book_commute_times',
      label: 'Neighborhood — commute times',
      pageType: 'neighborhood',
      templateType: 'book',
      getContent: () => formatCommuteTimes(neighborhoodGuide),
      applyContent: (content) => patchGuide({ commute_times: parseCommuteTimes(content) }),
    },
    {
      key: 'book_boundaries',
      label: 'Neighborhood — boundaries',
      pageType: 'neighborhood',
      threshold: 80,
      templateType: 'book',
      getContent: () => neighborhoodGuide.boundaries,
      applyContent: (content) => patchGuide({ boundaries: content }),
    },
    {
      key: 'book_nearby_neighborhoods',
      label: 'Neighborhood — nearby areas',
      pageType: 'neighborhood',
      threshold: 80,
      templateType: 'book',
      getContent: () => neighborhoodGuide.nearby_neighborhoods,
      applyContent: (content) => patchGuide({ nearby_neighborhoods: content }),
    },
    {
      key: 'book_what_to_expect',
      label: 'What to expect',
      pageType: 'neighborhood',
      threshold: 110,
      templateType: 'book',
      getContent: () => neighborhoodGuide.what_to_expect,
      applyContent: (content) => patchGuide({ what_to_expect: content }),
    },
    {
      key: 'book_the_lifestyle',
      label: 'The lifestyle',
      pageType: 'neighborhood',
      threshold: 110,
      templateType: 'book',
      getContent: () => neighborhoodGuide.the_lifestyle,
      applyContent: (content) => patchGuide({ the_lifestyle: content }),
    },
    {
      key: 'book_unexpected_appeal',
      label: 'Unexpected appeal',
      pageType: 'neighborhood',
      threshold: 110,
      templateType: 'book',
      getContent: () => neighborhoodGuide.unexpected_appeal,
      applyContent: (content) => patchGuide({ unexpected_appeal: content }),
    },
    {
      key: 'book_the_market',
      label: 'The market',
      pageType: 'neighborhood',
      threshold: 110,
      templateType: 'book',
      getContent: () => neighborhoodGuide.the_market,
      applyContent: (content) => patchGuide({ the_market: content }),
    },
    {
      key: 'book_youll_fall_in_love',
      label: "You'll fall in love",
      pageType: 'neighborhood',
      threshold: 110,
      templateType: 'book',
      getContent: () => neighborhoodGuide.youll_fall_in_love,
      applyContent: (content) => patchGuide({ youll_fall_in_love: content }),
    },
    {
      key: 'book_property_details',
      label: 'Property details — description',
      pageType: 'property_details',
      threshold: 750,
      templateType: 'book',
      getContent: () => propertyDescription,
      applyContent: setPropertyDescription,
    },
    {
      key: 'book_agent_bio',
      label: 'Agent bio (last page)',
      pageType: 'agent_bio',
      threshold: 500,
      templateType: 'book',
      getContent: () => agentBio,
      applyContent: setAgentBio,
    },
  ]
}
