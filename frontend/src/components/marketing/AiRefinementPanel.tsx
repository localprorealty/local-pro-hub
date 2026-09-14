import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MarketingAssetTab, MarketingPageType } from '@/lib/marketing-types'

export type RefinementPageOption = {
  key: string
  label: string
  pageType: MarketingPageType
  threshold?: number
  templateType?: 'flyer' | 'book'
  getContent: () => string
  applyContent: (content: string) => void
}

export type TemplateThresholdConfig = {
  threshold: number
  templateType: 'flyer' | 'book'
}

export const TEMPLATE_THRESHOLDS: Record<string, TemplateThresholdConfig> = {
  flyer_description: {
    threshold: 550,
    templateType: 'flyer',
  },
  book_property_details: {
    threshold: 750,
    templateType: 'book',
  },
  book_neighborhood_intro: {
    threshold: 140,
    templateType: 'book',
  },
  book_what_to_expect: {
    threshold: 110,
    templateType: 'book',
  },
  book_the_lifestyle: {
    threshold: 110,
    templateType: 'book',
  },
  book_unexpected_appeal: {
    threshold: 110,
    templateType: 'book',
  },
  book_the_market: {
    threshold: 110,
    templateType: 'book',
  },
  book_youll_fall_in_love: {
    threshold: 110,
    templateType: 'book',
  },
  book_boundaries: {
    threshold: 80,
    templateType: 'book',
  },
  book_nearby_neighborhoods: {
    threshold: 80,
    templateType: 'book',
  },
  book_agent_bio: {
    threshold: 500,
    templateType: 'book',
  },
}

export function getTemplateThresholdConfig(
  page: RefinementPageOption,
): TemplateThresholdConfig | null {
  if (page.threshold !== undefined) {
    return {
      threshold: page.threshold,
      templateType: page.templateType ?? (page.pageType === 'flyer' ? 'flyer' : 'book'),
    }
  }

  if (TEMPLATE_THRESHOLDS[page.key]) {
    return TEMPLATE_THRESHOLDS[page.key]
  }

  if (page.pageType === 'flyer') {
    return { threshold: 550, templateType: 'flyer' }
  }
  if (page.pageType === 'property_details') {
    return { threshold: 750, templateType: 'book' }
  }
  if (page.pageType === 'agent_bio') {
    return { threshold: 500, templateType: 'book' }
  }

  return null
}

export function getThresholdWarningMessage(templateType: 'flyer' | 'book'): string {
  if (templateType === 'flyer') {
    return "This may extend beyond the flyer's visible space — the excess will be clipped when rendered. You can still save this text."
  }
  return "This may extend beyond the book page's visible space — the excess will be clipped when rendered. You can still save this text."
}

type AiRefinementPanelProps = {
  activeTab: MarketingAssetTab
  pages: RefinementPageOption[]
  activePageKey: string
  onActivePageChange: (key: string) => void
  onRefine: (page: RefinementPageOption, instruction: string) => Promise<void>
  onRefineSuccess?: () => void
  refineError?: string | null
  history: Record<string, string[]>
  onUndo: (pageKey: string) => void
  isRefining: boolean
}

export function AiRefinementPanel({
  pages,
  activePageKey,
  onActivePageChange,
  onRefine,
  onRefineSuccess,
  refineError,
  history,
  onUndo,
  isRefining,
}: AiRefinementPanelProps) {
  const [instruction, setInstruction] = useState('')
  const activePage = pages.find((page) => page.key === activePageKey) ?? pages[0]

  if (!activePage) {
    return (
      <aside className="w-full xl:w-[280px] shrink-0 rounded-md border border-[var(--color-border)] bg-[#1a1a1a] p-4 text-sm text-[var(--color-text-secondary)]">
        No text pages available for refinement on this asset.
      </aside>
    )
  }

  const pageHistory = history[activePage.key] ?? []
  const currentContent = activePage.getContent() ?? ''
  const charCount = currentContent.length
  const thresholdConfig = getTemplateThresholdConfig(activePage)
  const isOver = Boolean(thresholdConfig && charCount > thresholdConfig.threshold)

  return (
    <aside className="w-full xl:w-[320px] shrink-0 rounded-md border border-[var(--color-border)] bg-[#1a1a1a] p-4">
      <h3 className="text-sm font-semibold text-white">Text editor & AI refine</h3>

      <div className="mt-4">
        <Label className="text-xs text-[var(--color-text-secondary)]">
          Select section to edit
        </Label>
        <Select value={activePage.key} onValueChange={onActivePageChange}>
          <SelectTrigger className="mt-1 w-full border-[var(--color-border)] bg-[#0a0a0a] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pages.map((page) => (
              <SelectItem key={page.key} value={page.key}>
                {page.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="active-page-content" className="text-xs font-medium text-[var(--color-text-secondary)]">
            Content (freely editable)
          </Label>
          <span className="text-[10px] text-[#888888]">Live preview</span>
        </div>
        <textarea
          id="active-page-content"
          value={currentContent}
          onChange={(event) => activePage.applyContent(event.target.value)}
          rows={6}
          className={`mt-1 w-full resize-y rounded-sm border bg-[#0a0a0a] px-3 py-2 text-xs leading-relaxed text-white focus:outline focus:outline-2 focus:outline-[#CFB87C] ${
            isOver ? 'border-amber-500/50' : 'border-[var(--color-border)]'
          }`}
          placeholder="Enter or edit text..."
        />
        <div className="mt-1.5 flex items-center justify-end text-xs">
          <span
            data-testid="char-counter"
            className={`text-xs tabular-nums ${
              isOver ? 'font-semibold text-amber-400' : 'text-[#888888]'
            }`}
          >
            {thresholdConfig
              ? `${charCount} / ${thresholdConfig.threshold} characters`
              : `${charCount} characters`}
          </span>
        </div>

        {isOver && thresholdConfig && (
          <div
            role="status"
            className="mt-2 flex items-start gap-2 rounded-sm border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200"
          >
            <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" aria-hidden />
            <p className="leading-relaxed">
              {getThresholdWarningMessage(thresholdConfig.templateType)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-[var(--color-border)] pt-4">
        <Label htmlFor="refine-instruction" className="text-xs text-[var(--color-text-secondary)]">
          AI rewrite / instructions
        </Label>
        <textarea
          id="refine-instruction"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={
            activePage.key === 'flyer_footer'
              ? 'Change the email address to test@localprorealty.com'
              : 'Make the description more luxurious and focus on the pool'
          }
          className="mt-1 min-h-20 w-full rounded-sm border border-[var(--color-border)] bg-[#0a0a0a] px-3 py-2 text-xs text-white focus:outline focus:outline-2 focus:outline-[#CFB87C]"
        />
      </div>

      <Button
        type="button"
        disabled={!instruction.trim() || isRefining}
        onClick={() => {
          void onRefine(activePage, instruction.trim()).then(() => {
            setInstruction('')
            onRefineSuccess?.()
          })
        }}
        className="mt-4 h-10 w-full rounded-sm bg-[#CFB87C] text-sm font-semibold text-[#0a0a0a] hover:bg-[#dcc487] disabled:opacity-50"
      >
        {isRefining ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Regenerating...
          </>
        ) : (
          'Regenerate this page →'
        )}
      </Button>

      {refineError ? (
        <p className="mt-3 text-xs text-red-300" role="alert">
          {refineError}
        </p>
      ) : null}

      {pageHistory.length > 0 ? (
        <div className="mt-6 border-t border-[var(--color-border)] pt-4">
          <p className="text-[10px] font-semibold tracking-widest text-[var(--color-text-secondary)] uppercase">
            History
          </p>
          <ul className="mt-3 space-y-2">
            {pageHistory.slice(0, 3).map((entry, index) => (
              <li key={`${entry}-${index}`} className="text-xs text-[var(--color-text-secondary)]">
                <span className="line-clamp-2">“{entry}”</span>
                {index === 0 ? (
                  <button
                    type="button"
                    onClick={() => onUndo(activePage.key)}
                    className="mt-1 text-[#CFB87C] hover:underline"
                  >
                    Undo
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  )
}
