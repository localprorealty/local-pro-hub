import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { renderEmailTemplate } from '@/lib/milestones'

type EmailTemplatePreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subjectTemplate: string
  htmlBody: string
}

export function EmailTemplatePreviewDialog({
  open,
  onOpenChange,
  title,
  subjectTemplate,
  htmlBody,
}: EmailTemplatePreviewDialogProps) {
  const subject = renderEmailTemplate(subjectTemplate)
  const html = renderEmailTemplate(htmlBody)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0 text-[var(--color-white)] sm:max-w-3xl">
        <DialogHeader className="border-b border-[var(--color-border)] px-6 py-4">
          <DialogTitle className="font-[family-name:var(--font-display)]">
            Preview — {title}
          </DialogTitle>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Subject: <span className="text-[var(--color-white)]">{subject}</span>
          </p>
          <p className="text-[10px] text-[var(--color-text-secondary)]">
            Sample data: Adarsh Gella, Emma, 5 years, 123 Richardson St
          </p>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto bg-white">
          <iframe
            title={`Email preview ${title}`}
            srcDoc={html}
            className="min-h-[480px] w-full border-0"
            sandbox="allow-same-origin"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
