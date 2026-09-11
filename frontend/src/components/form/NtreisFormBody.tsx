import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Mic, MicOff } from 'lucide-react'
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
    type SellerItem,
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
        if (!Array.isArray(base.sellers) || (base.sellers as unknown[]).length === 0) {
            base.sellers = [
                {
                    name: typeof base.seller_name === 'string' ? base.seller_name : '',
                    email: typeof base.seller_email === 'string' ? base.seller_email : '',
                    phone: typeof base.seller_phone === 'string' ? base.seller_phone : '',
                },
            ]
        }
        return base
    })
    const [activeSectionId, setActiveSectionId] = useState(1)
    const [sectionSheetOpen, setSectionSheetOpen] = useState(false)
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

    const activeSection = useMemo(
        () => visibleSections.find((s) => s.id === activeSectionId) ?? visibleSections[0],
        [visibleSections, activeSectionId],
    )
    const activeIndex = useMemo(
        () => Math.max(1, visibleSections.findIndex((s) => s.id === activeSectionId) + 1),
        [visibleSections, activeSectionId],
    )

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

    const isAutoPopulated = useMemo(() => {
        const stored = (formData._rets_prefilled_keys ?? initialFormData._rets_prefilled_keys) as unknown
        if (Array.isArray(stored) && stored.length > 0) return true
        if (initialPreFilledKeys.length > 0) return true
        return false
    }, [formData._rets_prefilled_keys, initialFormData._rets_prefilled_keys, initialPreFilledKeys])

    const addressSummary = formatPropertyAddress(address)

    const persist = useCallback(
        async (patch: Record<string, unknown>) => {
            setSaveStatus('saving')
            const patchToSave = { ...patch }
            if (Array.isArray(patchToSave.sellers) && patchToSave.sellers.length > 0) {
                const s0 = patchToSave.sellers[0] as SellerItem
                if (s0) {
                    patchToSave.seller_name = s0.name || ''
                    patchToSave.seller_email = s0.email || ''
                    patchToSave.seller_phone = s0.phone || ''
                }
            }
            const ok = await updateListingFormData(listingId, patchToSave)
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
        if (!retsFormPatch || Object.keys(retsFormPatch).length === 0) return
        const incomingSellerName =
            typeof retsFormPatch.seller_name === 'string'
                ? retsFormPatch.seller_name.trim()
                : ''
        const incomingSellers = Array.isArray(retsFormPatch.sellers)
            ? (retsFormPatch.sellers as SellerItem[])
            : null

        const targetName =
            incomingSellers && incomingSellers[0]?.name
                ? incomingSellers[0].name.trim()
                : incomingSellerName

        if (targetName) {
            setFormData((prev) => {
                const existingSellers =
                    Array.isArray(prev.sellers) && prev.sellers.length > 0
                        ? [...(prev.sellers as SellerItem[])]
                        : [{ name: '', email: '', phone: '' }]

                if (existingSellers[0]?.name === targetName) {
                    return prev
                }

                existingSellers[0] = {
                    ...existingSellers[0],
                    name: targetName,
                }
                const next = { ...prev, sellers: existingSellers }
                scheduleSave(next)
                return next
            })
        }
    }, [retsFormPatch, scheduleSave])

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    const scrollToSection = (sectionId: number) => {
        setActiveSectionId(sectionId)
        setSectionSheetOpen(false)
        const el = sectionRefs.current[sectionId]
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    useEffect(() => {
        if (typeof window === 'undefined') return

        const handleScroll = () => {
            let currentId = visibleSections[0]?.id ?? 1
            let minDistance = Infinity

            for (const section of visibleSections) {
                const el = sectionRefs.current[section.id]
                if (!el) continue
                const rect = el.getBoundingClientRect()
                const distance = Math.abs(rect.top - 110)
                if (rect.top <= 160 && rect.bottom >= 110) {
                    currentId = section.id
                    break
                } else if (distance < minDistance) {
                    minDistance = distance
                    currentId = section.id
                }
            }

            setActiveSectionId(currentId)
        }

        let ticking = false
        const onScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    handleScroll()
                    ticking = false
                })
                ticking = true
            }
        }

        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [visibleSections])

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
            {/* Mobile Sticky Section Indicator & Docked Voice Bar */}
            <div className="sticky top-[80px] z-20 flex items-center gap-2 border-b border-[#2a2a2a] bg-[#0a0a0a]/95 px-3 py-2 backdrop-blur-md lg:hidden">
                <Sheet open={sectionSheetOpen} onOpenChange={setSectionSheetOpen}>
                    <SheetTrigger asChild>
                        <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-md border border-[#2a2a2a] bg-[#141414] px-2.5 py-1.5 text-left transition-colors hover:border-[#CFB87C]/50 hover:bg-[#1a1a1a] active:bg-[#222]"
                            aria-label={`Current section: ${activeSection?.name || 'Section'}. Tap to jump to another section.`}
                        >
                            <div className="flex min-w-0 items-center gap-1.5">
                                <span className="shrink-0 text-xs font-semibold text-[#CFB87C]">
                                    Section {activeIndex} of {visibleSections.length}:
                                </span>
                                <span className="truncate text-xs font-medium text-white">
                                    {activeSection?.name}
                                </span>
                            </div>
                            <ChevronDown className="size-3.5 shrink-0 text-[#888888]" />
                        </button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[300px] border-r border-[#2a2a2a] bg-[#111111] p-0">
                        <SheetHeader className="border-b border-[#2a2a2a] px-4 py-3">
                            <SheetTitle className="text-base text-[#CFB87C]">NTREIS Form Sections</SheetTitle>
                            <SheetDescription className="text-xs text-[#888888]">
                                Tap any section to jump directly to it.
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex-1 overflow-y-auto p-4">{navPanel}</div>
                    </SheetContent>
                </Sheet>

                {/* Docked Mobile Voice Button (Never occludes form inputs) */}
                <button
                    type="button"
                    onClick={voice.onMicClick}
                    aria-label={voice.sessionActive ? 'Voice Fill active' : 'Voice Fill — all sections'}
                    title={voice.sessionActive ? 'Voice Fill active' : 'Voice Fill — all unfilled fields'}
                    className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-md border transition-all',
                        voice.sessionActive
                            ? 'border-[#CFB87C] bg-[#CFB87C] text-black shadow-[0_0_12px_rgba(207,184,124,0.4)]'
                            : 'border-[#2a2a2a] bg-[#141414] text-[#CFB87C] hover:border-[#CFB87C]/50 hover:bg-[#1a1a1a]',
                    )}
                >
                    {voice.state === 'processing' ? (
                        <Loader2 className="size-4 animate-spin text-current" />
                    ) : voice.sessionActive && voice.state !== 'listening' ? (
                        <MicOff className="size-4 text-current" />
                    ) : (
                        <Mic className="size-4 text-current" />
                    )}
                </button>
            </div>

            <div className="flex flex-1">
                <aside className="sticky top-[57px] hidden h-[calc(100svh-57px-52px)] w-[260px] shrink-0 overflow-y-auto border-r border-[#2a2a2a] bg-[#111111] p-4 lg:block">
                    {navPanel}
                </aside>

                <div className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
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
                                isAutoPopulated={isAutoPopulated}
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

            <footer className="fixed right-0 bottom-0 left-0 z-30 flex h-[52px] items-center justify-between border-t border-[#2a2a2a] bg-[#0a0a0a] px-3 sm:px-4 md:px-8">
                <div className="flex shrink-0 items-center gap-1.5 text-xs text-[#888888]">
                    <SaveIcon
                        className={cn(
                            'size-3.5 shrink-0',
                            saveStatus === 'error' && 'text-red-400',
                            saveStatus === 'saving' && 'animate-spin text-[#888888]',
                            saveStatus === 'saved' && 'text-[#CFB87C]',
                        )}
                    />
                    <span
                        className={cn(
                            'text-[11px] sm:text-xs',
                            saveStatus === 'error' && 'text-red-400',
                            saveStatus === 'saved' && 'text-[#CFB87C]',
                        )}
                    >
                        <span className="hidden sm:inline">{saveLabel}</span>
                        <span className="sm:hidden">
                            {saveStatus === 'saving'
                                ? 'Saving...'
                                : saveStatus === 'error'
                                    ? 'Error'
                                    : 'Saved'}
                        </span>
                    </span>
                </div>

                <div className="hidden min-[390px]:flex items-center gap-2">
                    <span className="hidden text-xs text-[#888888] md:inline">
                        {completeSectionCount} of {visibleSections.length} sections complete
                    </span>
                    <div className="h-1 w-8 sm:w-12 overflow-hidden rounded-full bg-[#2a2a2a]">
                        <div
                            className="h-full bg-[#CFB87C] transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateSection(-1)}
                        className="h-8 px-2 text-xs text-[#888888] hover:text-white sm:px-3"
                    >
                        <span className="hidden sm:inline">← Previous</span>
                        <span className="sm:hidden">← Prev</span>
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => navigateSection(1)}
                        className="h-8 bg-[#CFB87C] px-2.5 text-xs font-bold text-black hover:bg-[#CFB87C]/90 sm:px-3"
                    >
                        <span className="hidden sm:inline">Next section →</span>
                        <span className="sm:hidden">Next →</span>
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
