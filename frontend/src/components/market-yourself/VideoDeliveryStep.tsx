import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, Download, Loader2, RefreshCw, Share2, Check, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type VideoDeliveryStepProps = {
  status: string
  videoUrl: string | null
  error: string | null
  elapsedSeconds: number
  pollCount: number
  maxPolls: number
  isChecking: boolean
  onCheckStatus: () => void
  onResumePolling: () => void
  onTryAgain: () => void
  onGenerateAnother: () => void
  socialCaptions?: {
    instagram?: string
    tiktok?: string
    facebook?: string
  }
  postingTips?: string
}

type SocialPlatform = 'instagram' | 'tiktok' | 'facebook'

export function VideoDeliveryStep({
  status,
  videoUrl,
  error,
  elapsedSeconds,
  pollCount,
  maxPolls,
  isChecking,
  onCheckStatus,
  onResumePolling,
  onTryAgain,
  onGenerateAnother,
  socialCaptions,
  postingTips,
}: VideoDeliveryStepProps) {
  const [copySuccess, setCopySuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<SocialPlatform>('instagram')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const isCompleted = status === 'completed' && Boolean(videoUrl)
  const isFailed = status === 'failed' || Boolean(error)
  const isInProgress = !isCompleted && !isFailed
  const autoPollsExhausted = isInProgress && pollCount >= maxPolls

  useEffect(() => {
    if (!copySuccess) return
    const timer = window.setTimeout(() => setCopySuccess(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copySuccess])

  const handleCopyLink = async () => {
    if (!videoUrl) return
    try {
      await navigator.clipboard.writeText(videoUrl)
      setCopySuccess(true)
    } catch {
      setCopySuccess(false)
    }
  }

  const handleCopyCaption = async (platform: SocialPlatform, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(platform)
      window.setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      setCopiedKey(null)
    }
  }

  const handleDownload = () => {
    if (!videoUrl) return
    const link = document.createElement('a')
    link.href = videoUrl
    link.download = 'localpro-market-yourself.mp4'
    link.rel = 'noopener'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (isCompleted && videoUrl) {
    const hasCaptions = socialCaptions && (socialCaptions.instagram || socialCaptions.tiktok || socialCaptions.facebook)
    const activeCaptionText = socialCaptions?.[activeTab] || ''

    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-center gap-2 text-[#CFB87C]">
          <CheckCircle2 className="size-6 animate-pulse" />
          <h2 className="text-xl font-bold text-white">Your video is ready!</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">
          
          {/* Left Column: Video Player & Controls */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-sm border border-[#2a2a2a] bg-black shadow-2xl">
              <video
                controls
                src={videoUrl}
                className="mx-auto max-h-[60vh] w-full bg-black"
                playsInline
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handleDownload}
                className="flex-1 bg-[#CFB87C] text-[#0a0a0a] hover:bg-[#dcc487] font-semibold"
              >
                <Download className="mr-2 size-4" />
                Download MP4
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleCopyLink()}
                className="border-[#333] bg-transparent text-white hover:bg-[#1a1a1a]"
              >
                <Copy className="mr-2 size-4" />
                {copySuccess ? 'Copied!' : 'Copy Video Link'}
              </Button>
            </div>
            
            <div className="text-center pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onGenerateAnother}
                className="text-[#CFB87C] hover:text-[#dcc487] text-xs font-semibold"
              >
                Generate Another Video →
              </Button>
            </div>
          </div>

          {/* Right Column: Social Media Copy-paste Captions & Posting tips */}
          <div className="space-y-6">
            
            {/* Tabbed social caption container */}
            <div className="rounded-sm border border-[#2a2a2a] bg-[#141414] p-5 space-y-4 shadow-lg">
              <div className="flex items-center gap-1.5 text-white font-semibold text-sm">
                <Share2 className="size-4 text-[#CFB87C]" />
                <h3>Share & Post Caption</h3>
              </div>

              {hasCaptions ? (
                <>
                  {/* Platform Tabs */}
                  <div className="grid grid-cols-3 gap-1 rounded-sm bg-[#0d0d0d] p-1 border border-[#222]">
                    {(['instagram', 'tiktok', 'facebook'] as SocialPlatform[]).map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => setActiveTab(platform)}
                        className={cn(
                          'rounded-sm py-1.5 text-xs font-medium uppercase tracking-wider transition-colors',
                          activeTab === platform
                            ? 'bg-[#CFB87C]/10 text-[#CFB87C] font-semibold'
                            : 'text-gray-400 hover:text-white'
                        )}
                      >
                        {platform}
                      </button>
                    ))}
                  </div>

                  {/* Caption preview & copy box */}
                  <div className="relative rounded-sm border border-[#222] bg-[#0d0d0d] p-4 min-h-[140px] max-h-[220px] overflow-y-auto">
                    <p className="text-xs text-white leading-relaxed whitespace-pre-wrap select-all">
                      {activeCaptionText || 'No caption generated for this platform.'}
                    </p>
                  </div>

                  {activeCaptionText && (
                    <Button
                      type="button"
                      onClick={() => handleCopyCaption(activeTab, activeCaptionText)}
                      className={cn(
                        "w-full text-xs font-semibold py-2 h-9",
                        copiedKey === activeTab 
                          ? "bg-green-600 text-white hover:bg-green-500" 
                          : "bg-transparent border border-[#CFB87C] text-[#CFB87C] hover:bg-[#CFB87C]/10"
                      )}
                    >
                      {copiedKey === activeTab ? (
                        <>
                          <Check className="mr-1.5 size-3.5" />
                          Caption Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1.5 size-3.5" />
                          Copy platform caption
                        </>
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-500 italic">No social captions generated.</p>
              )}
            </div>

            {/* Posting Tips */}
            <div className="rounded-sm border border-[#2a2a2a] bg-[#141414] p-5 space-y-3 shadow-lg">
              <div className="flex items-center gap-1.5 text-white font-semibold text-sm">
                <Sparkles className="size-4 text-[#CFB87C]" />
                <h3>Tips for Posting</h3>
              </div>
              <div className="text-xs leading-relaxed text-[var(--color-text-secondary)] space-y-2 whitespace-pre-line">
                {postingTips ? (
                  postingTips
                ) : (
                  <ul className="list-disc pl-4 space-y-1.5">
                    <li>
                      <strong className="text-white">Instagram Reels:</strong> Upload as a Reel, add a hook in the first 2 lines, use 5 relevant hashtags, and choose a trending audio at low volume.
                    </li>
                    <li>
                      <strong className="text-white">TikTok:</strong> Keep captions extremely short (1-2 sentences), put the main hook on the cover frame, and post between 7-9 PM DFW time.
                    </li>
                    <li>
                      <strong className="text-white">Facebook:</strong> Post directly in DFW community groups to maximize local organic reach.
                    </li>
                  </ul>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    )
  }

  if (isFailed) {
    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-sm border border-red-500/30 bg-red-500/5 p-8 text-center">
        <h2 className="text-lg font-semibold text-white">Video generation failed</h2>
        <p className="text-sm text-red-200">{error ?? 'Something went wrong.'}</p>
        <Button
          type="button"
          onClick={onTryAgain}
          className="bg-[#CFB87C] text-[#0a0a0a] hover:bg-[#dcc487]"
        >
          <RefreshCw className="mr-2 size-4" />
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-sm border border-[#2a2a2a] bg-[#1a1a1a] p-10 text-center">
      <Loader2 className="mx-auto size-12 animate-spin text-[#CFB87C]" />
      <h2 className="text-xl font-semibold text-white">Generating your video</h2>

      <div className="mx-auto h-2 w-full max-w-xs overflow-hidden rounded-full bg-[#111]">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[#CFB87C]" />
      </div>

      {autoPollsExhausted ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Still processing on HeyGen. Use Check Status below or leave and come back — your video_id
          is saved in the URL.
        </p>
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Usually takes 1–3 minutes. This page auto-updates — no need to refresh.
        </p>
      )}

      <p className="text-xs text-[var(--color-text-secondary)]">
        ~{elapsedSeconds}s elapsed · status: {status || 'pending'}
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isChecking}
          onClick={onCheckStatus}
          className="border-[#CFB87C] bg-transparent text-[#CFB87C] hover:bg-[#CFB87C]/10"
        >
          {isChecking ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Checking...
            </>
          ) : (
            'Check Status'
          )}
        </Button>

        {autoPollsExhausted ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onResumePolling}
            className="text-[var(--color-text-secondary)] hover:text-white"
          >
            Resume auto-check
          </Button>
        ) : null}
      </div>
    </div>
  )
}
