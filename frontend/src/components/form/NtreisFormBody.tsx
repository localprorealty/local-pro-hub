import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Menu } from 'lucide-react'
import { motion } from 'framer-motion'

import { ReviewSection } from '@/components/form/ReviewSection'
import { SectionBlock } from '@/components/form/SectionBlock'
import { SectionNav } from '@/components/form/SectionNav'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  NTREIS_SECTIONS,
  countRequiredRemaining,
  getSectionStatus,
  getVisibleSections,
  type SectionStatus,
} from '@/lib/ntreis-sections'
import {
  formatPropertyAddress,
  updateListingFormData,
  updateListingStage,
  type PropertyAddress,
} from '@/lib/listings'
import { VoiceButton } from '@/components/voice/VoiceButton'
import { VoicePanel } from '@/components/voice/VoicePanel'
import { useVoice } from '@/hooks/useVoice'
import { cn } from '@/lib/utils'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type NtreisFormBodyProps = {
  listingId: string
  initialFormData: Record<string, unknown>
  address: PropertyAddress
  agentMlsId: string | null
  retsFormPatch?: Record<string, unknown>
  initialPreFilledKeys?: string[]
  onEditAddress: () => void
  onStageAdvanced?: () => void
}

function formatSavedLabel(savedAt: Date | null): string {
  if (!savedAt) return 'Saved'
  const diffMs = Date.now() - savedAt.getTime()
  if (diffMs < 10_000) return 'Saved'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Saved just now'
  return `Saved ${mins}m ago`
}

export function NtreisFormBody({
  listingId,
  initialFormData,
  address,
  agentMlsId,
  retsFormPatch = {},
  initialPreFilledKeys = [],
  onEditAddress,
  onStageAdvanced,
}: NtreisFormBodyProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const base = { ...initialFormData, ...retsFormPatch }
    if (agentMlsId && !base.agent_id) {
      base.agent_id = agentMlsId
    }
    if (!base.supervisor_id) {
      base.supervisor_id = 'Tricia Andrews (0543406)'
    }
    return base
  })
  const [activeSectionId, setActiveSectionId] = useState(1)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [stageSubmitting, setStageSubmitting] = useState(false)
  const [stageError, setStageError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({})
  const formDataRef = useRef(formData)

  useEffect(() => {
    formDataRef.current = formData
  }, [formData])

  const visibleSections = useMemo(() => getVisibleSections(formData), [formData])

  const sectionStatuses = useMemo(() => {
    const map: Record<number, SectionStatus> = {}
    for (const section of NTREIS_SECTIONS) {
      map[section.id] = getSectionStatus(section, formData)
    }
    return map
  }, [formData])

  const requiredRemaining = useMemo(
    () => countRequiredRemaining(visibleSections, formData),
    [visibleSections, formData],
  )

  const completeSectionCount = useMemo(
    () => visibleSections.filter((s) => sectionStatuses[s.id] === 'complete').length,
    [visibleSections, sectionStatuses],
  )

  const readOnlyKeys = useMemo(() => new Set(['agent_id']), [])
  const preFilledKeys = useMemo(() => {
    const keys = new Set<string>()
    if (agentMlsId) keys.add('agent_id')
    const stored = initialFormData._rets_prefilled_keys
    if (Array.isArray(stored)) {
      for (const key of stored) {
        if (typeof key === 'string') keys.add(key)
      }
    }
    for (const key of initialPreFilledKeys) {
      keys.add(key)
    }
    return keys
  }, [agentMlsId, initialFormData._rets_prefilled_keys, initialPreFilledKeys])
  const addressSummary = formatPropertyAddress(address)

  const persist = useCallback(
    async (patch: Record<string, unknown>) => {
      setSaveStatus('saving')
      const ok = await updateListingFormData(listingId, patch)
      if (ok) {
        setSaveStatus('saved')
        setSavedAt(new Date())
      } else {
        setSaveStatus('error')
      }
      return ok
    },
    [listingId],
  )

  const scheduleSave = useCallback(
    (next: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void persist(next)
      }, 2000)
    },
    [persist],
  )

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      setFormData((prev) => {
        const next = { ...prev, [key]: value }
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave],
  )

  const voice = useVoice({ formData, onFieldChange: handleFieldChange })

  useEffect(() => {
    if (agentMlsId && !formData.agent_id) {
      handleFieldChange('agent_id', agentMlsId)
    }
  }, [agentMlsId]) // eslint-disable-line react-hooks/exhaustive-deps -- seed once from profile

  useEffect(() => {
    if (!formData.supervisor_id) {
      handleFieldChange('supervisor_id', 'Tricia Andrews (0543406)')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- seed once on mount

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const scrollToSection = (sectionId: number) => {
    setActiveSectionId(sectionId)
    const el = sectionRefs.current[sectionId]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const navigateSection = (direction: -1 | 1) => {
    const idx = visibleSections.findIndex((s) => s.id === activeSectionId)
    const nextIdx = idx + direction
    if (nextIdx >= 0 && nextIdx < visibleSections.length) {
      scrollToSection(visibleSections[nextIdx].id)
    }
  }

  const handleContinueToDocs = async () => {
    setStageSubmitting(true)
    setStageError(null)
    const ok = await persist(formDataRef.current)
    if (!ok) {
      setStageError('Failed to save. Try again.')
      setStageSubmitting(false)
      return
    }
    const stageOk = await updateListingStage(listingId, 'docs_pending')
    if (!stageOk) {
      setStageError('Failed to advance listing stage. Try again.')
      setStageSubmitting(false)
      return
    }
    setStageSubmitting(false)
    onStageAdvanced?.()
  }

  const saveLabel =
    saveStatus === 'saving'
      ? 'Saving...'
      : saveStatus === 'error'
        ? 'Save error'
        : formatSavedLabel(savedAt)

  const SaveIcon =
    saveStatus === 'error'
      ? AlertCircle
      : saveStatus === 'saving'
        ? Loader2
        : CheckCircle2

  const progressPct =
    visibleSections.length > 0
      ? Math.round((completeSectionCount / visibleSections.length) * 100)
      : 0

  const navPanel = (
    <SectionNav
      sections={visibleSections}
      activeSectionId={activeSectionId}
      sectionStatuses={sectionStatuses}
      requiredRemaining={requiredRemaining}
      onSelect={scrollToSection}
    />
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-[52px]">
      <div className="flex flex-1">
        <aside className="sticky top-[57px] hidden h-[calc(100svh-57px-52px)] w-[260px] shrink-0 overflow-y-auto border-r border-[#2a2a2a] bg-[#111111] p-4 lg:block">
          {navPanel}
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mb-4 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  className="border-[#2a2a2a] bg-[#1a1a1a] text-white"
                >
                  <Menu className="size-4" />
                  Sections ({visibleSections.length})
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle className="text-[#CFB87C]">NTREIS Form</SheetTitle>
                  <SheetDescription className="sr-only">
                    Navigate between sections in the NTREIS listing form.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 flex-1 overflow-y-auto">{navPanel}</div>
              </SheetContent>
            </Sheet>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-auto max-w-3xl space-y-4"
          >
            {visibleSections.map((section) => (
              <SectionBlock
                key={section.id}
                section={section}
                formData={formData}
                onChange={handleFieldChange}
                addressSummary={addressSummary}
                onEditAddress={onEditAddress}
                readOnlyKeys={readOnlyKeys}
                preFilledKeys={preFilledKeys}
                sectionRef={(el) => {
                  sectionRefs.current[section.id] = el
                }}
                onVoiceFill={voice.startSectionSession}
                voiceFillActive={
                  voice.sessionActive && voice.sessionSectionId === section.id
                }
              >
                {section.id === 22 ? (
                  <ReviewSection
                    sections={NTREIS_SECTIONS}
                    formData={formData}
                    onContinue={() => void handleContinueToDocs()}
                    isSubmitting={stageSubmitting}
                    submitError={stageError}
                  />
                ) : undefined}
              </SectionBlock>
            ))}
          </motion.div>
        </div>
      </div>

      <footer className="fixed right-0 bottom-0 left-0 z-30 flex h-[52px] items-center justify-between border-t border-[#2a2a2a] bg-[#0a0a0a] px-4 md:px-8">
        <div className="flex items-center gap-2 text-xs text-[#888888]">
          <SaveIcon
            className={cn(
              'size-3.5',
              saveStatus === 'error' && 'text-red-400',
              saveStatus === 'saving' && 'animate-spin text-[#888888]',
              saveStatus === 'saved' && 'text-[#CFB87C]',
            )}
          />
          <span
            className={cn(
              saveStatus === 'error' && 'text-red-400',
              saveStatus === 'saved' && 'text-[#CFB87C]',
            )}
          >
            {saveLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-[#888888] sm:inline">
            {completeSectionCount} of {visibleSections.length} sections complete
          </span>
          <div className="h-1 w-12 overflow-hidden rounded-full bg-[#2a2a2a]">
            <div
              className="h-full bg-[#CFB87C] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigateSection(-1)}
            className="text-xs text-[#888888] hover:text-white"
          >
            ← Previous
          </Button>
          <Button
            type="button"
            onClick={() => navigateSection(1)}
            className="h-8 bg-[#CFB87C] text-xs font-bold text-black hover:bg-[#CFB87C]/90"
          >
            Next section →
          </Button>
        </div>
      </footer>

      <VoiceButton
        state={voice.state}
        sessionActive={voice.sessionActive}
        onClick={voice.onMicClick}
      />

      <VoicePanel
        open={voice.sessionActive}
        state={voice.state}
        sectionLabel={voice.sectionLabel}
        field={voice.currentField}
        question={voice.question}
        subtitle={voice.subtitle}
        transcript={voice.transcript}
        selectedOptions={voice.selectedOptions}
        lastFilledValue={voice.lastExtractedValue}
        error={voice.error}
        infoMessage={voice.infoMessage}
        energyLevel={voice.energyLevel}
        handsFree={voice.handsFree}
        onHandsFreeChange={voice.setHandsFree}
        canGoBack={voice.canGoBack}
        onGoBack={voice.goBack}
        onSkip={voice.skipField}
        onEndSession={voice.endSession}
        onOptionTap={voice.handleOptionTap}
        onConfirmMultiselect={voice.confirmMultiselect}
        onHoldStart={() => void voice.handleHoldStart()}
        onHoldEnd={voice.handleHoldEnd}
      />
    </div>
  )
}
