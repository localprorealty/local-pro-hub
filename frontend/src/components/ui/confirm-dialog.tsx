import * as React from 'react'
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
import { cn } from '@/lib/utils'

export type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'gold'
  singleButton?: boolean
  onConfirm?: () => void | Promise<void>
  isLoading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'gold',
  singleButton = false,
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  const defaultConfirmLabel = singleButton
    ? 'OK'
    : variant === 'destructive'
      ? 'Delete'
      : 'Confirm'

  const resolvedConfirmLabel = confirmLabel ?? defaultConfirmLabel

  const actionClassName =
    variant === 'destructive'
      ? 'rounded-sm border border-red-500/40 bg-red-950/80 text-red-200 hover:bg-red-900 hover:border-red-500/60 hover:text-white transition-colors'
      : 'rounded-sm bg-[var(--color-gold)] text-[var(--color-black)] hover:bg-[#dcc487]'

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
          {description && (
            <AlertDialogDescription className="text-sm text-[var(--color-text-secondary)]">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        <AlertDialogFooter className="sm:justify-end">
          {!singleButton && (
            <AlertDialogCancel
              disabled={isLoading}
              className="rounded-sm border border-[var(--color-border)] bg-transparent text-[var(--color-white)] hover:bg-[var(--color-surface-3)]"
            >
              {cancelLabel}
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            disabled={isLoading}
            onClick={async (e) => {
              if (onConfirm) {
                e.preventDefault()
                try {
                  await onConfirm()
                } finally {
                  onOpenChange(false)
                }
              }
            }}
            className={cn(actionClassName)}
          >
            {isLoading ? 'Processing...' : resolvedConfirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
