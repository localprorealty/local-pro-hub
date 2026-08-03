import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Mic } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { NtreisFieldRenderer } from '@/components/form/NtreisFieldRenderer'
import type { NtreisSection } from '@/lib/ntreis-sections'
import { cn } from '@/lib/utils'

type SectionBlockProps = {
  section: NtreisSection
  formData: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  addressSummary?: string
  onEditAddress?: () => void
  preFilledKeys?: Set<string>
  readOnlyKeys?: Set<string>
  defaultExpanded?: boolean
  sectionRef?: (el: HTMLElement | null) => void
  children?: ReactNode
  onVoiceFill?: (sectionId: number) => void
  voiceFillActive?: boolean
}

export function SectionBlock({
  section,
  formData,
  onChange,
  addressSummary,
  onEditAddress,
  preFilledKeys,
  readOnlyKeys,
  defaultExpanded = true,
  sectionRef,
  children,
  onVoiceFill,
  voiceFillActive = false,
}: SectionBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <section
      ref={sectionRef}
      id={`section-${section.id}`}
      className="scroll-mt-24 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]"
    >
      <div className="flex w-full items-center justify-between px-5 py-4">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <span className="font-mono text-[10px] text-[#555555]">
            {String(section.id).padStart(2, '0')}
          </span>
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-white">
            {section.name}
          </h3>
        </button>
        <div className="flex items-center gap-3">
          {section.id !== 22 && onVoiceFill ? (
            <button
              type="button"
              onClick={() => onVoiceFill(section.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] transition-colors',
                voiceFillActive
                  ? 'border-[#CFB87C] bg-[#CFB87C]/15 text-[#CFB87C]'
                  : 'border-[#CFB87C]/30 text-[#CFB87C]/80 hover:border-[#CFB87C] hover:text-[#CFB87C]',
              )}
            >
              <Mic className="size-3" />
              Voice Fill
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? 'Collapse section' : 'Expand section'}
          >
            <ChevronDown
              className={cn('size-4 text-[#888888] transition-transform', expanded && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#2a2a2a] px-5 py-5">
              {children ?? (
                <div className="grid gap-5 md:grid-cols-2">
                  {section.fields.map((field) => (
                    <NtreisFieldRenderer
                      key={field.key}
                      field={field}
                      formData={formData}
                      onChange={onChange}
                      addressSummary={addressSummary}
                      onEditAddress={onEditAddress}
                      preFilledKeys={preFilledKeys}
                      readOnlyKeys={readOnlyKeys}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
