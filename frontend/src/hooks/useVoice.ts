import { useCallback, useEffect, useRef, useState } from 'react'

import { extractFieldValue, transcribeAudio } from '@/lib/voice-api'
import { createVAD, getAudioEnergy } from '@/lib/vad'
import {
  buildVoiceQueue,
  generateQuestion,
  questionSpeakText,
  wantsOptionalFields,
  type QueuedVoiceField,
  type VoiceQuestion,
} from '@/lib/voice-questions'
import type { NtreisField } from '@/lib/ntreis-sections'
import { speak, stopSpeaking } from '@/lib/tts'

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'waiting'
  | 'filled'

type UseVoiceOptions = {
  formData: Record<string, unknown>
  onFieldChange: (key: string, value: unknown) => void
}

export type StartVoiceSessionOptions = {
  includeOptional?: boolean
  sectionId?: number
}

export function useVoice({ formData, onFieldChange }: UseVoiceOptions) {
  const [sessionOpen, setSessionOpen] = useState(false)
  const [state, setState] = useState<VoiceState>('idle')
  const [currentItem, setCurrentItem] = useState<QueuedVoiceField | null>(null)
  const [transcript, setTranscript] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [lastExtractedValue, setLastExtractedValue] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [energyLevel, setEnergyLevel] = useState(0)
  const [questionCopy, setQuestionCopy] = useState<VoiceQuestion>({ question: '' })
  const [handsFree, setHandsFreeState] = useState(false)
  const [sessionSectionId, setSessionSectionId] = useState<number | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)

  const queueRef = useRef<QueuedVoiceField[]>([])
  const historyRef = useRef<QueuedVoiceField[]>([])
  const sessionSectionIdRef = useRef<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const mimeTypeRef = useRef('audio/webm')
  const energyCleanupRef = useRef<(() => void) | null>(null)
  const energyPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const vadCleanupRef = useRef<(() => void) | null>(null)
  const autoListenRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const discardRecordingRef = useRef(false)
  const handsFreeRef = useRef(false)
  const handleTranscribeBlobRef = useRef<(blob: Blob) => Promise<void>>(async () => {})
  const formDataRef = useRef(formData)
  const currentItemRef = useRef(currentItem)
  const stateRef = useRef(state)

  useEffect(() => {
    formDataRef.current = formData
    currentItemRef.current = currentItem
    stateRef.current = state
    handsFreeRef.current = handsFree
    sessionSectionIdRef.current = sessionSectionId
  }, [formData, currentItem, state, handsFree, sessionSectionId])

  const clearAutoListen = useCallback(() => {
    if (autoListenRef.current) {
      clearTimeout(autoListenRef.current)
      autoListenRef.current = null
    }
  }, [])

  const cleanupRecording = useCallback(() => {
    clearAutoListen()
    vadCleanupRef.current?.()
    vadCleanupRef.current = null
    energyCleanupRef.current?.()
    energyCleanupRef.current = null
    if (energyPollRef.current) {
      clearInterval(energyPollRef.current)
      energyPollRef.current = null
    }
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try {
        mediaRecorderRef.current?.stop()
      } catch {
        /* already stopped */
      }
    }
    mediaRecorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setEnergyLevel(0)
  }, [clearAutoListen])

  const endSession = useCallback(() => {
    stopSpeaking()
    cleanupRecording()
    setSessionOpen(false)
    setState('idle')
    setCurrentItem(null)
    setTranscript('')
    setSelectedOptions([])
    setError(null)
    setInfoMessage(null)
    queueRef.current = []
    historyRef.current = []
    setCanGoBack(false)
    setSessionSectionId(null)
    sessionSectionIdRef.current = null
  }, [cleanupRecording])

  const applyFieldValue = useCallback(
    (field: NtreisField, value: unknown) => {
      if (value === null || value === undefined) return
      setLastExtractedValue(value)
      onFieldChange(field.key, value)
    },
    [onFieldChange],
  )

  const startListeningInternal = useCallback(async () => {
    if (stateRef.current !== 'waiting' || !currentItemRef.current) return
    if (mediaRecorderRef.current) return

    setError(null)
    chunksRef.current = []
    setState('listening')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      mimeTypeRef.current = mimeType

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        mediaRecorderRef.current = null
        vadCleanupRef.current?.()
        vadCleanupRef.current = null
        energyCleanupRef.current?.()
        energyCleanupRef.current = null
        if (energyPollRef.current) {
          clearInterval(energyPollRef.current)
          energyPollRef.current = null
        }
        setEnergyLevel(0)

        if (discardRecordingRef.current) {
          discardRecordingRef.current = false
          chunksRef.current = []
          return
        }

        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
        chunksRef.current = []
        void handleTranscribeBlobRef.current(blob)
      }

      recorder.start(100)

      const energy = getAudioEnergy(stream)
      energyCleanupRef.current = energy.cleanup
      energyPollRef.current = setInterval(() => {
        setEnergyLevel(energy.getEnergy())
      }, 50)

      if (handsFreeRef.current) {
        vadCleanupRef.current = createVAD(
          stream,
          () => {
            if (stateRef.current !== 'listening') return
            vadCleanupRef.current?.()
            vadCleanupRef.current = null
            setState('processing')
            mediaRecorderRef.current?.stop()
          },
          { silenceDurationMs: 1500 },
        )
      }
    } catch {
      setError('Microphone access denied. Check browser permissions.')
      setState('waiting')
      cleanupRecording()
    }
  }, [cleanupRecording])

  const scheduleAutoListen = useCallback(() => {
    clearAutoListen()
    if (!handsFreeRef.current) return
    autoListenRef.current = setTimeout(() => {
      void startListeningInternal()
    }, 500)
  }, [clearAutoListen, startListeningInternal])

  const resumeWaiting = useCallback(() => {
    setState('waiting')
    scheduleAutoListen()
  }, [scheduleAutoListen])

  const askQuestion = useCallback(
    (item: QueuedVoiceField) => {
      const q = generateQuestion(item.field)
      setQuestionCopy(q)
      setTranscript('')
      setSelectedOptions([])
      setState('speaking')

      void speak(questionSpeakText(item.field), () => {
        resumeWaiting()
      })
    },
    [resumeWaiting],
  )

  const moveToNextField = useCallback(() => {
    queueRef.current.shift()
    const next = queueRef.current[0] ?? null
    setCurrentItem(next)

    if (!next) {
      const scopedSectionId = sessionSectionIdRef.current
      const doneMessage = scopedSectionId
        ? 'Section complete! All required fields in this section are filled.'
        : 'All done! All required fields have been filled.'
      setState('speaking')
      void speak(doneMessage, () => {
        endSession()
      })
      return
    }

    askQuestion(next)
  }, [askQuestion, endSession])

  const fillAndAdvance = useCallback(
    async (field: NtreisField, value: unknown) => {
      const current = currentItemRef.current
      if (current) {
        historyRef.current.push(current)
        setCanGoBack(true)
      }
      applyFieldValue(field, value)
      setState('filled')
      await new Promise((resolve) => setTimeout(resolve, 500))
      moveToNextField()
    },
    [applyFieldValue, moveToNextField],
  )

  const processTranscript = useCallback(
    async (text: string) => {
      const current = currentItemRef.current
      if (!current) return

      setState('processing')
      setTranscript(text)

      if (wantsOptionalFields(text)) {
        const rebuilt = buildVoiceQueue(
          formDataRef.current,
          true,
          sessionSectionIdRef.current ?? undefined,
        )
        const remaining = rebuilt.filter(
          (item) => !queueRef.current.some((q) => q.field.key === item.field.key),
        )
        queueRef.current = [...queueRef.current, ...remaining]
      }

      if (!text.trim()) {
        const retryMsg = handsFreeRef.current
          ? "I didn't catch that. Please try again."
          : "I didn't catch that. Hold the button and try again."
        setState('speaking')
        void speak(retryMsg, () => {
          resumeWaiting()
        })
        return
      }

      try {
        const extracted = await extractFieldValue({
          transcription: text,
          field_key: current.field.key,
          field_type: current.field.type,
          field_label: current.field.label,
          options: current.field.options,
          current_value: formDataRef.current[current.field.key] as
            | string
            | string[]
            | undefined,
        })

        if (extracted.confident && extracted.value !== null && extracted.value !== undefined) {
          await fillAndAdvance(current.field, extracted.value)
          return
        }

        const clarification =
          extracted.clarification_needed ??
          "I wasn't sure about that. Could you try again?"
        setState('speaking')
        void speak(clarification, () => {
          resumeWaiting()
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Voice processing failed')
        resumeWaiting()
      }
    },
    [fillAndAdvance, resumeWaiting],
  )

  const handleTranscribeBlob = useCallback(
    async (blob: Blob) => {
      if (blob.size < 1000) {
        resumeWaiting()
        return
      }

      try {
        const result = await transcribeAudio(blob)
        await processTranscript(result.text)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transcription failed')
        resumeWaiting()
      }
    },
    [processTranscript, resumeWaiting],
  )

  useEffect(() => {
    handleTranscribeBlobRef.current = handleTranscribeBlob
  }, [handleTranscribeBlob])

  const handleHoldStart = useCallback(async () => {
    if (handsFreeRef.current) return
    if (stateRef.current !== 'waiting' || !currentItemRef.current) return
    stopSpeaking()
    await startListeningInternal()
  }, [startListeningInternal])

  const setHandsFree = useCallback(
    (enabled: boolean) => {
      handsFreeRef.current = enabled
      setHandsFreeState(enabled)

      if (!enabled) {
        clearAutoListen()
        if (stateRef.current === 'listening') {
          discardRecordingRef.current = true
          vadCleanupRef.current?.()
          vadCleanupRef.current = null
          const recorder = mediaRecorderRef.current
          if (recorder && recorder.state !== 'inactive') {
            setState('waiting')
            recorder.stop()
          } else {
            cleanupRecording()
            setState('waiting')
          }
        }
        return
      }

      if (stateRef.current === 'waiting' && currentItemRef.current) {
        scheduleAutoListen()
      }
    },
    [clearAutoListen, cleanupRecording, scheduleAutoListen],
  )

  const handleHoldEnd = useCallback(() => {
    if (handsFreeRef.current) return
    if (stateRef.current !== 'listening') return
    if (!mediaRecorderRef.current) return

    setState('processing')
    mediaRecorderRef.current.stop()
  }, [])

  const startSession = useCallback(
    (options: StartVoiceSessionOptions = {}) => {
      const { includeOptional = false, sectionId } = options

      stopSpeaking()
      cleanupRecording()
      setError(null)
      setInfoMessage(null)
      setSelectedOptions([])
      historyRef.current = []
      setCanGoBack(false)
      setSessionSectionId(sectionId ?? null)
      sessionSectionIdRef.current = sectionId ?? null

      const queue = buildVoiceQueue(formDataRef.current, includeOptional, sectionId)
      if (queue.length === 0) {
        setSessionOpen(true)
        setInfoMessage(
          sectionId
            ? 'All required fields in this section are already filled!'
            : 'All required fields are already filled!',
        )
        setState('waiting')
        setCurrentItem(null)
        return
      }

      queueRef.current = [...queue]
      setCurrentItem(queue[0])
      setSessionOpen(true)
      askQuestion(queue[0])
    },
    [askQuestion, cleanupRecording],
  )

  const startSectionSession = useCallback(
    (sectionId: number) => {
      startSession({ sectionId })
    },
    [startSession],
  )

  const goBack = useCallback(() => {
    if (historyRef.current.length === 0) return
    if (stateRef.current === 'processing' || stateRef.current === 'speaking') return

    stopSpeaking()
    cleanupRecording()

    const prev = historyRef.current.pop()!
    setCanGoBack(historyRef.current.length > 0)

    const current = currentItemRef.current
    if (current) {
      queueRef.current.unshift(current)
    }
    queueRef.current.unshift(prev)
    setCurrentItem(prev)
    setSelectedOptions([])
    setTranscript('')
    askQuestion(prev)
  }, [askQuestion, cleanupRecording])

  const skipField = useCallback(() => {
    stopSpeaking()
    cleanupRecording()
    moveToNextField()
  }, [cleanupRecording, moveToNextField])

  const handleOptionTap = useCallback(
    (option: string) => {
      const current = currentItemRef.current
      if (!current) return
      if (stateRef.current === 'processing' || stateRef.current === 'speaking') return

      stopSpeaking()
      cleanupRecording()

      if (current.field.type === 'multiselect') {
        setSelectedOptions((prev) =>
          prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option],
        )
        return
      }

      void fillAndAdvance(current.field, option)
    },
    [cleanupRecording, fillAndAdvance],
  )

  const confirmMultiselect = useCallback(() => {
    const current = currentItemRef.current
    if (!current || current.field.type !== 'multiselect') return
    if (selectedOptions.length === 0) return

    stopSpeaking()
    cleanupRecording()
    void fillAndAdvance(current.field, [...selectedOptions])
  }, [cleanupRecording, fillAndAdvance, selectedOptions])

  const onMicClick = useCallback(() => {
    if (!sessionOpen) {
      startSession()
      return
    }
    if (state === 'speaking') {
      stopSpeaking()
      resumeWaiting()
    }
  }, [resumeWaiting, sessionOpen, startSession, state])

  useEffect(() => {
    return () => {
      endSession()
    }
  }, [endSession])

  const sectionLabel = currentItem
    ? `Voice Fill · Section ${currentItem.sectionId} · ${currentItem.sectionName}`
    : sessionSectionId
      ? `Voice Fill · Section ${sessionSectionId}`
      : 'Voice Fill'

  return {
    state,
    sessionActive: sessionOpen,
    sessionSectionId,
    canGoBack,
    currentField: currentItem?.field ?? null,
    currentSectionId: currentItem?.sectionId ?? 0,
    currentSectionName: currentItem?.sectionName ?? '',
    sectionLabel,
    transcript,
    selectedOptions,
    lastExtractedValue,
    question: questionCopy.question,
    subtitle: questionCopy.subtitle,
    error,
    infoMessage,
    energyLevel,
    handsFree,
    setHandsFree,
    startSession,
    startSectionSession,
    goBack,
    skipField,
    endSession,
    handleOptionTap,
    confirmMultiselect,
    handleHoldStart,
    handleHoldEnd,
    onMicClick,
  }
}
