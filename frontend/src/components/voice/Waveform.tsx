import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

type WaveformProps = {
  energyLevel?: number
  active?: boolean
  className?: string
}

const BAR_COUNT = 5

export function Waveform({ energyLevel = 0, active = false, className }: WaveformProps) {
  const normalized = Math.min(1, energyLevel / 80)

  return (
    <div className={cn('flex h-8 items-end gap-1', className)}>
      {Array.from({ length: BAR_COUNT }).map((_, index) => {
        const phase = index * 0.4
        const height = active
          ? 20 + normalized * 28 + Math.sin(phase) * 8
          : 12 + index * 2

        return (
          <motion.div
            key={index}
            className="w-1.5 rounded-full bg-[#CFB87C]"
            animate={{
              height: active ? height : [12, 18, 12],
            }}
            transition={
              active
                ? { duration: 0.08, ease: 'easeOut' }
                : { duration: 0.8, repeat: Infinity, delay: index * 0.1 }
            }
          />
        )
      })}
    </div>
  )
}
