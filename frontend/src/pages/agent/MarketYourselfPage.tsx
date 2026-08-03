import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { AvatarStep } from '@/components/market-yourself/AvatarStep'
import { OptionsStep } from '@/components/market-yourself/OptionsStep'
import { ScriptReviewStep } from '@/components/market-yourself/ScriptReviewStep'
import { StepProgress } from '@/components/market-yourself/StepProgress'
import { VideoDeliveryStep } from '@/components/market-yourself/VideoDeliveryStep'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MissionShell } from '@/components/layout/MissionShell'
import {
  buildScriptRequest,
  fetchAgentAvatar,
  fetchHeyGenVoices,
  generateScript,
  generateVideoAgent,
  getVideoAgentStatus,
  INITIAL_OPTIONS,
  type AgentAvatarProfile,
  type HeyGenVoice,
  type MarketYourselfStep,
  type OptionsFormState,
  type StoryboardScene,
  VIDEO_MAX_AUTO_POLLS,
  VIDEO_POLL_INTERVAL_MS,
} from '@/lib/marketing-video'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchUserProfile } from '@/lib/users'
import { cn } from '@/lib/utils'

function MarketYourselfContent() {
  const [searchParams, setSearchParams] = useSearchParams()

  const urlStep = (searchParams.get('step') as MarketYourselfStep | null) ?? '1'
  const urlAvatarJobId = searchParams.get('avatar_job_id')
  const urlVideoId = searchParams.get('video_id')

  const [step, setStep] = useState<MarketYourselfStep>(urlStep)
  const [avatarJobId, setAvatarJobId] = useState<string | null>(urlAvatarJobId)
  const [videoId, setVideoId] = useState<string | null>(urlVideoId)
  const [avatarId, setAvatarId] = useState<string | null>(null)

  const [avatarProfile, setAvatarProfile] = useState<AgentAvatarProfile | null>(null)
  const [consentRequired, setConsentRequired] = useState(false)
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(true)
  const [optionsForm, setOptionsForm] = useState<OptionsFormState>(INITIAL_OPTIONS)
  const [script, setScript] = useState('')
  const [videoAgentPrompt, setVideoAgentPrompt] = useState('')
  const [scenes, setScenes] = useState<StoryboardScene[]>([])
  const [voices, setVoices] = useState<HeyGenVoice[]>([])
  const [voiceId, setVoiceId] = useState<string | null>(null)
  const [socialCaptions, setSocialCaptions] = useState<{
    instagram?: string
    tiktok?: string
    facebook?: string
  } | undefined>()
  const [postingTips, setPostingTips] = useState<string | undefined>()

  const [agentName, setAgentName] = useState('Your Agent')
  const [agentPhone, setAgentPhone] = useState<string | undefined>()
  const [agentEmail, setAgentEmail] = useState<string | undefined>()

  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [scriptError, setScriptError] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)

  const [videoStatus, setVideoStatus] = useState('pending')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isChecking, setIsChecking] = useState(false)
  const [pollingEpoch, setPollingEpoch] = useState(0)

  const pollCountRef = useRef(0)
  const elapsedRef = useRef(0)
  const hydrated = useRef(false)

  const syncURL = useCallback(
    (patch: { step?: MarketYourselfStep; avatar_job_id?: string | null; video_id?: string | null }) => {
      const next = new URLSearchParams(searchParams)
      if (patch.step) next.set('step', patch.step)
      if ('avatar_job_id' in patch) {
        if (patch.avatar_job_id) next.set('avatar_job_id', patch.avatar_job_id)
        else next.delete('avatar_job_id')
      }
      if ('video_id' in patch) {
        if (patch.video_id) next.set('video_id', patch.video_id)
        else next.delete('video_id')
      }
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const goToStep = useCallback(
    (nextStep: MarketYourselfStep, extra?: { avatar_job_id?: string | null; video_id?: string | null }) => {
      setStep(nextStep)
      syncURL({ step: nextStep, ...extra })
    },
    [syncURL],
  )

  const loadAvatarProfile = useCallback(async () => {
    setIsLoadingAvatar(true)
    try {
      const profile = await fetchAgentAvatar()
      setAvatarProfile(profile)
      const activeId = profile.avatar_type === 'talking_photo' ? profile.talking_photo_id : profile.avatar_id
      setAvatarId(activeId)
      if (profile.voice_id) {
        setVoiceId(profile.voice_id)
      }
      setConsentRequired(Boolean(profile.consent_required && profile.avatar_type === 'digital_twin'))
    } catch {
      setAvatarProfile(null)
    } finally {
      setIsLoadingAvatar(false)
    }
  }, [])

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    setStep(urlStep)
    setAvatarJobId(urlAvatarJobId)
    setVideoId(urlVideoId)
    if (urlStep === '4' && urlVideoId) {
      pollCountRef.current = 0
      setPollingEpoch((e) => e + 1)
    }
  }, [urlAvatarJobId, urlStep, urlVideoId])

  useEffect(() => {
    void loadAvatarProfile()
    const loadProfile = async () => {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession()
      const userId = session?.user?.id
      if (!userId) return
      const profile = await fetchUserProfile(userId)
      if (profile?.full_name) setAgentName(profile.full_name)
      if (profile?.phone) setAgentPhone(profile.phone)
      if (profile?.email) setAgentEmail(profile.email)
    }
    void loadProfile()
    const loadVoices = async () => {
      try {
        const result = await fetchHeyGenVoices()
        setVoices(result.voices)
        setVoiceId((prev) => prev || result.default_voice_id)
      } catch {
        setVoices([])
      }
    }
    void loadVoices()
  }, [loadAvatarProfile])

  useEffect(() => {
    if (searchParams.get('consent') !== 'done') return
    void loadAvatarProfile()
    if (step !== '1') goToStep('1')
  }, [goToStep, loadAvatarProfile, searchParams, step])

  const runScriptGeneration = async (refinement?: string, currentScript?: string) => {
    const req = buildScriptRequest(optionsForm, agentName, agentPhone, refinement, currentScript)
    if (!req) return

    const isRefine = Boolean(refinement)
    if (isRefine) setIsRegenerating(true)
    else setIsGeneratingScript(true)
    setScriptError(null)

    try {
      const result = await generateScript(req)
      setScript(result.script)
      setVideoAgentPrompt(result.video_agent_prompt)
      setScenes(result.scenes)
      setSocialCaptions(result.social_captions)
      setPostingTips(result.posting_tips)
      goToStep('3')
      setVideoError(null)
    } catch (error) {
      setScriptError(error instanceof Error ? error.message : 'Failed to generate script.')
    } finally {
      setIsGeneratingScript(false)
      setIsRegenerating(false)
    }
  }

  const pollVideoStatus = useCallback(async () => {
    if (!videoId) return false
    setIsChecking(true)
    try {
      const result = await getVideoAgentStatus(videoId)
      setVideoStatus(result.status)
      if (result.video_url) setVideoUrl(result.video_url)
      if (result.error) setVideoError(result.error)

      if (result.status === 'completed' || result.status === 'failed' || result.error) {
        const historyJson = localStorage.getItem('localpro_video_history')
        if (historyJson) {
          try {
            const history = JSON.parse(historyJson)
            const updated = history.map((item: any) => {
              if (item.sessionId === videoId) {
                return {
                  ...item,
                  status: result.status,
                  videoUrl: result.video_url || item.videoUrl,
                }
              }
              return item
            })
            localStorage.setItem('localpro_video_history', JSON.stringify(updated))
          } catch (e) {
            console.error(e)
          }
        }
      }

      return result.status === 'completed' || result.status === 'failed' || Boolean(result.error)
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : 'Failed to check video status.')
      return false
    } finally {
      setIsChecking(false)
    }
  }, [videoId])

  useEffect(() => {
    if (step !== '4' || !videoId) return
    if (videoStatus === 'completed' || videoStatus === 'failed' || videoError) return

    elapsedRef.current = 0
    setElapsedSeconds(0)
    const elapsedTimer = window.setInterval(() => {
      elapsedRef.current += 1
      setElapsedSeconds(elapsedRef.current)
    }, 1000)

    const poll = async () => {
      if (pollCountRef.current >= VIDEO_MAX_AUTO_POLLS) return
      pollCountRef.current += 1
      setPollCount(pollCountRef.current)
      const finished = await pollVideoStatus()
      if (finished) window.clearInterval(pollTimer)
    }

    void poll()
    const pollTimer = window.setInterval(() => {
      if (pollCountRef.current >= VIDEO_MAX_AUTO_POLLS) return
      void poll()
    }, VIDEO_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(elapsedTimer)
      window.clearInterval(pollTimer)
    }
  }, [pollVideoStatus, pollingEpoch, step, videoError, videoId, videoStatus])

  useEffect(() => {
    if (step === '4' && videoId && videoStatus === 'pending' && !videoUrl) {
      void pollVideoStatus()
    }
  }, [pollVideoStatus, step, videoId, videoStatus, videoUrl])

  const handleAvatarJobIdChange = (jobId: string | null) => {
    setAvatarJobId(jobId)
    syncURL({ avatar_job_id: jobId })
  }

  const handleGenerateVideo = async () => {
    if (!videoAgentPrompt.trim() || !avatarId || !voiceId) {
      setVideoError('Script, avatar, and voice are required.')
      return
    }
    if (!optionsForm.aspectRatio) {
      setVideoError('Aspect ratio is required.')
      return
    }

    setIsGeneratingVideo(true)
    setVideoError(null)
    setScriptError(null)
    setVideoUrl(null)
    setVideoStatus('pending')
    pollCountRef.current = 0
    setPollCount(0)
    try {
      const job = await generateVideoAgent({
        prompt: videoAgentPrompt.trim(),
        avatar_id: avatarId,
        voice_id: voiceId,
        orientation: optionsForm.aspectRatio === '16:9' ? 'landscape' : 'portrait',
        agent_name: agentName,
        script: script,
        scenes: scenes,
      })
      setVideoId(job.session_id)
      setVideoStatus(job.status)

      // Save to localStorage history list
      try {
        const newItem = {
          sessionId: job.session_id,
          timestamp: new Date().toLocaleString(),
          topic: optionsForm.topic ?? 'Market Video',
          script: script,
          status: job.status,
        }
        const historyJson = localStorage.getItem('localpro_video_history')
        const history = historyJson ? JSON.parse(historyJson) : []
        localStorage.setItem(
          'localpro_video_history',
          JSON.stringify([newItem, ...history])
        )
      } catch (e) {
        console.error('Failed to save to local storage video history list:', e)
      }

      goToStep('4', { video_id: job.session_id })
      setPollingEpoch((e) => e + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start video generation.'
      setVideoError(message)
      if (message.toLowerCase().includes('consent')) {
        setConsentRequired(true)
      }
    } finally {
      setIsGeneratingVideo(false)
    }
  }

  const handleGenerateAnother = () => {
    setOptionsForm(INITIAL_OPTIONS)
    setScript('')
    setVideoAgentPrompt('')
    setScenes([])
    setSocialCaptions(undefined)
    setPostingTips(undefined)
    setVideoId(null)
    setVideoStatus('pending')
    setVideoUrl(null)
    setVideoError(null)
    setScriptError(null)
    pollCountRef.current = 0
    setPollCount(0)
    setElapsedSeconds(0)
    goToStep('2', { video_id: null })
  }

  const handleTryAgain = () => {
    setVideoError(null)
    setVideoStatus('pending')
    setVideoId(null)
    pollCountRef.current = 0
    setPollCount(0)
    goToStep('3', { video_id: null })
  }

  const handleResumePolling = () => {
    pollCountRef.current = 0
    setPollCount(0)
    setPollingEpoch((e) => e + 1)
  }

  const handleViewHistoricalSession = (item: VideoHistoryItem) => {
    setVideoId(item.sessionId)
    setVideoStatus(item.status)
    setVideoUrl(item.videoUrl ?? null)
    setScript(item.script)
    goToStep('4', { video_id: item.sessionId })
    setPollingEpoch((e) => e + 1)
  }

  return (
    <MissionShell
      role="agent"
      title="Market Yourself"
      subtitle="Record your avatar, then generate marketing videos with AI scripts"
      email={agentEmail}
    >
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4">
          <StepProgress current={step} />
          {step !== '1' && (
            <button
              type="button"
              onClick={() => {
                if (step === '2') goToStep('1')
                else if (step === '3') goToStep('2')
                else if (step === '4') goToStep('3')
              }}
              className="flex w-fit items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-white transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back to Step {Number(step) - 1}
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {step === '1' ? (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              <AvatarStep
                agentName={agentName}
                avatarProfile={avatarProfile}
                isLoadingProfile={isLoadingAvatar}
                avatarJobId={avatarJobId}
                onAvatarJobIdChange={handleAvatarJobIdChange}
                onAvatarReady={(id) => {
                  setAvatarId(id)
                  setConsentRequired(false)
                  goToStep('2', { avatar_job_id: null })
                }}
                onUseExisting={() => goToStep('2')}
                onReloadProfile={() => void loadAvatarProfile()}
              />
              <VideoHistoryList onViewSession={handleViewHistoricalSession} />
            </motion.div>
          ) : null}

          {step === '2' ? (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
            >
              {consentRequired ? (
                <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-6 text-center">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Identity verification is still pending. Go back to Step 1 (Avatar) to complete
                    HeyGen verification before choosing video options.
                  </p>
                  <button
                    type="button"
                    onClick={() => goToStep('1')}
                    className="mt-4 text-sm font-medium text-[#CFB87C] underline hover:text-[#dcc487]"
                  >
                    ← Back to Avatar step
                  </button>
                </div>
              ) : (
                <OptionsStep
                  form={optionsForm}
                  onChange={(patch) => setOptionsForm((prev) => ({ ...prev, ...patch }))}
                  isSubmitting={isGeneratingScript}
                  onSubmit={() => void runScriptGeneration()}
                  error={scriptError}
                />
              )}
            </motion.div>
          ) : null}

          {step === '3' ? (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
            >
              <ScriptReviewStep
                script={script}
                onScriptChange={setScript}
                videoAgentPrompt={videoAgentPrompt}
                onVideoAgentPromptChange={setVideoAgentPrompt}
                scenes={scenes}
                options={optionsForm}
                voices={voices}
                voiceId={voiceId}
                onVoiceChange={setVoiceId}
                isRegenerating={isRegenerating}
                isGeneratingVideo={isGeneratingVideo}
                onRegenerate={() => void runScriptGeneration()}
                onRegenerateWithChanges={(instruction) =>
                  void runScriptGeneration(instruction, JSON.stringify({ script, scenes, video_agent_prompt: videoAgentPrompt }))
                }
                onBack={() => goToStep('2')}
                onGenerateVideo={() => void handleGenerateVideo()}
                scriptError={scriptError}
                videoError={videoError}
                consentRequired={consentRequired}
                profileVoiceId={avatarProfile?.voice_id}
              />
            </motion.div>
          ) : null}

          {step === '4' ? (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
            >
              <VideoDeliveryStep
                status={videoStatus}
                videoUrl={videoUrl}
                error={videoError}
                elapsedSeconds={elapsedSeconds}
                pollCount={pollCount}
                maxPolls={VIDEO_MAX_AUTO_POLLS}
                isChecking={isChecking}
                onCheckStatus={() => void pollVideoStatus()}
                onResumePolling={handleResumePolling}
                onTryAgain={handleTryAgain}
                onGenerateAnother={handleGenerateAnother}
                socialCaptions={socialCaptions}
                postingTips={postingTips}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Premium Loading Overlay */}
        {(isGeneratingScript || isGeneratingVideo || isRegenerating) && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/65 backdrop-blur-md">
            <div className="relative flex flex-col items-center justify-center p-8 rounded-xl border border-[#2a2a2a] bg-[#141414]/95 max-w-sm text-center space-y-4 shadow-2xl">
              <div className="relative flex items-center justify-center">
                {/* pulsing ring */}
                <div className="absolute size-14 rounded-full border-2 border-[#CFB87C]/20 animate-ping" />
                {/* spinning ring */}
                <div className="size-16 rounded-full border-2 border-transparent border-t-[#CFB87C] border-r-[#CFB87C] animate-spin" />
                {/* Center label */}
                <div className="absolute text-[10px] font-bold tracking-widest text-[#CFB87C] uppercase">
                  LP
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-white">
                  {isGeneratingVideo 
                    ? 'Initiating video generation...' 
                    : isRegenerating 
                      ? 'Regenerating video plan...' 
                      : 'Creating your script storyboard...'}
                </h3>
                <p className="text-[10px] text-gray-400">
                  Please wait a moment. Do not close this page.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </MissionShell>
  )
}

export default function MarketYourselfPage() {
  return (
    <ErrorBoundary title="Market Yourself">
      <MarketYourselfContent />
    </ErrorBoundary>
  )
}

type VideoHistoryItem = {
  sessionId: string
  timestamp: string
  topic: string
  script: string
  videoUrl?: string | null
  status: string
}

function VideoHistoryList({ onViewSession }: { onViewSession: (item: VideoHistoryItem) => void }) {
  const [history, setHistory] = useState<VideoHistoryItem[]>([])

  useEffect(() => {
    const historyJson = localStorage.getItem('localpro_video_history')
    if (historyJson) {
      try {
        setHistory(JSON.parse(historyJson))
      } catch (e) {
        console.error(e)
      }
    }
  }, [])

  if (history.length === 0) return null

  return (
    <div className="rounded-sm border border-[#2a2a2a] bg-[#141414] p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Your Video History</h3>
        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
          Previously generated marketing videos. Click to watch or track status.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {history.map((item) => (
          <div
            key={item.sessionId}
            className="flex flex-col justify-between p-4 rounded-sm border border-[#222] bg-[#0c0c0c] hover:border-[#CFB87C]/30 transition-all space-y-3"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#CFB87C] uppercase tracking-wider bg-[#CFB87C]/10 px-2 py-0.5 rounded-full">
                  {item.topic.replace('_', ' ')}
                </span>
                <span className="text-[9px] text-gray-500 font-light">{item.timestamp}</span>
              </div>
              <p className="text-xs font-medium text-white line-clamp-2 leading-relaxed">
                "{item.script}"
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#1a1a1a]">
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-wider",
                item.status === 'completed' ? 'text-green-400' :
                item.status === 'failed' ? 'text-red-400' : 'text-amber-400 animate-pulse'
              )}>
                ● {item.status}
              </span>
              
              <button
                type="button"
                onClick={() => onViewSession(item)}
                className="text-[10px] font-bold text-[#CFB87C] hover:text-[#dcc487] transition-colors"
              >
                {item.status === 'completed' ? 'Watch Video →' : 'Check Status →'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
