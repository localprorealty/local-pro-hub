import { useState } from 'react'
import { Loader2 } from 'lucide-react'

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
  getContent: () => string
  applyContent: (content: string) => void
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
      <aside className="w-[280px] shrink-0 rounded-md border border-[var(--color-border)] bg-[#1a1a1a] p-4 text-sm text-[var(--color-text-secondary)]">
        No text pages available for refinement on this asset.
      </aside>
    )
  }

  const pageHistory = history[activePage.key] ?? []

  return (
    <aside className="w-[280px] shrink-0 rounded-md border border-[var(--color-border)] bg-[#1a1a1a] p-4">
      <h3 className="text-sm font-semibold text-white">AI refinement</h3>

      <div className="mt-4">
        <Label className="text-xs text-[var(--color-text-secondary)]">
          Select page to refine
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
        <Label htmlFor="refine-instruction" className="text-xs text-[var(--color-text-secondary)]">
          What would you like to change?
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
          className="mt-1 min-h-28 w-full rounded-sm border border-[var(--color-border)] bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:outline focus:outline-2 focus:outline-[#CFB87C]"
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
