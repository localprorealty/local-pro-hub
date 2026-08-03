import { Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  ASPECT_RATIOS,
  isOptionsStepValid,
  PACING_OPTIONS,
  type OptionsFormState,
  VIDEO_CTAS,
  VIDEO_TOPICS,
  VIDEO_TONES,
  OUTFIT_OPTIONS,
  type OutfitId,
} from '@/lib/marketing-video'
import { cn } from '@/lib/utils'

type OptionsStepProps = {
  form: OptionsFormState
  onChange: (patch: Partial<OptionsFormState>) => void
  isSubmitting: boolean
  onSubmit: () => void
  error: string | null
}

const pillClass = (selected: boolean) =>
  cn(
    'rounded-sm border px-3 py-2 text-left text-xs font-medium transition-colors sm:text-sm',
    selected
      ? 'border-[#CFB87C] bg-[#CFB87C]/15 text-[#CFB87C]'
      : 'border-[#2a2a2a] bg-[#1a1a1a] text-[var(--color-text-secondary)] hover:border-[#444]',
  )

const inputClass =
  'w-full rounded-sm border border-[#333] bg-[#111] px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline focus:outline-2 focus:outline-[#CFB87C]'

const PRESET_PROMPTS: Record<string, string> = {
  new_listing: "Create a video announcing a brand new listing at 13128 Northhaven Way. It is a 4-bedroom luxury modern home in Aubrey, TX, listed for $450,000. It has a beautiful pool and an updated kitchen. Open house is this Saturday from 1-3 PM. Start the video in a modern farmhouse kitchen with gold hardware, then transition to a lush green backyard with a swimming pool.",
  open_house: "Invite viewers to an upcoming open house at 5014 Ross Avenue, Dallas. Open house is this Sunday from 2-4 PM. Mention the key highlights: walkability to local coffee shops, private rooftop terrace, and a modern open-concept floor plan. Start standing in front of the modern house exterior, then transition to the rooftop deck looking at the Dallas skyline.",
  just_sold: "Celebrate selling 12229 Rendon Road in Fort Worth. It sold in just 4 days for 105% of the list price! Thank the sellers for trusting us and tell potential sellers in the DFW area that we have active buyers waiting. Start in a luxury home office, then transition to a 'Just Sold' banner overlay.",
  market_update: "Provide a quick DFW market update. Let buyers and sellers know that inventory is up by 12% this month, making it a great time for buyers to get deals while sellers can capitalize on high home valuations. Start in a professional corporate office, then show market trend graphs in the background."
}

export function OptionsStep({ form, onChange, isSubmitting, onSubmit, error }: OptionsStepProps) {
  const valid = isOptionsStepValid(form)

  const handleSelectTopic = (topicId: string) => {
    const patch: Partial<OptionsFormState> = { topic: topicId as any }
    
    // Auto-fill preset if the current input is empty
    const preset = PRESET_PROMPTS[topicId]
    if (preset && !form.scenarioPrompt.trim()) {
      patch.scenarioPrompt = preset
    }
    onChange(patch)
  }

  const applyPresetDirectly = (topicId: string) => {
    const preset = PRESET_PROMPTS[topicId]
    if (preset) {
      onChange({
        topic: topicId as any,
        scenarioPrompt: preset
      })
    }
  }

  return (
    <div className="grid gap-10 xl:grid-cols-[1fr_320px]">
      <div className="space-y-8">
        
        {/* 1. What happens in the video? (Top-Center) */}
        <section className="space-y-3">
          <Label htmlFor="scenario-prompt" className="text-lg font-semibold text-white">
            1. What happens in the video?
          </Label>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Explain what the video is about in your own words. Describe the listing details, price, key features, or overall topic. GROQ will write a spoken script and design the background scenes for you.
          </p>
          <textarea
            id="scenario-prompt"
            rows={6}
            value={form.scenarioPrompt}
            onChange={(e) => onChange({ scenarioPrompt: e.target.value })}
            placeholder='Describe your script goals (e.g., "Showcase my new listing at 123 Main St, Aubrey TX. Highlight the open-concept kitchen and the pool. Keep it high energy.")'
            className={inputClass}
          />
        </section>

        {/* 2. Select a Topic Preset (Below the input box) */}
        <section className="space-y-4 pt-6 border-t border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider text-[var(--color-text-secondary)]">
              Or Choose a Preset to Start
            </h2>
            {form.topic && PRESET_PROMPTS[form.topic] && (
              <button
                type="button"
                onClick={() => applyPresetDirectly(form.topic!)}
                className="flex items-center gap-1 text-xs font-semibold text-[#CFB87C] hover:text-[#dcc487]"
              >
                <Sparkles className="size-3" />
                Reset to Preset
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {VIDEO_TOPICS.map((topic) => {
              const Icon = topic.icon
              const selected = form.topic === topic.id
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => handleSelectTopic(topic.id)}
                  className={cn(
                    'rounded-sm border p-4 text-left transition-colors',
                    selected
                      ? 'border-[#CFB87C] bg-[#CFB87C]/10'
                      : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#444]',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 size-4 shrink-0 text-[#CFB87C]" />
                    <div>
                      <p className="font-medium text-white">{topic.label}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {topic.description}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

      </div>

      <aside className="space-y-6 rounded-sm border border-[#2a2a2a] bg-[#1a1a1a] p-5 xl:sticky xl:top-8 xl:self-start">
        <div className="space-y-2">
          <Label className="text-[var(--color-text-secondary)]">Tone</Label>
          <div className="flex flex-wrap gap-2">
            {VIDEO_TONES.map((tone) => (
              <button
                key={tone.id}
                type="button"
                onClick={() => onChange({ tone: tone.id })}
                className={pillClass(form.tone === tone.id)}
              >
                {tone.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[var(--color-text-secondary)]">Pacing</Label>
          <div className="flex flex-col gap-2">
            {PACING_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange({ pacing: item.id })}
                className={pillClass(form.pacing === item.id)}
              >
                <span className="block">{item.label}</span>
                <span className="block text-[10px] opacity-80">{item.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[var(--color-text-secondary)]">Aspect ratio</Label>
          <div className="flex flex-col gap-2">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio.id}
                type="button"
                onClick={() => onChange({ aspectRatio: ratio.id })}
                className={pillClass(form.aspectRatio === ratio.id)}
              >
                {ratio.label}
                {ratio.id === '9:16' ? ' ← recommended' : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[var(--color-text-secondary)]">End with</Label>
          <div className="flex flex-col gap-2">
            {VIDEO_CTAS.map((cta) => (
              <button
                key={cta.id}
                type="button"
                onClick={() => onChange({ cta: cta.id })}
                className={pillClass(form.cta === cta.id)}
              >
                {cta.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[var(--color-text-secondary)]">Presenter Outfit Style</Label>
          <div className="flex flex-col gap-2">
            {OUTFIT_OPTIONS.map((outfit) => (
              <button
                key={outfit.id}
                type="button"
                onClick={() => onChange({ outfit: outfit.id as OutfitId })}
                className={pillClass(form.outfit === outfit.id)}
              >
                {outfit.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          type="button"
          disabled={!valid || isSubmitting}
          onClick={onSubmit}
          className="h-11 w-full bg-[#CFB87C] font-semibold text-[#0a0a0a] hover:bg-[#dcc487]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating Video Plan...
            </>
          ) : (
            'Create Video Plan →'
          )}
        </Button>

        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </aside>
    </div>
  )
}
