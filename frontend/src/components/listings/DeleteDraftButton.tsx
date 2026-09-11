import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
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

  return (
    <div className={className}>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
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
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowConfirm(true)}
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
      )}

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Delete draft listing?"
        description="This draft listing will be permanently removed. This cannot be undone."
        confirmLabel="Delete draft"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />

      {error ? (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
