import type { LucideIcon } from 'lucide-react'
import {
  Calendar,
  FileText,
  Film,
  Mail,
  Share2,
  Signpost,
} from 'lucide-react'

export type MarketingAssetStatus = 'not_started' | 'in_progress' | 'done'

export type MarketingAsset = {
  id: string
  name: string
  priceCents: number
  priceLabel: string
  description: string
  icon: LucideIcon
}

export const MARKETING_ASSETS: MarketingAsset[] = [
  {
    id: 'social-pack',
    name: 'Social Media Pack',
    priceCents: 0,
    priceLabel: 'FREE',
    description: 'Instagram square and story templates sized for your listing photos.',
    icon: Share2,
  },
  {
    id: 'listing-flyer',
    name: 'Listing Flyer',
    priceCents: 0,
    priceLabel: 'FREE',
    description: 'One-page PDF flyer with property highlights and agent branding.',
    icon: FileText,
  },
  {
    id: 'just-listed-postcard',
    name: 'Just Listed Postcard',
    priceCents: 500,
    priceLabel: '$5',
    description: '4×6 just-listed postcard for neighborhood mailers.',
    icon: Mail,
  },
  {
    id: 'open-house-kit',
    name: 'Open House Kit',
    priceCents: 1500,
    priceLabel: '$15',
    description: 'Flyer, social graphics, and email template for your open house.',
    icon: Calendar,
  },
  {
    id: 'video-script',
    name: 'Custom Video Script',
    priceCents: 0,
    priceLabel: 'FREE',
    description: 'AI-generated reel script tailored to this property.',
    icon: Film,
  },
  {
    id: 'yard-sign',
    name: 'Branded Yard Sign',
    priceCents: 0,
    priceLabel: 'PORTAL',
    description: 'Order a Lowen Sign yard sign with your listing details.',
    icon: Signpost,
  },
]

export const STATUS_LABEL: Record<MarketingAssetStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
}

export function statusBadgeClass(status: MarketingAssetStatus): string {
  if (status === 'done') return 'bg-emerald-500/15 text-emerald-400'
  return 'bg-[#2a2a2a] text-[var(--color-text-secondary)]'
}

export const PROCESSING_FEE_CENTS = 45
