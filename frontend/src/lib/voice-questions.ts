import {
  NTREIS_SECTIONS,
  isFieldFilled,
  isFieldVisible,
  isSectionVisible,
  type NtreisField,
  type NtreisSection,
} from '@/lib/ntreis-sections'

export type VoiceQuestion = {
  question: string
  subtitle?: string
}

export type QueuedVoiceField = {
  field: NtreisField
  sectionId: number
  sectionName: string
}

const QUESTION_MAP: Record<string, VoiceQuestion> = {
  property_sub_type: {
    question: 'What type of property is this?',
    subtitle: 'Single family home, condo, townhouse, farm...',
  },
  listing_agreement_type: {
    question: 'What type of listing agreement is this?',
    subtitle: 'Usually Exclusive Right to Sell for most listings',
  },
  transaction_type: {
    question: 'Is this property for sale, or both sale and lease?',
  },
  property_attached_yn: {
    question: 'Is this property attached to another unit?',
    subtitle: 'Like a duplex or townhouse — answer yes or no',
  },
  adult_community_yn: {
    question: 'Is this an adult or age-restricted community?',
  },
  will_subdivide_yn: {
    question: 'Will this property be subdivided?',
    subtitle: 'Answer yes, no, or already subdivided',
  },
  accessory_unit_yn: {
    question: 'Does this property have an accessory unit?',
    subtitle: 'Like a guest house, ADU, or pool house',
  },
  multi_parcel_id_yn: {
    question: 'Does this property span multiple parcels?',
  },
  year_built_status: {
    question: 'Is this a preowned home, or new construction?',
  },
  list_price: {
    question: 'What is the listing price?',
    subtitle: 'Say the amount, for example: four hundred twenty five thousand',
  },
  list_date: {
    question: 'What is the listing date?',
    subtitle: 'Say the date, for example: June 15th',
  },
  expire_date: {
    question: 'When does this listing expire?',
  },
  year_built: {
    question: 'What year was this home built?',
  },
  living_area_sqft: {
    question: 'What is the total living area in square feet?',
  },
  parcel_id: {
    question: 'What is the parcel ID for this property?',
    subtitle: 'You can find this on the county appraisal district website',
  },
  housing_type: {
    question: 'How would you classify this housing type?',
    subtitle: 'Single detached, condo, farm/ranch house...',
  },
  architectural_style: {
    question: 'What architectural style best describes this home?',
    subtitle: 'You can say multiple — for example: Traditional and Ranch',
  },
  school_district: {
    question: 'What school district is this property in?',
  },
  bedrooms_total: {
    question: 'How many bedrooms does this property have?',
  },
  bathrooms_full: {
    question: 'How many full bathrooms?',
  },
  bathrooms_half: {
    question: 'Any half bathrooms?',
  },
  levels: {
    question: 'How many levels or stories does this home have?',
  },
  living_areas: {
    question: 'How many living areas are there?',
  },
  interior_features: {
    question: 'What interior features does this home have?',
    subtitle: 'Say what applies — vaulted ceilings, kitchen island, open floorplan...',
  },
  accessibility_yn: {
    question: 'Are there any accessibility features in this property?',
    subtitle: 'Ramps, wide doorways, ADA features, stair lifts...',
  },
  smart_home_yn: {
    question: 'Does this home have a smart home system?',
    subtitle: 'Automated lighting, thermostat, security, or similar',
  },
  pool_yn: {
    question: 'Does this property have a pool?',
  },
  basement_yn: {
    question: 'Is there a basement?',
  },
  carport_spaces: {
    question: 'How many carport spaces are there? Say zero if none.',
  },
  garage_yn: {
    question: 'Does this property have a garage?',
  },
  attached_garage_yn: {
    question: 'Is the garage attached to the house?',
  },
  lot_size_area: {
    question: 'What is the lot size area?',
  },
  lot_size_unit: {
    question: 'Is the lot size in acres or square feet?',
  },
  lot_size_acreage: {
    question: 'What is the lot size range?',
    subtitle: 'For example: less than half an acre, or one to three acres',
  },
  lot_dimensions: {
    question: 'What are the lot dimensions?',
    subtitle: 'For example: 80 by 120 feet',
  },
  lot_size_source: {
    question: 'How was the lot size determined?',
    subtitle: 'Assessor, survey, owner estimate...',
  },
  waterfront_yn: {
    question: 'Is this property on a waterfront?',
    subtitle: 'Lake, river, creek, or canal',
  },
  horse_permitted_yn: {
    question: 'Are horses permitted on this property?',
  },
  lake_pump_yn: {
    question: 'Does this property have a lake pump?',
  },
  dock_permitted_yn: {
    question: 'Is a dock permitted on this property?',
  },
  utilities: {
    question: 'What utilities and street features does this property have?',
    subtitle: 'City sewer, city water, natural gas, electricity...',
  },
  mud_district_yn: {
    question: 'Is this property in a MUD district?',
    subtitle: 'Municipal Utility District — common in newer Texas suburbs',
  },
  special_taxing_authority_yn: {
    question: 'Is there a special taxing authority for this property?',
  },
  public_improvement_district_yn: {
    question: 'Is this in a Public Improvement District?',
  },
  hoa_type: {
    question: 'Does this property have an HOA?',
    subtitle: 'Mandatory, voluntary, or none',
  },
  possession: {
    question: 'When can the buyer take possession?',
    subtitle: 'Closing/funding, 30-60 days, negotiable...',
  },
  concessions: {
    question: 'Are there any seller concessions?',
  },
  loan_payment: {
    question: 'What is the current loan payment amount?',
  },
  loan_balance: {
    question: 'What is the current loan balance?',
  },
  loan_interest_rate: {
    question: 'What is the loan interest rate?',
    subtitle: 'Say the percentage, for example: 6.5 percent',
  },
  orig_mortgage_date: {
    question: 'When was the original mortgage taken out?',
  },
  lender_name: {
    question: 'Who is the current lender?',
  },
  appraiser_name: {
    question: "What is the appraiser's name?",
  },
  title_company_preferred: {
    question: 'Is there a preferred title company?',
  },
  title_company_phone: {
    question: "What is the title company's phone number?",
  },
  title_company_location: {
    question: 'Where is the title company located?',
  },
  second_mortgage_yn: {
    question: 'Is there a second mortgage on this property?',
  },
  hoa_dues: {
    question: 'How much are the HOA dues?',
    subtitle: 'Say the dollar amount, for example: two hundred fifty dollars',
  },
  hoa_billing_frequency: {
    question: 'How often are HOA dues charged?',
    subtitle: 'Monthly, quarterly, annually...',
  },
  hoa_management_company: {
    question: 'What is the name of the HOA management company?',
  },
  hoa_management_phone: {
    question: "What is the HOA management company's phone number?",
  },
  hoa_website: {
    question: 'What is the HOA website?',
  },
  hoa_management_email: {
    question: 'What is the HOA management email address?',
  },
  lockbox_type: {
    question: 'What type of lockbox is on the property?',
  },
  key_box_number: {
    question: 'What is the key box number?',
  },
  lock_box_location: {
    question: 'Where is the lockbox located on the property?',
    subtitle: 'For example: front door, garage, gate',
  },
  access_gate_code: {
    question: 'Is there a gate or access code for this property?',
  },
  showing_attended_yn: {
    question: 'Will showings be attended by the agent or owner?',
  },
  occupant_name: {
    question: "What is the occupant's name?",
  },
  occupant_phone: {
    question: "What is the occupant's phone number?",
  },
  occupant_alternate_phone: {
    question: 'Is there an alternate phone number for the occupant?',
  },
  showing_contact_phone: {
    question: 'What is the showing contact phone number?',
  },
  showing_contact_phone_ext: {
    question: 'Is there a phone extension for the showing contact?',
  },
  showing_instructions: {
    question: 'What are the showing instructions for agents?',
    subtitle:
      'Speak naturally — for example: call before arrival, dog on premises, use back door',
  },
  showing_instructions_secured: {
    question: 'Are there any private showing instructions for the office only?',
  },
  showing_requirements: {
    question: 'What are the showing requirements?',
    subtitle: '24 hour notice, appointment only, go show...',
  },
  owner_name: {
    question: "What is the seller's full name?",
  },
  public_driving_directions: {
    question: 'What are the public driving directions to this property?',
    subtitle: 'Say them as you would to a buyer — from a major road or landmark',
  },
  property_description: {
    question: 'Can you describe this property for the public listing?',
    subtitle: 'Speak naturally — I will capture everything you say',
  },
  excludes: {
    question: 'Is anything excluded from the sale?',
    subtitle: 'Like a chandelier, TV mount, or specific appliances',
  },
  private_remarks: {
    question: 'Any private remarks for other agents?',
  },
  intra_office_remarks: {
    question: 'Any internal office remarks for your team?',
  },
  allow_address_display: {
    question: 'Can the full property address be shown publicly online?',
  },
  allow_avm: {
    question: 'Should automated home value estimates be allowed for this listing?',
    subtitle: 'Like a Zestimate — most agents say yes',
  },
  allow_comments_reviews: {
    question: 'Should buyers be allowed to leave comments or reviews on this listing?',
  },
  allow_internet_display: {
    question: 'Should this listing appear on the internet and syndicated websites?',
  },
  complex_name: {
    question: 'What is the name of the condo complex?',
  },
  building_number: {
    question: 'What is the building number?',
  },
  floor_location: {
    question: 'What floor is this unit on?',
  },
  fha_va_approved_complex: {
    question: 'What is the FHA or VA approved complex number?',
  },
  crop_retire_program_yn: {
    question: 'Is this property in a crop retirement program?',
  },
  land_leased_yn: {
    question: 'Is the land leased rather than owned?',
  },
  agri_exemption_yn: {
    question: 'Does this property have an agricultural tax exemption?',
  },
  aerial_photo_available_yn: {
    question: 'Is an aerial photo available for this property?',
  },
  ranch_name: {
    question: 'What is the name of this ranch?',
  },
  topography: {
    question: 'How would you describe the topography of this land?',
    subtitle: 'Rolling hills, flat, wooded, creek bottom...',
  },
  platted_waterfront_boundary: {
    question: 'What is the platted waterfront boundary?',
  },
  list_agent_texting_allowed: {
    question: 'Is the listing agent available by text message?',
  },
  co_list_agent_texting_allowed: {
    question: 'Is the co-listing agent available by text message?',
  },
  list_team_id: {
    question: 'What is the listing team ID?',
  },
  co_list_agent_id: {
    question: 'Is there a co-listing agent? What is their MLS ID?',
  },
  supervisor_id: {
    question: "What is your supervisor's MLS ID?",
  },
  attribution_listing_override: {
    question: 'Is there a listing contact override?',
  },
  accessory_unit_sqft: {
    question: 'How many square feet is the accessory unit?',
  },
  accessory_unit_type: {
    question: 'What type of accessory unit is it?',
    subtitle: 'Guest quarters, ADU, pool house...',
  },
  year_built_source: {
    question: 'How was the year built determined?',
    subtitle: 'Assessor records, owner knowledge, builder, appraiser...',
  },
  sqft_source: {
    question: 'How was the square footage determined?',
    subtitle: 'Assessor, appraiser, plans, owner estimate...',
  },
  additional_parcel_id: {
    question: 'What is the additional parcel ID?',
  },
  for_lease_mls_number: {
    question: 'What is the MLS number for the lease listing?',
  },
  garage_length: {
    question: 'What is the garage length in feet?',
  },
  garage_width: {
    question: 'What is the garage width in feet?',
  },
  garage_height: {
    question: 'What is the garage height in feet?',
  },
  green_verification_url: {
    question: 'Is there a URL for the green building verification?',
    subtitle: 'Skip if not applicable',
  },
  walk_score: {
    question: 'What is the walk score for this property?',
    subtitle: "A number from 0 to 100 — skip if you don't know",
  },
  fireplace_count: {
    question: 'How many fireplaces does the property have?',
    subtitle: 'Say zero if none',
  },
  appliances: {
    question: 'What appliances are included with the home?',
    subtitle: 'Dishwasher, refrigerator, microwave, gas range...',
  },
  parking_features: {
    question: 'How would you describe the parking?',
    subtitle: 'Driveway, garage faces front, garage door opener...',
  },
  covered_spaces_total: {
    question: 'How many total covered parking spaces are there?',
  },
}

const SKIP_FIELD_KEYS = new Set(['_address_summary'])

export function generateQuestion(field: NtreisField): VoiceQuestion {
  const mapped = QUESTION_MAP[field.key]
  if (mapped) return mapped

  return {
    question: `What is the ${field.label.toLowerCase()}?`,
    subtitle: field.options
      ? `Options: ${field.options.slice(0, 4).join(', ')}${field.options.length > 4 ? '...' : ''}`
      : undefined,
  }
}

export function questionSpeakText(field: NtreisField): string {
  const { question, subtitle } = generateQuestion(field)
  return subtitle ? `${question} ${subtitle}` : question
}

export function getDisplayOptions(field: NtreisField | null): string[] {
  if (!field) return []

  switch (field.type) {
    case 'yes_no':
      return ['Yes', 'No']
    case 'radio':
    case 'select':
    case 'multiselect':
      return field.options ?? []
    default:
      return []
  }
}

export function findSectionForField(fieldKey: string): NtreisSection | null {
  for (const section of NTREIS_SECTIONS) {
    if (section.fields.some((f) => f.key === fieldKey)) {
      return section
    }
  }
  return null
}

export function buildVoiceQueue(
  formData: Record<string, unknown>,
  includeOptional = false,
  sectionId?: number,
): QueuedVoiceField[] {
  const queue: QueuedVoiceField[] = []

  for (const section of NTREIS_SECTIONS) {
    if (section.id === 22) continue
    if (sectionId !== undefined && section.id !== sectionId) continue
    if (!isSectionVisible(section, formData)) continue

    for (const field of section.fields) {
      if (SKIP_FIELD_KEYS.has(field.key)) continue
      if (field.type === 'room_row') continue
      if (!isFieldVisible(field, formData)) continue
      if (!includeOptional && !field.required) continue
      if (isFieldFilled(formData[field.key])) continue

      queue.push({
        field,
        sectionId: section.id,
        sectionName: section.name,
      })
    }
  }

  return queue
}

export function wantsOptionalFields(transcript: string): boolean {
  const lower = transcript.toLowerCase()
  return (
    lower.includes('optional') ||
    lower.includes('fill everything') ||
    lower.includes('all fields')
  )
}
