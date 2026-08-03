import { motion } from 'framer-motion'
import { Loader2, Mic, MicOff } from 'lucide-react'

import type { VoiceState } from '@/hooks/useVoice'
import { cn } from '@/lib/utils'

type VoiceButtonProps = {
  state: VoiceState
  sessionActive: boolean
  onClick: () => void
}

export function VoiceButton({ state, sessionActive, onClick }: VoiceButtonProps) {
  const listening = state === 'listening'
  const processing = state === 'processing'

  return (
    <div className="fixed right-6 bottom-20 z-40">
      {listening ? (
        <>
          {[0, 1, 2].map((ring) => (
            <motion.span
              key={ring}
              className="pointer-events-none absolute inset-0 rounded-full border border-[#CFB87C]/50"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.8 + ring * 0.3, opacity: 0 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: ring * 0.4,
                ease: 'easeOut',
              }}
            />
          ))}
        </>
      ) : null}

      <button
        type="button"
        onClick={onClick}
        aria-label={sessionActive ? 'Voice Fill active' : 'Voice Fill — all sections'}
        title={sessionActive ? 'Voice Fill active' : 'Voice Fill — all unfilled fields'}
        className={cn(
          'relative flex size-14 items-center justify-center rounded-full bg-[#CFB87C] text-black shadow-[0_0_24px_rgba(207,184,124,0.45)] transition-transform hover:scale-105',
          sessionActive && 'ring-2 ring-[#CFB87C]/60 ring-offset-2 ring-offset-[#0a0a0a]',
        )}
      >
        {processing ? (
          <Loader2 className="size-6 animate-spin" />
        ) : sessionActive && !listening ? (
          <MicOff className="size-6" />
        ) : (
          <Mic className="size-6" />
        )}
      </button>
    </div>
  )
}
