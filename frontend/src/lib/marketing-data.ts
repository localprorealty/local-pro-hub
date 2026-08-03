import type { Listing } from '@/lib/listings'
import type {
  AgentMarketingProfile,
  ListingMarketingContext,
  NeighborhoodGuide,
  PhotoCategory,
  PhotoUpload,
} from '@/lib/marketing-types'
import type { UserProfileRow } from '@/lib/users'

function pickString(formData: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = formData[key]
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim()
    }
  }
  return ''
}

function pickNumber(formData: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = formData[key]
    if (typeof value === 'number' && !Number.isNaN(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(/[^0-9.]/g, ''))
      if (!Number.isNaN(parsed)) return parsed
    }
  }
  return null
}

export function formatListPrice(value: number | null): string {
  if (value === null) return 'Price upon request'
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function formatSqft(value: string): string {
  const num = Number(value.replace(/[^0-9]/g, ''))
  if (!num) return value || '—'
  return num.toLocaleString('en-US')
}

export function buildListingContext(listing: Listing): ListingMarketingContext {
  const formData = (listing.form_data ?? {}) as Record<string, unknown>
  const listPriceRaw =
    pickNumber(formData, 'list_price', 'list_price_total') ?? listing.list_price

  const bathroomsFull = pickString(formData, 'bathrooms_full', 'bathrooms', 'baths')
  const bathroomsHalf = pickString(formData, 'bathrooms_half')
  const bathroomsDisplay = bathroomsHalf
    ? `${bathroomsFull || '0'}.${bathroomsHalf}`
    : bathroomsFull || '—'

  const poolYn = pickString(formData, 'pool_yn')
  const addressFull =
    listing.address_full || pickString(formData, 'address_full') || 'Your listing'

  const streetNumber = pickString(formData, 'street_number')
  const streetName = pickString(formData, 'street_name')
  const addressLine1 =
    streetNumber && streetName
      ? `${streetNumber} ${streetName}`
      : addressFull.split(',')[0]?.trim() || addressFull

  const description =
    pickString(formData, 'property_description') ||
    (listing.description_generated?.trim() ?? '')

  const gameRoomFeatures = pickString(formData, 'interior_features')
  const hasGameRoom = gameRoomFeatures.toLowerCase().includes('game')

  return {
    address_full: addressFull,
    address_line1: addressLine1,
    address_city: pickString(formData, 'address_city', 'city'),
    address_state: pickString(formData, 'address_state', 'state') || 'TX',
    address_zip: pickString(formData, 'address_zip', 'zip_code', 'zip'),
    list_price: formatListPrice(listPriceRaw),
    list_price_raw: listPriceRaw,
    bedrooms_total: pickString(formData, 'bedrooms_total', 'bedrooms', 'beds') || '—',
    bathrooms_full: bathroomsFull || '—',
    bathrooms_half: bathroomsHalf,
    bathrooms_display: bathroomsDisplay,
    living_area_sqft: pickString(
      formData,
      'living_area_sqft',
      'sqft',
      'square_feet',
      'living_area',
    ),
    pool_yn: poolYn,
    property_description: description,
    school_district: pickString(formData, 'school_district'),
    elementary_school: pickString(formData, 'elementary_school'),
    middle_school: pickString(formData, 'middle_school'),
    high_school: pickString(formData, 'high_school'),
    hoa_type: pickString(formData, 'hoa_type'),
    hoa_dues: pickString(formData, 'hoa_dues'),
    year_built: pickString(formData, 'year_built'),
    subdivision_name: pickString(formData, 'subdivision_name', 'subdivision'),
    street_number: streetNumber,
    street_name: streetName.toUpperCase(),
    has_pool: poolYn.toLowerCase() === 'yes',
    has_game_room: hasGameRoom,
  }
}

export function buildAgentProfile(
  profile: UserProfileRow | null,
  photos: PhotoUpload[],
): AgentMarketingProfile {
  const headshot =
    getPhotosByCategories(photos, ['agent_headshot'])[0]?.preview ?? null

  return {
    full_name: profile?.full_name?.trim() || 'Your Agent',
    phone: profile?.phone?.trim() || '',
    email: profile?.email?.trim() || '',
    headshot_url: headshot,
  }
}

export function formatFooterContact(agent: Pick<AgentMarketingProfile, 'full_name' | 'phone' | 'email'>): string {
  return `${agent.full_name} | ${agent.phone} | ${agent.email}`
}

export function parseFooterContact(
  line: string,
): Partial<Pick<AgentMarketingProfile, 'full_name' | 'phone' | 'email'>> {
  const trimmed = line.trim()
  const parts = trimmed.split('|').map((part) => part.trim())

  if (parts.length >= 3) {
    return { full_name: parts[0], phone: parts[1], email: parts[2] }
  }

  if (trimmed.includes('@') && !trimmed.includes('|')) {
    return { email: trimmed }
  }

  return {}
}

export function getPhotosByCategories(
  photos: PhotoUpload[],
  categories: PhotoCategory[],
): PhotoUpload[] {
  return photos.filter((photo) => categories.includes(photo.category))
}

export function getFirstPhoto(
  photos: PhotoUpload[],
  categories: PhotoCategory[],
): PhotoUpload | undefined {
  return getPhotosByCategories(photos, categories)[0]
}

export function slugifyAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

export function listingContextForApi(
  context: ListingMarketingContext,
): Record<string, string> {
  return {
    address_full: context.address_full,
    address_city: context.address_city,
    list_price: context.list_price,
    bedrooms_total: context.bedrooms_total,
    bathrooms_display: context.bathrooms_display,
    living_area_sqft: context.living_area_sqft,
    pool_yn: context.pool_yn,
    school_district: context.school_district,
    subdivision_name: context.subdivision_name,
    year_built: context.year_built,
  }
}

export function getDefaultNeighborhoodGuide(city: string): NeighborhoodGuide {
  return {
    intro: `${city} offers a welcoming blend of established neighborhoods, strong schools, and convenient access to DFW employment centers.`,
    commute_times: [
      { destination: 'DFW Airport', time: '35m by car' },
      { destination: 'Love Field Airport', time: '25m by car' },
      { destination: 'Downtown Dallas', time: '30m by car' },
      { destination: 'Downtown Fort Worth', time: '40m by car' },
    ],
    boundaries: 'East to West across major corridors; North to South along key suburban arteries.',
    nearby_neighborhoods: 'Established subdivisions, newer master-planned communities, and retail corridors.',
    what_to_expect: 'A mix of family-friendly streets and everyday conveniences.',
    the_lifestyle: 'Suburban comfort with room to entertain and unwind.',
    unexpected_appeal: 'Strong community events and local dining options.',
    the_market: 'Steady demand from buyers seeking quality schools and commute access.',
    youll_fall_in_love: 'The balance of space, location, and neighborhood character.',
  }
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read file'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}
