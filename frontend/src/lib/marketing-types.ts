export type MarketingStep = 'upload' | 'payment' | 'generate'

export type MarketingAssetTab = 'just_sold' | 'flyer' | 'book'

export type PhotoCategory =
  | 'hero'
  | 'living_room'
  | 'kitchen'
  | 'dining'
  | 'master_bedroom'
  | 'master_bath'
  | 'closet'
  | 'bedroom_secondary'
  | 'office'
  | 'game_room'
  | 'pool'
  | 'outdoor'
  | 'foyer'
  | 'agent_headshot'
  | 'neighborhood'
  | 'other'

export type PhotoUpload = {
  id: string
  file: File
  preview: string
  category: PhotoCategory
}

export type CommuteTime = {
  destination: string
  time: string
}

export type NeighborhoodGuide = {
  intro: string
  commute_times: CommuteTime[]
  boundaries: string
  nearby_neighborhoods: string
  what_to_expect: string
  the_lifestyle: string
  unexpected_appeal: string
  the_market: string
  youll_fall_in_love: string
}

export type MarketingPageType =
  | 'just_sold'
  | 'flyer'
  | 'flyer_footer'
  | 'neighborhood'
  | 'property_details'
  | 'agent_bio'

export type ListingMarketingContext = {
  address_full: string
  address_line1: string
  address_city: string
  address_state: string
  address_zip: string
  list_price: string
  list_price_raw: number | null
  bedrooms_total: string
  bathrooms_full: string
  bathrooms_half: string
  bathrooms_display: string
  living_area_sqft: string
  pool_yn: string
  property_description: string
  school_district: string
  elementary_school: string
  middle_school: string
  high_school: string
  hoa_type: string
  hoa_dues: string
  year_built: string
  subdivision_name: string
  street_number: string
  street_name: string
  has_pool: boolean
  has_game_room: boolean
}

export type AgentMarketingProfile = {
  full_name: string
  phone: string
  email: string
  headshot_url: string | null
}

export type CollageSection = {
  key: string
  title: string
  categories: PhotoCategory[]
}

export const MAX_PHOTOS = 25

export const PHOTO_CATEGORY_OPTIONS: { value: PhotoCategory; label: string }[] = [
  { value: 'hero', label: 'Hero (exterior front)' },
  { value: 'living_room', label: 'Interior — Living room' },
  { value: 'kitchen', label: 'Interior — Kitchen' },
  { value: 'dining', label: 'Interior — Dining' },
  { value: 'master_bedroom', label: 'Interior — Master bedroom' },
  { value: 'bedroom_secondary', label: 'Interior — Secondary bedrooms' },
  { value: 'master_bath', label: 'Interior — Bathrooms' },
  { value: 'game_room', label: 'Interior — Game room' },
  { value: 'office', label: 'Interior — Office' },
  { value: 'foyer', label: 'Foyer / Entry' },
  { value: 'closet', label: 'Closet' },
  { value: 'pool', label: 'Pool / Outdoor — Pool' },
  { value: 'outdoor', label: 'Pool / Outdoor' },
  { value: 'neighborhood', label: 'Neighborhood' },
  { value: 'agent_headshot', label: 'Agent headshot' },
  { value: 'other', label: 'Other' },
]

export const COLLAGE_SECTIONS: CollageSection[] = [
  { key: 'foyer', title: 'Foyer / Entry', categories: ['foyer', 'other'] },
  { key: 'living', title: 'Living / Family Room', categories: ['living_room'] },
  { key: 'kitchen', title: 'Kitchen', categories: ['kitchen'] },
  { key: 'dining', title: 'Dining Room', categories: ['dining'] },
  { key: 'master', title: 'Master Bedroom', categories: ['master_bedroom'] },
  {
    key: 'master_closet_bath',
    title: 'Master Closet + Bathrooms',
    categories: ['closet', 'master_bath'],
  },
  {
    key: 'secondary',
    title: 'Secondary Bedrooms / Office',
    categories: ['bedroom_secondary', 'office', 'game_room'],
  },
  { key: 'pool_outdoor', title: 'Pool / Outdoor', categories: ['pool', 'outdoor'] },
]
