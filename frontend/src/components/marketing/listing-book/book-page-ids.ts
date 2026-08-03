import { getPhotosByCategories } from '@/lib/marketing-data'
import { COLLAGE_SECTIONS, type PhotoUpload } from '@/lib/marketing-types'

export function getListingBookPageIds(photos: PhotoUpload[]): string[] {
  const collageIds = COLLAGE_SECTIONS.filter(
    (section) => getPhotosByCategories(photos, section.categories).length > 0,
  ).map((section) => `book-page-collage-${section.key}`)

  return [
    'book-page-cover',
    'book-page-neighborhood',
    'book-page-details',
    ...collageIds,
    'book-page-agent',
  ]
}
