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

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed right-0 bottom-0 left-0 z-50 max-h-[480px] overflow-y-auto border-t border-[#CFB87C]/20 bg-[#0f0f0f] shadow-[0_-8px_40px_rgba(0,0,0,0.5)]"
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

          <div className="space-y-4 px-5 py-5 pb-8">
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
                  <h2 className="font-[family-name:var(--font-display)] text-xl leading-snug font-semibold text-white">
                    {state === 'speaking' ? 'Asking question...' : question}
                  </h2>
                  {subtitle && state !== 'speaking' ? (
                    <p className="mt-1 text-sm text-[#888888]">{subtitle}</p>
                  ) : null}
                </div>

                {options.length > 0 ? (
                  <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
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
                    className="mt-3 rounded-lg bg-[#CFB87C] px-6 py-2 text-sm font-bold text-black disabled:opacity-40"
                  >
                    Done — {selectedOptions.length} selected →
                  </button>
                ) : null}

                <div className="rounded-lg border border-[#2a2a2a] bg-[#111111] px-4 py-3">
                  <p className={cn('text-sm', transcript ? 'text-white' : 'text-[#555555]')}>
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
                  <div className="mt-4">
                    <div className="mb-3 flex items-center justify-center gap-2">
                      <Waveform energyLevel={energyLevel} active={state === 'listening'} />
                      <span className="text-sm text-[#CFB87C]">
                        {state === 'listening'
                          ? 'Listening — pause when done'
                          : 'Get ready to speak...'}
                      </span>
                    </div>
                    <p className="text-center text-xs text-[#555555]">
                      Hands-free — speak your answer
                      {options.length > 0 ? ', or tap an option above' : ''}
                    </p>
                  </div>
                ) : null}

                {!handsFree && (state === 'waiting' || state === 'listening') ? (
                  <div className="mt-4">
                    {state === 'listening' ? (
                      <div className="mb-3 flex items-center justify-center gap-2">
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
                        state === 'listening'
                          ? 'border-[#CFB87C] bg-[#CFB87C] text-black'
                          : 'border-[#CFB87C]/50 bg-transparent text-white hover:border-[#CFB87C]',
                      )}
                    >
                      <Mic
                        className={cn(
                          'size-8',
                          state === 'listening' ? 'text-black' : 'text-[#CFB87C]',
                        )}
                      />
                      <span className="text-sm font-medium">
                        {state === 'listening'
                          ? 'Release when done speaking'
                          : 'Hold to answer'}
                      </span>
                    </button>

                    {isMultiselect && selectedOptions.length === 0 ? (
                      <p className="mt-2 text-center text-xs text-[#555555]">
                        Or tap options above to select
                      </p>
                    ) : !isMultiselect && options.length > 0 ? (
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
