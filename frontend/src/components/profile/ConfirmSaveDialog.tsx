import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type ConfirmSaveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  changes: { label: string; from: string; to: string }[]
  onConfirm: () => void
  isLoading?: boolean
  confirmLabel?: string
}

export function ConfirmSaveDialog({
  open,
  onOpenChange,
  title = 'Confirm changes',
  description = 'You are about to update your profile. Review the changes below.',
  changes,
  onConfirm,
  isLoading = false,
  confirmLabel = 'Save changes',
}: ConfirmSaveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-md border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-white)] sm:max-w-md"
        data-size="default"
      >
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="font-[family-name:var(--font-display)] text-lg text-[var(--color-white)]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[var(--color-text-secondary)]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {changes.length > 0 ? (
          <ul className="max-h-48 space-y-2 overflow-y-auto border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
            {changes.map((change) => (
              <li key={change.label}>
                <span className="text-[var(--color-gold)]">{change.label}</span>
                <span className="text-[var(--color-text-secondary)]"> · </span>
                <span className="text-[var(--color-text-secondary)] line-through">
                  {change.from}
                </span>
                <span className="text-[var(--color-text-secondary)]"> → </span>
                <span className="text-[var(--color-white)]">{change.to}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <AlertDialogFooter className="sm:justify-end">
          <AlertDialogCancel className="rounded-sm border-[var(--color-border)] bg-transparent text-[var(--color-white)] hover:bg-[var(--color-surface-3)]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            className="rounded-sm bg-[var(--color-gold)] text-[var(--color-black)] hover:bg-[#dcc487]"
          >
            {isLoading ? 'Saving...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
