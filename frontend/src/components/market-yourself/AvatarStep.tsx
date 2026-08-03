import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Camera, Loader2, Mic, Video, Upload } from 'lucide-react'

import { IdentityVerificationStep } from '@/components/market-yourself/IdentityVerificationStep'
import { Button } from '@/components/ui/button'
// Unused AlertDialog imports removed
import {
  AVATAR_MAX_AUTO_POLLS,
  AVATAR_POLL_INTERVAL_MS,
  generateTeleprompter,
  getAvatarStatus,
  teleprompterScript,
  uploadAvatarVideo,
  saveAvatarSettings,
  uploadAvatarPhoto,
  type AgentAvatarProfile,
} from '@/lib/marketing-video'

function normalizeRecordedMime(mime: string): 'video/webm' | 'video/mp4' {
  return mime.toLowerCase().includes('mp4') ? 'video/mp4' : 'video/webm'
}

type AvatarStepProps = {
  agentName: string
  avatarProfile: AgentAvatarProfile | null
  isLoadingProfile: boolean
  avatarJobId: string | null
  onAvatarJobIdChange: (jobId: string | null) => void
  onAvatarReady: (avatarId: string) => void
  onUseExisting: () => void
  onReloadProfile: () => void
}

type RecordPhase = 'idle' | 'countdown' | 'recording' | 'preview' | 'training' | 'verifying'

const CAMERA_TIPS = [
  'Face the camera directly',
  'Good lighting (face the window)',
  'Quiet environment',
  'Keep your face visible throughout',
]

const RECORD_SECONDS = 30
const MIN_RECORDING_BYTES = 200_000

function isSafariBrowser(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

function pickRecorderMime(): string | undefined {
  const candidates = isSafariBrowser()
    ? ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']
    : [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm',
        'video/mp4',
      ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type))
}

type CanvasRecorderSession = {
  stream: MediaStream
  stop: () => void
}

function waitForVideoDimensions(videoEl: HTMLVideoElement, maxMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const ready = () => videoEl.videoWidth > 0 && videoEl.videoHeight > 0
    if (ready()) {
      resolve(true)
      return
    }
    const started = Date.now()
    const tick = () => {
      if (ready()) {
        resolve(true)
        return
      }
      if (Date.now() - started > maxMs) {
        resolve(false)
        return
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}

/**
 * Paint each preview frame to a canvas, then record the canvas stream.
 * Fixes browsers where MediaRecorder / captureStream() encode black video
 * while the on-screen preview still shows the camera feed.
 */
function startCanvasRecordingStream(
  videoEl: HTMLVideoElement,
  cameraStream: MediaStream,
): CanvasRecorderSession {
  const width = videoEl.videoWidth
  const height = videoEl.videoHeight

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    throw new Error('Canvas recording is not supported in this browser.')
  }

  let active = true
  const paintFrame = () => {
    if (!active) return
    if (videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      ctx.save()
      // Match the mirrored live preview.
      ctx.scale(-1, 1)
      ctx.drawImage(videoEl, -width, 0, width, height)
      ctx.restore()
    }
    requestAnimationFrame(paintFrame)
  }
  paintFrame()

  const canvasStream = canvas.captureStream(30)
  for (const track of cameraStream.getAudioTracks()) {
    canvasStream.addTrack(track)
  }

  return {
    stream: canvasStream,
    stop: () => {
      active = false
      canvasStream.getVideoTracks().forEach((track) => track.stop())
    },
  }
}

function cameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Camera access was blocked. Click Enable Camera and allow access in your browser settings.'
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'No camera or microphone found. Connect a camera and try again.'
    }
    if (err.name === 'NotReadableError') {
      return 'Your camera is in use by another app. Close other apps and try again.'
    }
    if (err.name === 'OverconstrainedError') {
      return 'Could not start the camera with the requested settings. Try again or use another browser.'
    }
  }
  if (!window.isSecureContext) {
    return 'Camera requires HTTPS or localhost. Open the app at http://localhost:5173.'
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Your browser does not support camera recording. Try Chrome or Safari.'
  }
  return 'Could not access the camera. Click Enable Camera to try again.'
}

export function AvatarStep({
  agentName,
  avatarProfile,
  isLoadingProfile,
  avatarJobId,
  onAvatarJobIdChange,
  onAvatarReady,
  onUseExisting,
  onReloadProfile,
}: AvatarStepProps) {
  const [showRecordFlow, setShowRecordFlow] = useState(false)
  const [phase, setPhase] = useState<RecordPhase>('idle')
  const [countdown, setCountdown] = useState(3)
  const [secondsLeft, setSecondsLeft] = useState(RECORD_SECONDS)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [trainingStatus, setTrainingStatus] = useState('processing')
  const [pollCount, setPollCount] = useState(0)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [isStartingCamera, setIsStartingCamera] = useState(false)
  const [previewPlaybackError, setPreviewPlaybackError] = useState(false)
  const [teleprompterText, setTeleprompterText] = useState<string | null>(null)
  const [isLoadingTeleprompter, setIsLoadingTeleprompter] = useState(false)
  const [pendingAvatarId, setPendingAvatarId] = useState<string | null>(null)

  // Hybrid settings states
  const [activeTab, setActiveTab] = useState<'replica' | 'photo'>('replica')
  const [customAvatarId, setCustomAvatarId] = useState('')
  const [customVoiceId, setCustomVoiceId] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  useEffect(() => {
    if (avatarProfile) {
      setActiveTab(avatarProfile.avatar_type === 'talking_photo' ? 'photo' : 'replica')
      setCustomAvatarId(avatarProfile.avatar_id || '')
      setCustomVoiceId(avatarProfile.voice_id || '')
    }
  }, [avatarProfile])

  const handleSaveSettings = async () => {
    if (!customAvatarId.trim() || !customVoiceId.trim()) {
      setError('Both Avatar ID and Voice ID are required for Video Replica.')
      return
    }
    setIsSavingSettings(true)
    setError(null)
    try {
      await saveAvatarSettings({
        avatar_type: 'digital_twin',
        avatar_id: customAvatarId.trim(),
        voice_id: customVoiceId.trim(),
      })
      onReloadProfile()
      onAvatarReady(customAvatarId.trim())
    } catch (err: any) {
      setError(err?.message || 'Failed to save avatar settings.')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingPhoto(true)
    setError(null)
    try {
      const res = await uploadAvatarPhoto(file, agentName)
      onReloadProfile()
      onAvatarReady(res.talking_photo_id)
    } catch (err: any) {
      setError(err?.message || 'Failed to upload photo.')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const videoRef = useRef<HTMLVideoElement>(null)
  const playbackRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const pollRef = useRef(0)
  const recordTimerRef = useRef<number | null>(null)
  const countdownTimerRef = useRef<number | null>(null)
  const isRecordingRef = useRef(false)
  const canvasSessionRef = useRef<CanvasRecorderSession | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraStream(null)
  }, [])

  const startCamera = useCallback(async (): Promise<boolean> => {
    setError(null)
    setIsStartingCamera(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('Unsupported', 'NotSupportedError')
      }

      stopCamera()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      })
      streamRef.current = stream
      setCameraStream(stream)
      return true
    } catch (err) {
      setError(cameraErrorMessage(err))
      return false
    } finally {
      setIsStartingCamera(false)
    }
  }, [stopCamera])

  const showRecordingUi =
    !isLoadingProfile &&
    showRecordFlow &&
    phase !== 'training' &&
    phase !== 'verifying' &&
    !avatarJobId

  useEffect(() => {
    if (!showRecordingUi && phase !== 'idle') return
    let cancelled = false
    setIsLoadingTeleprompter(true)
    void (async () => {
      try {
        const result = await generateTeleprompter(agentName)
        if (!cancelled) setTeleprompterText(result.script)
      } catch {
        if (!cancelled) setTeleprompterText(teleprompterScript(agentName))
      } finally {
        if (!cancelled) setIsLoadingTeleprompter(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agentName, showRecordingUi, phase])

  // Start camera once when the recording UI is shown. Do NOT depend on `phase` —
  // changing phase (idle → countdown → recording) must not stop/restart the stream.
  useEffect(() => {
    if (!showRecordingUi) return

    const hasLiveStream = streamRef.current
      ?.getVideoTracks()
      .some((track) => track.readyState === 'live')

    if (!hasLiveStream) {
      void startCamera()
    }

    return () => {
      if (!isRecordingRef.current) {
        stopCamera()
      }
    }
  }, [showRecordingUi, showRecordFlow, startCamera, stopCamera])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !cameraStream || phase === 'preview') return
    el.srcObject = cameraStream
    void el.play().catch(() => {
      setError('Camera preview could not start. Click Enable Camera to retry.')
    })
  }, [cameraStream, phase])

  useEffect(() => {
    if (phase !== 'preview' || !previewUrl) return
    const el = playbackRef.current
    if (!el) return

    setPreviewPlaybackError(false)
    el.src = previewUrl
    el.load()
    void el.play().catch(() => {
      // Autoplay may be blocked; controls still work.
    })
  }, [phase, previewUrl])

  useEffect(
    () => () => {
      isRecordingRef.current = false
      canvasSessionRef.current?.stop()
      canvasSessionRef.current = null
      stopCamera()
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current)
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current)
    },
    [stopCamera],
  )

  useEffect(() => {
    if (!avatarJobId || phase !== 'training') return

    pollRef.current = 0
    setPollCount(0)

    const poll = async () => {
      if (pollRef.current >= AVATAR_MAX_AUTO_POLLS) return
      pollRef.current += 1
      setPollCount(pollRef.current)
      try {
        const result = await getAvatarStatus(avatarJobId)
        setTrainingStatus(result.status)
        if (result.status === 'completed' && result.avatar_id) {
          onAvatarJobIdChange(null)
          onReloadProfile()
          setPendingAvatarId(result.avatar_id)
          if (result.consent_required) {
            setPhase('verifying')
          } else {
            onAvatarReady(result.avatar_id)
            setPhase('idle')
            setShowRecordFlow(false)
          }
          return true
        }
        if (result.status === 'failed') {
          setError(result.error ?? 'Avatar training failed.')
          setPhase('preview')
          onAvatarJobIdChange(null)
          return true
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check avatar status.')
        return true
      }
      return false
    }

    void poll()
    const timer = window.setInterval(() => {
      void poll()
    }, AVATAR_POLL_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [avatarJobId, onAvatarJobIdChange, onAvatarReady, onReloadProfile, phase])

  const clearCountdownTimer = () => {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }

  const clearRecordTimer = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
  }

  const handleStartRecording = async () => {
    if (!cameraStream) {
      const ok = await startCamera()
      if (!ok) return
    }
    if (!streamRef.current) return

    clearCountdownTimer()
    setPhase('countdown')
    setCountdown(3)
    let count = 3
    countdownTimerRef.current = window.setInterval(() => {
      count -= 1
      setCountdown(count)
      if (count <= 0) {
        clearCountdownTimer()
        void beginRecording()
      }
    }, 1000)
  }

  const beginRecording = async () => {
    const stream = streamRef.current
    const videoEl = videoRef.current
    const tracksLive = stream?.getVideoTracks().some((track) => track.readyState === 'live')
    if (!stream || !videoEl || !tracksLive) {
      setError('Camera was interrupted before recording started. Please try again.')
      setPhase('idle')
      isRecordingRef.current = false
      void startCamera()
      return
    }

    if (videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setError('Camera preview is still loading. Wait a moment and try again.')
      setPhase('idle')
      return
    }

    const hasDimensions = await waitForVideoDimensions(videoEl)
    if (!hasDimensions) {
      setError('Camera preview is not ready. Wait until you see your face, then try again.')
      setPhase('idle')
      return
    }

    chunksRef.current = []
    clearRecordTimer()
    setPreviewPlaybackError(false)
    canvasSessionRef.current?.stop()

    let canvasSession: CanvasRecorderSession
    try {
      canvasSession = startCanvasRecordingStream(videoEl, stream)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start canvas recording.')
      setPhase('idle')
      return
    }
    canvasSessionRef.current = canvasSession

    const recordStream = canvasSession.stream
    const mimeType = pickRecorderMime()
    let recorder: MediaRecorder
    try {
      recorder = mimeType
        ? new MediaRecorder(recordStream, { mimeType, videoBitsPerSecond: 2_500_000 })
        : new MediaRecorder(recordStream, { videoBitsPerSecond: 2_500_000 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start recording in this browser.')
      setPhase('idle')
      isRecordingRef.current = false
      return
    }

    recorderRef.current = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onerror = () => {
      setError('Recording failed. Please try again.')
      isRecordingRef.current = false
      clearRecordTimer()
      setPhase('idle')
      void startCamera()
    }
    recorder.onstop = () => {
      isRecordingRef.current = false
      canvasSessionRef.current?.stop()
      canvasSessionRef.current = null

      const blobType = normalizeRecordedMime(recorder.mimeType || mimeType || 'video/webm')
      const blob = new Blob(chunksRef.current, { type: blobType })

      if (blob.size < MIN_RECORDING_BYTES) {
        setError(
          'Recording looks empty or too short. Try Chrome, keep the preview visible, and record again.',
        )
        chunksRef.current = []
        setPhase('idle')
        void startCamera()
        return
      }

      setRecordedBlob(blob)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      stopCamera()
      setPhase('preview')
    }

    isRecordingRef.current = true
    // Timeslice ensures chunks are written during the full 30s, not only on stop.
    recorder.start(250)
    setPhase('recording')
    setSecondsLeft(RECORD_SECONDS)

    let remaining = RECORD_SECONDS
    recordTimerRef.current = window.setInterval(() => {
      remaining -= 1
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        clearRecordTimer()
        if (recorder.state === 'recording') {
          recorder.requestData()
          recorder.stop()
        }
      }
    }, 1000)
  }

  const handleStopEarly = () => {
    clearRecordTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      recorder.requestData()
      recorder.stop()
    }
  }

  const handleReRecord = () => {
    clearCountdownTimer()
    clearRecordTimer()
    isRecordingRef.current = false
    canvasSessionRef.current?.stop()
    canvasSessionRef.current = null
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setRecordedBlob(null)
    setError(null)
    setPreviewPlaybackError(false)
    setPhase('idle')
    setSecondsLeft(RECORD_SECONDS)
    void startCamera()
  }

  const handleUseRecording = async () => {
    if (!recordedBlob) return
    setIsUploading(true)
    setError(null)
    try {
      const result = await uploadAvatarVideo(recordedBlob, agentName)
      onAvatarJobIdChange(result.job_id)
      setTrainingStatus(result.status)
      setPhase('training')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
      setPhase('preview')
    } finally {
      setIsUploading(false)
    }
  }

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--color-text-secondary)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading your profile...
      </div>
    )
  }

  if (!showRecordFlow && phase !== 'training' && phase !== 'verifying') {
    if (avatarProfile?.has_avatar && avatarProfile.avatar_type === 'digital_twin' && avatarProfile.consent_required) {
      return (
        <IdentityVerificationStep
          consentStatus={avatarProfile.consent_status}
          onVerified={() => {
            onReloadProfile()
            if (avatarProfile.avatar_id) onAvatarReady(avatarProfile.avatar_id)
          }}
          autoStart
        />
      )
    }

    return (
      <div className="mx-auto max-w-3xl space-y-8">
        {isUploadingPhoto && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/65 backdrop-blur-md">
            <div className="flex flex-col items-center space-y-4 rounded-xl border border-[#CFB87C]/30 bg-black/80 p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
              <Loader2 className="size-10 animate-spin text-[#CFB87C]" />
              <p className="text-sm font-semibold text-white">Uploading & Animating Photo...</p>
              <p className="text-xs text-gray-400">Processing with HeyGen API</p>
            </div>
          </div>
        )}

        {avatarProfile?.has_avatar && (
          <div className="flex items-center justify-between p-4 rounded-md border border-[#CFB87C]/30 bg-[#CFB87C]/5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-[#CFB87C]" />
              <div>
                <h4 className="text-sm font-semibold text-white">Active Avatar Configured</h4>
                <p className="text-xs text-gray-400">
                  Mode: {avatarProfile.avatar_type === 'talking_photo' ? 'Talking Photo (Circular Overlay)' : 'Video Replica (Full Digital Twin)'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={onUseExisting}
              className="bg-[#CFB87C] text-[#0a0a0a] hover:bg-[#dcc487]"
            >
              Use this avatar →
            </Button>
          </div>
        )}

        <div className="space-y-6">
          <div className="flex rounded-md bg-[#111] p-1 border border-[#2a2a2a]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('replica')
                setError(null)
              }}
              className={`flex-1 rounded-sm py-2 text-center text-xs font-semibold transition-all ${
                activeTab === 'replica'
                  ? 'bg-[#CFB87C] text-[#0a0a0a]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Option 1: Video Replica (Digital Twin)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('photo')
                setError(null)
              }}
              className={`flex-1 rounded-sm py-2 text-center text-xs font-semibold transition-all ${
                activeTab === 'photo'
                  ? 'bg-[#CFB87C] text-[#0a0a0a]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Option 2: Talking Photo (Bubble Overlay)
            </button>
          </div>

          {error && (
            <div className="p-3 text-xs font-medium text-red-400 bg-red-950/20 border border-red-900/50 rounded-sm" role="alert">
              {error}
            </div>
          )}

          {activeTab === 'replica' ? (
            <div className="space-y-6 rounded-sm border border-[#2a2a2a] bg-[#141414] p-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">HeyGen Video Replica Settings</h3>
                <p className="text-xs text-gray-400 leading-relaxed font-light">
                  Connect your custom HeyGen video replica. Enter your Avatar ID and Voice ID from your HeyGen dashboard.
                </p>
              </div>

              {avatarProfile?.avatar_id && avatarProfile.avatar_type === 'digital_twin' && (
                <div className="flex flex-col items-center justify-center p-4 border border-dashed border-[#2a2a2a] bg-[#0c0c0c] rounded-sm max-w-xs mx-auto w-full">
                  {avatarProfile.thumbnail_url ? (
                    <img
                      src={avatarProfile.thumbnail_url}
                      alt="Digital Twin avatar glimpse"
                      className="max-h-32 rounded-sm object-cover border border-[#CFB87C]/30 shadow-md animate-in fade-in duration-300"
                    />
                  ) : (
                    <div className="size-16 rounded-full bg-[#111] flex items-center justify-center border border-[#2a2a2a]">
                      <Video className="size-6 text-[#CFB87C] animate-pulse" />
                    </div>
                  )}
                  <p className="text-[10px] text-[#CFB87C] font-semibold bg-[#CFB87C]/10 px-3 py-1 rounded-full uppercase tracking-wider mt-2.5">
                    Replica Avatar Configured
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    HeyGen Avatar ID (Look ID)
                  </label>
                  <input
                    type="text"
                    value={customAvatarId}
                    onChange={(e) => setCustomAvatarId(e.target.value)}
                    placeholder="e.g. 295881a3e9ba4c74a7c6be362121..."
                    className="w-full h-9 rounded-sm border border-[#2a2a2a] bg-[#0a0a0a] px-3 text-xs text-white placeholder-gray-700 focus:border-[#CFB87C] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    HeyGen Voice ID
                  </label>
                  <input
                    type="text"
                    value={customVoiceId}
                    onChange={(e) => setCustomVoiceId(e.target.value)}
                    placeholder="e.g. 06b6f4c9c10444bbac005b8a0..."
                    className="w-full h-9 rounded-sm border border-[#2a2a2a] bg-[#0a0a0a] px-3 text-xs text-white placeholder-gray-700 focus:border-[#CFB87C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="bg-[#CFB87C] text-[#0a0a0a] hover:bg-[#dcc487] disabled:opacity-50 font-semibold"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </Button>

                <span className="text-xs text-gray-600 font-light">— or —</span>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowRecordFlow(true)
                    setError(null)
                  }}
                  className="border-[#2a2a2a] text-white hover:bg-[#111]"
                >
                  Create video replica here
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 rounded-sm border border-[#2a2a2a] bg-[#141414] p-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Talking Photo Presenter</h3>
                <p className="text-xs text-gray-400 leading-relaxed font-light">
                  Upload a portrait photo. The AI animates your image as a talking circular bubble overlaying on top of listing visual components.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center p-8 border border-dashed border-[#2a2a2a] bg-[#0c0c0c] rounded-sm">
                {avatarProfile?.talking_photo_id && avatarProfile.thumbnail_url ? (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative size-24 rounded-full overflow-hidden border-2 border-[#CFB87C] shadow-lg">
                      <img
                        src={avatarProfile.thumbnail_url}
                        alt="Talking photo preview"
                        className="size-full object-cover animate-in fade-in duration-300"
                      />
                    </div>
                    <p className="text-[10px] text-[#CFB87C] font-semibold bg-[#CFB87C]/10 px-3 py-1 rounded-full uppercase tracking-wider">
                      Talking Photo Overlay Ready
                    </p>
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <Upload className="mx-auto size-8 text-gray-600 animate-pulse" />
                    <p className="text-xs text-gray-400">No presenter image uploaded yet.</p>
                  </div>
                )}

                <div className="mt-4">
                  <label className="flex h-9 cursor-pointer items-center justify-center rounded-sm border border-[#CFB87C]/50 bg-transparent px-4 text-xs font-semibold text-[#CFB87C] transition-colors hover:bg-[#CFB87C]/10">
                    <Upload className="mr-2 size-3.5" />
                    {isUploadingPhoto ? 'Uploading Photo...' : 'Upload Headshot Photo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      disabled={isUploadingPhoto}
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'verifying') {
    return (
      <IdentityVerificationStep
        consentStatus={avatarProfile?.consent_status ?? null}
        onVerified={() => {
          onReloadProfile()
          if (pendingAvatarId) {
            onAvatarReady(pendingAvatarId)
            setPendingAvatarId(null)
          } else if (avatarProfile?.avatar_id) {
            onAvatarReady(avatarProfile.avatar_id)
          }
          setPhase('idle')
          setShowRecordFlow(false)
        }}
        autoStart
      />
    )
  }

  if (phase === 'training' || avatarJobId) {
    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-sm border border-[#2a2a2a] bg-[#1a1a1a] p-10 text-center">
        <Loader2 className="mx-auto size-12 animate-spin text-[#CFB87C]" />
        <h2 className="text-xl font-semibold text-white">Creating your avatar</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Usually takes 2–5 minutes. You can leave and come back — we&apos;ll save your progress in
          the URL.
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Status: {trainingStatus} · checks: {pollCount}/{AVATAR_MAX_AUTO_POLLS}
        </p>
        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-in fade-in duration-300">
      <div>
        <button
          type="button"
          onClick={() => {
            setShowRecordFlow(false)
            setError(null)
          }}
          className="text-xs font-semibold text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          &larr; Back to Settings
        </button>
      </div>

      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-white">
          Create Your Avatar
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Record a video directly in your browser or upload a pre-recorded vertical video.
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {CAMERA_TIPS.map((tip) => (
          <li
            key={tip}
            className="rounded-sm border border-[#2a2a2a] bg-[#111] px-3 py-2 text-xs text-[var(--color-text-secondary)]"
          >
            {tip}
          </li>
        ))}
      </ul>

      <div className="relative overflow-hidden rounded-sm border border-[#2a2a2a] bg-black">
        {phase === 'preview' && previewUrl ? (
          <video
            key={previewUrl}
            ref={playbackRef}
            src={previewUrl}
            controls
            preload="auto"
            className="aspect-video w-full bg-black object-contain"
            playsInline
            onLoadedData={() => setPreviewPlaybackError(false)}
            onError={() => setPreviewPlaybackError(true)}
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="aspect-video w-full scale-x-[-1] bg-black object-cover"
          />
        )}

        {phase === 'recording' ? (
          <>
            <div
              className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-sm border border-red-500/40 bg-black/75 px-2.5 py-1.5 backdrop-blur-sm"
              aria-live="polite"
            >
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-red-500" />
              </span>
              <Mic className="size-4 shrink-0 animate-pulse text-red-300" aria-hidden />
              <span className="text-xs font-medium text-white">Recording audio</span>
            </div>
            <div className="pointer-events-none absolute top-3 right-3 flex items-center gap-1.5 rounded-sm bg-black/75 px-2 py-1 text-xs font-semibold tracking-wide text-red-400 backdrop-blur-sm">
              <Video className="size-3.5" aria-hidden />
              REC
            </div>
          </>
        ) : null}

        {phase === 'countdown' ? (
          <div className="pointer-events-none absolute top-3 right-3 flex items-center gap-2 rounded-sm bg-black/75 px-2.5 py-1.5 text-xs text-white backdrop-blur-sm">
            <Mic className="size-3.5 text-[#CFB87C]" aria-hidden />
            Microphone will record with video
          </div>
        ) : null}

        {phase === 'countdown' || phase === 'recording' ? (
          <p className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-sm bg-black/75 px-4 py-1.5 text-2xl font-semibold tabular-nums text-[#CFB87C] backdrop-blur-sm">
            {phase === 'countdown'
              ? `Starting in ${countdown}...`
              : `00:${String(secondsLeft).padStart(2, '0')}`}
          </p>
        ) : null}

        {phase !== 'preview' ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 pt-10 pb-4">
            <p className="mb-2 text-center text-[10px] font-semibold tracking-widest text-[#CFB87C] uppercase">
              Read this aloud
            </p>
            <p className="mx-auto max-h-28 overflow-y-auto text-center text-sm leading-relaxed text-white/95 sm:max-h-32 sm:text-base">
              {isLoadingTeleprompter ? (
                <span className="inline-flex items-center gap-2 text-[var(--color-text-secondary)]">
                  <Loader2 className="size-4 animate-spin" />
                  Generating your script...
                </span>
              ) : (
                teleprompterText ?? teleprompterScript(agentName)
              )}
            </p>
          </div>
        ) : null}
      </div>

      {!cameraStream && phase !== 'preview' ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isStartingCamera}
            onClick={() => void startCamera()}
            className="border-[#CFB87C] text-[#CFB87C] hover:bg-[#CFB87C]/10"
          >
            {isStartingCamera ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Requesting access...
              </>
            ) : (
              <>
                <Camera className="mr-2 size-4" />
                Enable Camera
              </>
            )}
          </Button>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Your browser should ask for camera and microphone permission.
          </p>
        </div>
      ) : phase !== 'preview' ? (
        <p className="flex items-center gap-1.5 text-xs text-[#CFB87C]">
          <Camera className="size-3.5 shrink-0" aria-hidden />
          Camera preview is live
          <span className="text-[var(--color-text-secondary)]">·</span>
          <Mic className="size-3.5 shrink-0" aria-hidden />
          Microphone ready — you&apos;re set to record.
        </p>
      ) : null}

      {phase === 'preview' && recordedBlob ? (
        <div className="space-y-1">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Preview size: {(recordedBlob.size / (1024 * 1024)).toFixed(1)} MB
            {previewPlaybackError
              ? ' — playback failed in this browser. Download the file to verify, or re-record in Chrome.'
              : null}
          </p>
          {previewUrl ? (
            <a
              href={previewUrl}
              download={`avatar-preview.${recordedBlob.type.includes('mp4') ? 'mp4' : 'webm'}`}
              className="text-xs text-[#CFB87C] underline hover:text-[#dcc487]"
            >
              Download recording to verify
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {phase === 'idle' ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={!cameraStream || isStartingCamera}
              onClick={() => void handleStartRecording()}
              className="bg-[#CFB87C] text-[#0a0a0a] hover:bg-[#dcc487] disabled:opacity-50"
            >
              <Video className="mr-2 size-4" />
              Start Recording
            </Button>
            
            <label className="flex h-9 cursor-pointer items-center justify-center rounded-sm border border-[#CFB87C]/50 bg-transparent px-4 text-xs font-semibold text-[#CFB87C] transition-colors hover:bg-[#CFB87C]/10">
              <Upload className="mr-2 size-3.5" />
              Upload Pre-recorded Video (9:16)
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    if (cameraStream) {
                      cameraStream.getTracks().forEach((track) => track.stop())
                      setCameraStream(null)
                    }
                    setRecordedBlob(file)
                    setPreviewUrl(URL.createObjectURL(file))
                    setPhase('preview')
                  }
                }}
              />
            </label>
            {avatarProfile?.has_avatar && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (cameraStream) {
                    cameraStream.getTracks().forEach((track) => track.stop())
                    setCameraStream(null)
                  }
                  setShowRecordFlow(false)
                }}
                className="text-[var(--color-text-secondary)] hover:text-white"
              >
                Cancel & Use Existing
              </Button>
            )}
          </div>
        ) : null}

        {phase === 'recording' ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleStopEarly}
            className="border-red-400/50 text-red-200 hover:bg-red-500/10"
          >
            Stop Recording
          </Button>
        ) : null}

        {phase === 'preview' ? (
          <>
            <Button
              type="button"
              onClick={() => void handleUseRecording()}
              disabled={isUploading}
              className="bg-[#CFB87C] text-[#0a0a0a] hover:bg-[#dcc487]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Use this recording'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleReRecord}
              className="text-[var(--color-text-secondary)] hover:text-white"
            >
              Re-record
            </Button>
          </>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      {isUploading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/65 backdrop-blur-md">
          <div className="relative flex flex-col items-center justify-center p-8 rounded-xl border border-[#2a2a2a] bg-[#141414]/95 max-w-sm text-center space-y-4 shadow-2xl">
            <div className="relative flex items-center justify-center">
              <div className="absolute size-14 rounded-full border-2 border-[#CFB87C]/20 animate-ping" />
              <div className="size-16 rounded-full border-2 border-transparent border-t-[#CFB87C] border-r-[#CFB87C] animate-spin" />
              <div className="absolute text-[10px] font-bold tracking-widest text-[#CFB87C] uppercase">
                LP
              </div>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-white font-heading">Uploading avatar video...</h3>
              <p className="text-[10px] text-gray-400">
                Processing and uploading to HeyGen. This may take up to a minute for larger files.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
