import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Handshake,
  HelpCircle,
  Home,
  Key,
  Lightbulb,
  MapPin,
  Megaphone,
  Mic,
  PartyPopper,
  Percent,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'

import { api, ApiError } from '@/lib/api'
import { getAccessToken } from '@/lib/supabase'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export type MarketYourselfStep = '1' | '2' | '3' | '4'

export type VideoTopicId =
  | 'market_update'
  | 'new_listing'
  | 'just_sold'
  | 'buyer_tips'
  | 'seller_tips'
  | 'open_house'
  | 'neighborhood_spotlight'
  | 'why_work_with_me'
  | 'interest_rate_update'
  | 'my_story'

export type AudienceId =
  | 'first_time_buyers'
  | 'move_up_buyers'
  | 'sellers'
  | 'investors'

export type ContentStyleId =
  | 'talking_head'
  | 'story_time'
  | 'qa_hook'
  | 'data_drop'
  | 'announcement'
  | 'quick_tip'

export type VideoToneId = 'professional' | 'warm' | 'energetic' | 'educational'

export type PacingId = 'slow' | 'normal' | 'fast'

export type BackgroundId =
  | 'clean_white'
  | 'dark_studio'
  | 'blurred_outdoor'
  | 'office'
  | 'bookshelf'
  | 'gradient'

export type AspectRatioId = '9:16' | '16:9' | '1:1'

export type VideoCtaId = 'call_me' | 'visit_website' | 'dm_instagram'

export type HeyGenVoice = {
  voice_id: string
  name: string
  language: string | null
  gender: string | null
  preview_audio_url?: string | null
}

export type AgentAvatarProfile = {
  avatar_id: string | null
  group_id: string | null
  created_at: string | null
  thumbnail_url: string | null
  has_avatar: boolean
  consent_status: string | null
  consent_required: boolean
  avatar_type: 'digital_twin' | 'talking_photo'
  voice_id: string | null
  talking_photo_id: string | null
}

export type AvatarConsentResponse = {
  consent_url?: string
  group_id: string
  consent_status: string | null
  consent_required: boolean
  avatar_status?: string | null
}

export type ScriptRequest = {
  topic: VideoTopicId
  audience: AudienceId
  content_style: ContentStyleId
  tone: VideoToneId
  pacing: PacingId
  cta: VideoCtaId
  extra_context?: string
  agent_name: string
  agent_phone?: string
  property_address?: string
  neighborhood?: string
  open_house_address?: string
  open_house_date?: string
  open_house_time?: string
  sale_detail?: string
  refinement?: string
  current_script?: string
  scenario_prompt?: string
  visual_environment?: string
  outfit?: string
}

export type StoryboardScene = {
  scene_number: number
  visual: string
  script: string
}

export type ScriptResponse = {
  script: string
  video_agent_prompt: string
  scenes: StoryboardScene[]
  social_captions?: {
    instagram?: string
    tiktok?: string
    facebook?: string
  }
  posting_tips?: string
  word_count: number
  estimated_seconds: number
}

export type VideoRequest = {
  script: string
  avatar_id: string
  voice_id: string
  background: BackgroundId
  aspect_ratio: AspectRatioId
  agent_name: string
}

export type VideoAgentRequest = {
  prompt: string
  avatar_id: string
  voice_id: string
  orientation: 'portrait' | 'landscape'
  agent_name: string
  script?: string
  scenes?: StoryboardScene[]
}

export type VideoJobResponse = {
  video_id: string
  status: string
}

export type VideoAgentJobResponse = {
  session_id: string
  status: string
}

export type VideoStatusResponse = {
  video_id?: string
  session_id?: string
  status: string
  video_url: string | null
  thumbnail_url: string | null
  error: string | null
}

export type AvatarUploadResponse = {
  job_id: string
  group_id: string
  status: string
  thumbnail_url: string | null
}

export type AvatarStatusResponse = {
  job_id: string
  status: string
  avatar_id: string | null
  thumbnail_url: string | null
  error: string | null
  consent_status?: string | null
  consent_required?: boolean
}

export type OutfitId = 'professional_suit' | 'smart_casual' | 'business_casual' | 'casual' | 'default'

export const OUTFIT_OPTIONS = [
  { id: 'default', label: 'Default / None' },
  { id: 'professional_suit', label: 'Professional Navy Suit' },
  { id: 'smart_casual', label: 'Smart Casual (Blazer & Shirt)' },
  { id: 'business_casual', label: 'Business Casual (Polo / Sweater)' },
  { id: 'casual', label: 'Casual (T-shirt / Everyday)' },
]

export type OptionsFormState = {
  topic: VideoTopicId | null
  audience: AudienceId | null
  contentStyle: ContentStyleId | null
  tone: VideoToneId | null
  pacing: PacingId | null
  background: BackgroundId | null
  aspectRatio: AspectRatioId | null
  cta: VideoCtaId | null
  extraContext: string
  propertyAddress: string
  neighborhood: string
  openHouseAddress: string
  openHouseDate: string
  openHouseTime: string
  saleDetail: string
  scenarioPrompt: string
  visualEnvironment: string
  outfit: OutfitId
}

export type MarketYourselfURLState = {
  step: MarketYourselfStep
  avatar_job_id?: string
  video_id?: string
}

export type VideoTopic = {
  id: VideoTopicId
  label: string
  description: string
  icon: LucideIcon
}

export type ContentStyle = {
  id: ContentStyleId
  label: string
  description: string
  bestFor: string
  icon: LucideIcon
}

export type BackgroundOption = {
  id: BackgroundId
  label: string
  swatch: string
}

export const VIDEO_POLL_INTERVAL_MS = 10_000
export const VIDEO_MAX_AUTO_POLLS = 90
export const AVATAR_POLL_INTERVAL_MS = 10_000
export const AVATAR_MAX_AUTO_POLLS = 60

export const TELEPROMPTER_TEMPLATE = `Hi, I'm {name}, a real estate agent with Local Pro Realty in the Dallas–Fort Worth area. LocalPRO Hub is our all-in-one platform — it keeps my listings, marketing, photography, and MLS workflow in one place instead of five different tools. That means I spend less time juggling apps and more time helping North Texas families buy and sell with confidence. I'm proud to work with a team that invests in better tools, and I'm here to guide you every step of the way.`

export const VIDEO_TOPICS: VideoTopic[] = [
  { id: 'market_update', label: 'Market Update', description: "What's happening in DFW right now", icon: BarChart3 },
  { id: 'new_listing', label: 'New Listing', description: 'Announce a property you just listed', icon: Home },
  { id: 'just_sold', label: 'Just Sold', description: 'Celebrate a recently closed deal', icon: PartyPopper },
  { id: 'buyer_tips', label: 'Buyer Tips', description: "Advice for buyers in today's market", icon: Key },
  { id: 'seller_tips', label: 'Seller Tips', description: 'How sellers can get top dollar', icon: Lightbulb },
  { id: 'open_house', label: 'Open House', description: 'Invite people to an upcoming open house', icon: CalendarDays },
  { id: 'neighborhood_spotlight', label: 'Neighborhood Spotlight', description: 'Highlight a community or area', icon: MapPin },
  { id: 'why_work_with_me', label: 'Why Work With Me', description: 'Your value proposition', icon: Handshake },
  { id: 'interest_rate_update', label: 'Interest Rate Update', description: 'What rates mean for buyers and sellers', icon: Percent },
  { id: 'my_story', label: 'My Story', description: 'Your background and passion for real estate', icon: Sparkles },
]

export const AUDIENCE_OPTIONS: { id: AudienceId; label: string }[] = [
  { id: 'first_time_buyers', label: 'First-time Buyers' },
  { id: 'move_up_buyers', label: 'Move-up Buyers' },
  { id: 'sellers', label: 'Sellers' },
  { id: 'investors', label: 'Investors' },
]

export const CONTENT_STYLES: ContentStyle[] = [
  { id: 'talking_head', label: 'Talking Head', description: 'Direct to camera, professional', bestFor: 'market updates, tips', icon: Mic },
  { id: 'story_time', label: 'Story Time', description: 'Personal narrative, share an experience', bestFor: 'my story, just sold', icon: BookOpen },
  { id: 'qa_hook', label: 'Q&A Hook', description: 'Start with a question viewers are asking', bestFor: 'buyer/seller tips', icon: HelpCircle },
  { id: 'data_drop', label: 'Data Drop', description: 'Lead with a stat or number', bestFor: 'market update, rates', icon: TrendingUp },
  { id: 'announcement', label: 'Announcement', description: 'Exciting reveal format', bestFor: 'new listing, just sold', icon: Megaphone },
  { id: 'quick_tip', label: 'Quick Tip', description: 'Fast, punchy, educational', bestFor: 'tips, rates', icon: Zap },
]

export const VIDEO_TONES: { id: VideoToneId; label: string }[] = [
  { id: 'professional', label: 'Professional' },
  { id: 'warm', label: 'Warm & Personal' },
  { id: 'energetic', label: 'Energetic' },
  { id: 'educational', label: 'Educational' },
]

export const PACING_OPTIONS: { id: PacingId; label: string; hint: string }[] = [
  { id: 'slow', label: 'Slow & Clear', hint: 'Great for complex topics' },
  { id: 'normal', label: 'Normal', hint: 'Conversational' },
  { id: 'fast', label: 'Fast & Punchy', hint: 'High energy hooks' },
]

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  { id: 'clean_white', label: 'Clean White', swatch: '#FFFFFF' },
  { id: 'dark_studio', label: 'Dark Studio', swatch: '#1a1a1a' },
  { id: 'blurred_outdoor', label: 'Blurred Outdoor', swatch: '#4a7c59' },
  { id: 'office', label: 'Office', swatch: '#2c3e50' },
  { id: 'bookshelf', label: 'Bookshelf', swatch: '#8b6914' },
  { id: 'gradient', label: 'Gradient', swatch: '#667eea' },
]

export const ASPECT_RATIOS: { id: AspectRatioId; label: string; note?: string }[] = [
  { id: '9:16', label: '9:16 Vertical', note: 'Reels & TikTok' },
  { id: '16:9', label: '16:9 Horizontal', note: 'YouTube & LinkedIn' },
  { id: '1:1', label: '1:1 Square', note: 'Feed posts' },
]

export const VIDEO_CTAS: { id: VideoCtaId; label: string }[] = [
  { id: 'call_me', label: 'Call Me' },
  { id: 'visit_website', label: 'Visit My Website' },
  { id: 'dm_instagram', label: 'DM Me on Instagram' },
]

export const INITIAL_OPTIONS: OptionsFormState = {
  topic: null,
  audience: null,
  contentStyle: null,
  tone: null,
  pacing: null,
  background: null,
  aspectRatio: null,
  cta: null,
  extraContext: '',
  propertyAddress: '',
  neighborhood: '',
  openHouseAddress: '',
  openHouseDate: '',
  openHouseTime: '',
  saleDetail: '',
  scenarioPrompt: '',
  visualEnvironment: '',
  outfit: 'default',
}

export const CONSENT_APPROVED_STATUSES = new Set([
  'approved',
  'accepted',
  'completed',
  'verified',
  'granted',
])

export function isConsentApproved(consentStatus: string | null | undefined): boolean {
  if (!consentStatus) return false
  return CONSENT_APPROVED_STATUSES.has(consentStatus.toLowerCase().trim())
}

export function teleprompterScript(agentName: string): string {
  const name = agentName.trim() || 'Your Name'
  return TELEPROMPTER_TEMPLATE.replace('{name}', name)
}

export function estimateSpokenSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 2.5))
}

export function isOptionsStepValid(form: OptionsFormState): boolean {
  if (
    !form.topic ||
    !form.tone ||
    !form.pacing ||
    !form.aspectRatio ||
    !form.cta
  ) {
    return false
  }
  if (!form.scenarioPrompt.trim()) return false
  return true
}

export function readURLState(): MarketYourselfURLState {
  const params = new URLSearchParams(window.location.search)
  const step = (params.get('step') as MarketYourselfStep | null) ?? '1'
  const avatar_job_id = params.get('avatar_job_id') ?? undefined
  const video_id = params.get('video_id') ?? undefined
  return { step, avatar_job_id, video_id }
}

export function writeURLState(patch: Partial<MarketYourselfURLState>): void {
  const params = new URLSearchParams(window.location.search)
  if (patch.step) params.set('step', patch.step)
  if ('avatar_job_id' in patch) {
    if (patch.avatar_job_id) params.set('avatar_job_id', patch.avatar_job_id)
    else params.delete('avatar_job_id')
  }
  if ('video_id' in patch) {
    if (patch.video_id) params.set('video_id', patch.video_id)
    else params.delete('video_id')
  }
  const query = params.toString()
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname
  window.history.replaceState({}, '', url)
}

function normalizeVideoMime(mime: string): 'video/webm' | 'video/mp4' {
  return mime.toLowerCase().includes('mp4') ? 'video/mp4' : 'video/webm'
}

function videoFileExtension(mime: string): 'mp4' | 'webm' {
  return normalizeVideoMime(mime) === 'video/mp4' ? 'mp4' : 'webm'
}

export async function fetchAgentAvatar(): Promise<AgentAvatarProfile> {
  return api<AgentAvatarProfile>('/marketing/avatar')
}

export async function uploadAvatarVideo(
  blob: Blob,
  agentName: string,
): Promise<AvatarUploadResponse> {
  const token = await getAccessToken()
  const mime = normalizeVideoMime(blob.type)
  const uploadBlob = blob.type === mime ? blob : new Blob([blob], { type: mime })
  const formData = new FormData()
  formData.append('file', uploadBlob, `avatar-training.${videoFileExtension(mime)}`)
  formData.append('agent_name', agentName)

  const response = await fetch(`${API_BASE_URL}/marketing/upload-avatar-video`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  const data: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'detail' in data &&
      typeof (data as { detail: unknown }).detail === 'string'
        ? (data as { detail: string }).detail
        : `Upload failed (${response.status})`
    throw new ApiError(message, response.status, data)
  }
  return data as AvatarUploadResponse
}

export async function getAvatarStatus(jobId: string): Promise<AvatarStatusResponse> {
  return api<AvatarStatusResponse>(`/marketing/avatar-status/${encodeURIComponent(jobId)}`)
}

export async function getAvatarConsentStatus(): Promise<AvatarConsentResponse> {
  return api<AvatarConsentResponse>('/marketing/avatar-consent')
}

export async function startAvatarConsent(): Promise<AvatarConsentResponse> {
  return api<AvatarConsentResponse>('/marketing/avatar-consent', { method: 'POST' })
}

export async function generateTeleprompter(agentName: string): Promise<{ script: string }> {
  return api<{ script: string }>('/marketing/generate-teleprompter', {
    method: 'POST',
    body: { agent_name: agentName },
  })
}

export async function generateScript(req: ScriptRequest): Promise<ScriptResponse> {
  return api<ScriptResponse>('/marketing/generate-script', {
    method: 'POST',
    body: req,
  })
}

export async function fetchHeyGenVoices(): Promise<{
  voices: HeyGenVoice[]
  default_voice_id: string | null
}> {
  return api<{ voices: HeyGenVoice[]; default_voice_id: string | null }>(
    '/marketing/heygen-voices',
  )
}

export async function generateVideo(req: VideoRequest): Promise<VideoJobResponse> {
  return api<VideoJobResponse>('/marketing/generate-video', {
    method: 'POST',
    body: req,
  })
}

export async function getVideoStatus(videoId: string): Promise<VideoStatusResponse> {
  return api<VideoStatusResponse>(
    `/marketing/heygen-video-status/${encodeURIComponent(videoId)}`,
  )
}

export function buildScriptRequest(
  form: OptionsFormState,
  agentName: string,
  agentPhone?: string,
  refinement?: string,
  currentScript?: string,
): ScriptRequest | null {
  if (!isOptionsStepValid(form)) return null
  return {
    topic: form.topic!,
    audience: form.audience!,
    content_style: form.contentStyle!,
    tone: form.tone!,
    pacing: form.pacing!,
    cta: form.cta!,
    extra_context: form.extraContext.trim() || undefined,
    agent_name: agentName,
    agent_phone: agentPhone,
    property_address: form.propertyAddress.trim() || undefined,
    neighborhood: form.neighborhood.trim() || undefined,
    open_house_address: form.openHouseAddress.trim() || undefined,
    open_house_date: form.openHouseDate.trim() || undefined,
    open_house_time: form.openHouseTime.trim() || undefined,
    sale_detail: form.saleDetail.trim() || undefined,
    refinement,
    current_script: currentScript,
    scenario_prompt: form.scenarioPrompt.trim() || undefined,
    visual_environment: form.visualEnvironment.trim() || undefined,
    outfit: form.outfit,
  }
}

export async function generateVideoAgent(req: VideoAgentRequest): Promise<VideoAgentJobResponse> {
  return api<VideoAgentJobResponse>('/marketing/generate-video-agent', {
    method: 'POST',
    body: req,
  })
}

export async function getVideoAgentStatus(sessionId: string): Promise<VideoStatusResponse> {
  return api<VideoStatusResponse>(
    `/marketing/video-agent-status/${encodeURIComponent(sessionId)}`,
  )
}

export async function saveAvatarSettings(req: {
  avatar_type: 'digital_twin' | 'talking_photo'
  avatar_id?: string | null
  voice_id?: string | null
  talking_photo_id?: string | null
}): Promise<{ status: string }> {
  return api<{ status: string }>('/marketing/avatar-settings', {
    method: 'POST',
    body: req,
  })
}

export async function uploadAvatarPhoto(
  blob: Blob,
  agentName: string,
): Promise<{ status: string; talking_photo_id: string; thumbnail_url: string }> {
  const token = await getAccessToken()
  const formData = new FormData()
  formData.append('file', blob, 'headshot.jpg')
  formData.append('agent_name', agentName)

  const response = await fetch(`${API_BASE_URL}/marketing/upload-avatar-photo`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  const data: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'detail' in data &&
      typeof (data as { detail: unknown }).detail === 'string'
        ? (data as { detail: string }).detail
        : `Photo upload failed (${response.status})`
    throw new ApiError(message, response.status, data)
  }
  return data as { status: string; talking_photo_id: string; thumbnail_url: string }
}

