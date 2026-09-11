import { BookAgentBioPage } from '@/components/marketing/listing-book/BookAgentBioPage'
import { BookCoverPage } from '@/components/marketing/listing-book/BookCoverPage'
import { BookNeighborhoodPage } from '@/components/marketing/listing-book/BookNeighborhoodPage'
import { BookPropertyDetailsPage } from '@/components/marketing/listing-book/BookPropertyDetailsPage'
import { PhotoCollagePage } from '@/components/marketing/listing-book/PhotoCollagePage'
import { getPhotosByCategories } from '@/lib/marketing-data'
import type {
  AgentMarketingProfile,
  ListingMarketingContext,
  NeighborhoodGuide,
  PhotoUpload,
} from '@/lib/marketing-types'
import { COLLAGE_SECTIONS } from '@/lib/marketing-types'
import { BookPreviewWidthContext } from '@/components/marketing/listing-book/BookPreviewContext'
import { BOOK_PREVIEW_MAX_WIDTH } from '@/lib/marketing-preview'

type ListingBookTemplateProps = {
  context: ListingMarketingContext
  agent: AgentMarketingProfile
  photos: PhotoUpload[]
  neighborhoodGuide: NeighborhoodGuide
  propertyDescription: string
  agentBio: string
  maxPreviewWidth?: number
}

function buildCollagePages(
  photos: PhotoUpload[],
): { pageId: string; urls: string[] }[] {
  const pages: { pageId: string; urls: string[] }[] = []

  for (const section of COLLAGE_SECTIONS) {
    const matched = getPhotosByCategories(photos, section.categories)
    if (matched.length === 0) continue
    pages.push({
      pageId: `book-page-collage-${section.key}`,
      urls: matched.map((p) => p.preview),
    })
  }

  return pages
}

export function ListingBookTemplate({
  context,
  agent,
  photos,
  neighborhoodGuide,
  propertyDescription,
  agentBio,
  maxPreviewWidth = BOOK_PREVIEW_MAX_WIDTH,
}: ListingBookTemplateProps) {
  const hero = getPhotosByCategories(photos, ['hero'])[0]?.preview ?? null
  const neighborhood =
    getPhotosByCategories(photos, ['neighborhood'])[0]?.preview ?? null
  const edgePhotos = getPhotosByCategories(photos, ['pool', 'outdoor', 'hero']).map(
    (p) => p.preview,
  )
  const collagePages = buildCollagePages(photos)

  return (
    <BookPreviewWidthContext.Provider value={maxPreviewWidth}>
      <div className="flex flex-col items-center gap-8">
        <BookCoverPage context={context} heroPhoto={hero} agent={agent} />
        <BookNeighborhoodPage
          context={context}
          guide={neighborhoodGuide}
          neighborhoodPhoto={neighborhood}
          agent={agent}
        />
        <BookPropertyDetailsPage
          context={context}
          description={propertyDescription}
          edgePhotos={edgePhotos}
          agent={agent}
        />
        {collagePages.map((page) => (
          <PhotoCollagePage
            key={page.pageId}
            pageId={page.pageId}
            photos={page.urls}
            landscape={page.urls.length >= 2}
          />
        ))}
        <BookAgentBioPage agent={agent} bio={agentBio} />
      </div>
    </BookPreviewWidthContext.Provider>
  )
}
