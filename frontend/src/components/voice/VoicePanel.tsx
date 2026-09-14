import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Loader2, Mic, Radio, X } from 'lucide-react'

import { Waveform } from '@/components/voice/Waveform'
import type { VoiceState } from '@/hooks/useVoice'
import type { NtreisField } from '@/lib/ntreis-sections'
import { getDisplayOptions } from '@/lib/voice-questions'
import { cn } from '@/lib/utils'

type VoicePanelProps = {
  open: boolean
  state: VoiceState
  sectionLabel: string
  field: NtreisField | null
  question: string
  subtitle?: string
  transcript: string
  selectedOptions: string[]
  lastFilledValue: unknown
  error: string | null
  infoMessage: string | null
  energyLevel: number
  handsFree: boolean
  onHandsFreeChange: (enabled: boolean) => void
  canGoBack: boolean
  onGoBack: () => void
  onSkip: () => void
  onEndSession: () => void
  onOptionTap: (option: string) => void
  onConfirmMultiselect: () => void
  onHoldStart: () => void
  onHoldEnd: () => void
}

function formatFilledValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

export function VoicePanel({
  open,
  state,
  sectionLabel,
  field,
  question,
  subtitle,
  transcript,
  selectedOptions,
  lastFilledValue,
  error,
  infoMessage,
  energyLevel,
  handsFree,
  onHandsFreeChange,
  canGoBack,
  onGoBack,
  onSkip,
  onEndSession,
  onOptionTap,
  onConfirmMultiselect,
  onHoldStart,
  onHoldEnd,
}: VoicePanelProps) {
  const options = getDisplayOptions(field)
  const isMultiselect = field?.type === 'multiselect'
  const panelRef = useRef<HTMLDivElement>(null)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const handleViewportChange = () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        const heightDiff = window.innerHeight - window.visualViewport.height
        setIsKeyboardOpen(heightDiff > 140)
      }
    }

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        setIsKeyboardOpen(true)
      }
    }

    const handleFocusOut = () => {
      setTimeout(() => {
        const active = document.activeElement as HTMLElement | null
        if (
          !active ||
          (active.tagName !== 'INPUT' &&
            active.tagName !== 'TEXTAREA' &&
            !active.isContentEditable)
        ) {
          handleViewportChange()
        }
      }, 120)
    }

    window.visualViewport?.addEventListener('resize', handleViewportChange)
    window.visualViewport?.addEventListener('scroll', handleViewportChange)
    window.addEventListener('focusin', handleFocusIn)
    window.addEventListener('focusout', handleFocusOut)

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange)
      window.visualViewport?.removeEventListener('scroll', handleViewportChange)
      window.removeEventListener('focusin', handleFocusIn)
      window.removeEventListener('focusout', handleFocusOut)
    }
  }, [open])

  useEffect(() => {
    if (isKeyboardOpen && panelRef.current) {
      panelRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [isKeyboardOpen])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={panelRef}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className={cn(
            'fixed right-0 bottom-0 left-0 z-50 overflow-y-auto border-t border-[#CFB87C]/20 bg-[#0f0f0f] shadow-[0_-8px_40px_rgba(0,0,0,0.5)] transition-[max-height] duration-200',
            isKeyboardOpen ? 'max-h-[220px] sm:max-h-[260px]' : 'max-h-[480px]',
          )}
        >
          <div className="flex h-10 items-center justify-between gap-3 border-b border-[#2a2a2a] px-5">
            <p className="min-w-0 truncate text-xs text-[#888888]">
              {sectionLabel || 'Voice session'}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center rounded-full border border-[#2a2a2a] p-0.5">
                <button
                  type="button"
                  onClick={() => onHandsFreeChange(false)}
                  disabled={state === 'processing'}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-medium transition-all',
                    !handsFree
                      ? 'bg-[#CFB87C] text-black'
                      : 'text-[#888888] hover:text-white',
                    'disabled:opacity-40',
                  )}
                >
                  Hold
                </button>
                <button
                  type="button"
                  onClick={() => onHandsFreeChange(true)}
                  disabled={state === 'processing'}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all',
                    handsFree
                      ? 'bg-[#CFB87C] text-black'
                      : 'text-[#888888] hover:text-white',
                    'disabled:opacity-40',
                  )}
                >
                  <Radio className="size-3" />
                  Hands-free
                </button>
              </div>
              <button
                type="button"
                onClick={onEndSession}
                className="inline-flex items-center gap-1 text-[11px] text-[#888888] hover:text-white"
              >
                Stop
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <div className={cn('space-y-4 px-5 py-5 pb-8', isKeyboardOpen && 'space-y-2.5 px-4 py-2.5 pb-3')}>
            {infoMessage && !field ? (
              <p className="font-[family-name:var(--font-display)] text-lg text-white">
                {infoMessage}
              </p>
            ) : state === 'filled' ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle2 className="size-10 text-emerald-500" />
                <p className="text-sm text-white">Saved: {formatFilledValue(lastFilledValue)}</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[11px] tracking-wider text-[#888888] uppercase">
                    {field?.label}
                  </p>
                  {field ? (
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={onGoBack}
                        disabled={
                          !canGoBack || state === 'processing' || state === 'speaking'
                        }
                        className="text-xs text-[#666666] hover:text-[#CFB87C] disabled:opacity-40"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={onSkip}
                        disabled={state === 'processing' || state === 'speaking'}
                        className="text-xs text-[#666666] hover:text-[#CFB87C] disabled:opacity-40"
                      >
                        Skip →
                      </button>
                    </div>
                  ) : null}
                </div>

                <div>
                  <h2
                    className={cn(
                      'font-[family-name:var(--font-display)] text-xl leading-snug font-semibold text-white',
                      isKeyboardOpen && 'text-base leading-tight',
                    )}
                  >
                    {state === 'speaking' ? 'Asking question...' : question}
                  </h2>
                  {subtitle && state !== 'speaking' && !isKeyboardOpen ? (
                    <p className="mt-1 text-sm text-[#888888]">{subtitle}</p>
                  ) : null}
                </div>

                {options.length > 0 ? (
                  <div
                    className={cn(
                      'mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto',
                      isKeyboardOpen && 'mt-1.5 max-h-20 gap-1.5',
                    )}
                  >
                    {options.map((option) => {
                      const selected = selectedOptions.includes(option)
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => onOptionTap(option)}
                          disabled={state === 'processing' || state === 'speaking'}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-sm transition-all select-none',
                            isKeyboardOpen && 'px-2.5 py-1 text-xs',
                            selected
                              ? 'border-[#CFB87C] bg-[#CFB87C] font-semibold text-black'
                              : 'border-[#CFB87C]/40 bg-transparent text-white hover:border-[#CFB87C]',
                            'disabled:opacity-40',
                          )}
                        >
                          {option}
                        </button>
                      )
                    })}
                  </div>
                ) : null}

                {isMultiselect && selectedOptions.length > 0 ? (
                  <button
                    type="button"
                    onClick={onConfirmMultiselect}
                    disabled={state === 'processing' || state === 'speaking'}
                    className={cn(
                      'mt-3 rounded-lg bg-[#CFB87C] px-6 py-2 text-sm font-bold text-black disabled:opacity-40',
                      isKeyboardOpen && 'mt-1.5 px-4 py-1.5 text-xs',
                    )}
                  >
                    Done — {selectedOptions.length} selected →
                  </button>
                ) : null}

                <div
                  className={cn(
                    'rounded-lg border border-[#2a2a2a] bg-[#111111] px-4 py-3',
                    isKeyboardOpen && 'px-3 py-2',
                  )}
                >
                  <p
                    className={cn(
                      'text-sm',
                      transcript ? 'text-white' : 'text-[#555555]',
                      isKeyboardOpen && 'text-xs',
                    )}
                  >
                    {transcript || 'Your answer will appear here...'}
                  </p>
                </div>

                {state === 'speaking' ? (
                  <div className="flex items-center gap-3">
                    <motion.span
                      className="font-[family-name:var(--font-display)] text-sm font-bold text-[#CFB87C]"
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    >
                      LP
                    </motion.span>
                    <p className="text-xs text-[#888888]">Asking question...</p>
                  </div>
                ) : null}

                {state === 'processing' ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="size-5 animate-spin text-[#CFB87C]" />
                    <p className="text-xs text-[#888888]">Processing your answer...</p>
                  </div>
                ) : null}

                {handsFree && (state === 'waiting' || state === 'listening') ? (
                  <div className={cn('mt-4', isKeyboardOpen && 'mt-1.5')}>
                    <div className="mb-2 flex items-center justify-center gap-2">
                      <Waveform energyLevel={energyLevel} active={state === 'listening'} />
                      <span className="text-sm text-[#CFB87C]">
                        {state === 'listening'
                          ? 'Listening — pause when done'
                          : 'Get ready to speak...'}
                      </span>
                    </div>
                    {!isKeyboardOpen ? (
                      <p className="text-center text-xs text-[#555555]">
                        Hands-free — speak your answer
                        {options.length > 0 ? ', or tap an option above' : ''}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {!handsFree && (state === 'waiting' || state === 'listening') ? (
                  <div className={cn('mt-4', isKeyboardOpen && 'mt-1.5')}>
                    {state === 'listening' ? (
                      <div className="mb-2 flex items-center justify-center gap-2">
                        <Waveform energyLevel={energyLevel} active />
                        <span className="text-sm text-[#CFB87C]">Recording...</span>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onPointerDown={onHoldStart}
                      onPointerUp={onHoldEnd}
                      onPointerLeave={onHoldEnd}
                      onPointerCancel={onHoldEnd}
                      disabled={state !== 'waiting' && state !== 'listening'}
                      className={cn(
                        'flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 py-5 transition-all select-none touch-none',
                        isKeyboardOpen && 'flex-row justify-center gap-2 rounded-lg py-2',
                        state === 'listening'
                          ? 'border-[#CFB87C] bg-[#CFB87C] text-black'
                          : 'border-[#CFB87C]/50 bg-transparent text-white hover:border-[#CFB87C]',
                      )}
                    >
                      <Mic
                        className={cn(
                          'size-8',
                          isKeyboardOpen && 'size-4',
                          state === 'listening' ? 'text-black' : 'text-[#CFB87C]',
                        )}
                      />
                      <span className={cn('text-sm font-medium', isKeyboardOpen && 'text-xs')}>
                        {state === 'listening'
                          ? 'Release when done speaking'
                          : 'Hold to answer'}
                      </span>
                    </button>

                    {!isKeyboardOpen && isMultiselect && selectedOptions.length === 0 ? (
                      <p className="mt-2 text-center text-xs text-[#555555]">
                        Or tap options above to select
                      </p>
                    ) : !isKeyboardOpen && !isMultiselect && options.length > 0 ? (
                      <p className="mt-2 text-center text-xs text-[#555555]">
                        Or tap an option above
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}

            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
