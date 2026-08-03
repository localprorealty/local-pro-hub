import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { deleteListing } from '@/lib/listings'
import { cn } from '@/lib/utils'

type DeleteDraftButtonProps = {
  listingId: string
  agentId: string
  onDeleted?: () => void
  variant?: 'icon' | 'button'
  className?: string
}

export function DeleteDraftButton({
  listingId,
  agentId,
  onDeleted,
  variant = 'button',
  className,
}: DeleteDraftButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Delete this draft listing? This cannot be undone.',
    )
    if (!confirmed) return

    setIsDeleting(true)
    setError(null)
    const ok = await deleteListing(listingId, agentId)
    if (!ok) {
      setError('Could not delete. Run migration 002_listings_delete_draft.sql in Supabase if needed.')
      setIsDeleting(false)
      return
    }
    onDeleted?.()
  }

  if (variant === 'icon') {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={isDeleting}
          title="Delete draft"
          aria-label="Delete draft listing"
          className={cn(
            'inline-flex items-center justify-center rounded-sm border border-red-500/30 p-2 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50',
          )}
        >
          {isDeleting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </button>
        {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        onClick={() => void handleDelete()}
        disabled={isDeleting}
        className="border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200"
      >
        {isDeleting ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 size-4" />
        )}
        {isDeleting ? 'Deleting...' : 'Delete draft'}
      </Button>
      {error ? (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
