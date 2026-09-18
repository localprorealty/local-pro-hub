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
        'group inline-flex items-center gap-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-gold-border)] hover:text-[var(--color-text)]',
        className,
      )}
    >
      {showLabel ? (
        <span className="text-[10px] font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase group-hover:text-[var(--color-gold)]">
          ID:
        </span>
      ) : null}
      <span className="max-w-[130px] truncate font-mono text-[11px] text-[var(--color-text)] sm:max-w-none sm:text-xs">
        {id}
      </span>
      {copied ? (
        <Check className="size-3 shrink-0 text-[var(--color-gold)]" />
      ) : (
        <Copy className="size-3 shrink-0 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text)]" />
      )}
    </button>
  )
}
