import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { cn } from '@/lib/utils'

type ListingIdBadgeProps = {
  id: string
  className?: string
  showLabel?: boolean
}

export function ListingIdBadge({ id, className, showLabel = true }: ListingIdBadgeProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    void navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Click to copy Listing ID"
      aria-label={`Copy listing ID ${id}`}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded border border-[#2a2a2a] bg-[#141414] px-2 py-0.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[#CFB87C]/50 hover:text-white',
        className,
      )}
    >
      {showLabel ? (
        <span className="text-[10px] font-semibold tracking-wider text-[#888888] uppercase group-hover:text-[#CFB87C]">
          ID:
        </span>
      ) : null}
      <span className="max-w-[130px] truncate font-mono text-[11px] text-white sm:max-w-none sm:text-xs">
        {id}
      </span>
      {copied ? (
        <Check className="size-3 shrink-0 text-[#CFB87C]" />
      ) : (
        <Copy className="size-3 shrink-0 text-[#666666] group-hover:text-white" />
      )}
    </button>
  )
}
