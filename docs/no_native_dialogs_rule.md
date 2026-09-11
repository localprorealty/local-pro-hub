# Standing Rule: Ban on Native Browser Dialogs

## Rule Statement
**Never use `alert()`, `confirm()`, `window.alert()`, `window.confirm()`, or `window.prompt()` anywhere in this codebase.** 

This applies to all new code, refactors, and components without exception.

---

## Approved Replacement Patterns

When presenting alerts, asking for confirmation, or communicating errors/status to the user, strictly use the following three designated UI patterns:

### 1. Confirmations & Modal Prompts: `<ConfirmDialog />`
For destructive actions, irreversible operations, or state confirmations:
- **Location**: `@/components/ui/confirm-dialog`
- **Variants**:
  - `variant="destructive"` (Red action button): For all delete actions (e.g. deleting listings, photos, comments, user accounts, document templates, or preferred vendors) and disconnect actions (e.g. disconnecting Gmail).
  - `variant="gold"` (LocalPRO Gold button): For non-destructive actions requiring user confirmation (e.g. regenerating public client share links or tokens, overriding settings).
- **Single-Button Informational Mode**:
  - `singleButton={true}`, `variant="gold"`, `confirmLabel="OK"`: For system notices, missing document notices, or action failure notices that require explicit acknowledgement where a toast is unavailable or inappropriate.

#### Example Usage:
```tsx
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export function MyComponent() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await apiDelete()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <button onClick={() => setShowConfirm(true)}>Delete</button>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Delete Item?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
```

---

### 2. Form & Input Validation: Inline Field-Level Error Text
**Never trigger an `alert()` or modal dialog for empty inputs, missing dropdown selections, or format validation errors.**

- Render red, small helper text directly underneath or beside the offending input or dropdown (`text-xs text-red-400` or `text-[11px] text-red-400`).
- Clear the error message automatically when the user updates the input value.
- Preserve keyboard focus and form context without interrupting the user workflow with a modal or native pop-up.

#### Example Usage:
```tsx
<div>
  <Input
    value={periodLabel}
    onChange={(e) => {
      setPeriodLabel(e.target.value)
      if (periodError) setPeriodError(null)
    }}
  />
  {periodError && (
    <p className="text-[11px] text-red-400">{periodError}</p>
  )}
</div>
```

---

### 3. Asynchronous Status & Toasts
For general background notifications, copy-to-clipboard alerts, or transient confirmations:
- Check for existing toast or inline banner patterns before building any new modal.
- If an explicit modal acknowledgment is needed and no toast is available, use `<ConfirmDialog singleButton variant="gold" confirmLabel="OK" />`.
- Never introduce arbitrary third-party notification or popup libraries without architectural approval.

---

## Rationale
1. **Universal Mobile & PWA Experience**: Native browser dialogs (`window.alert` / `window.confirm`) block the JavaScript main thread, break full-screen PWA shells, look inconsistent across Android/iOS/Desktop browsers, and violate LocalPRO's premium dark-theme design system.
2. **Accessibility & Predictability**: Custom Radix-based accessible dialogs retain focus trapping, support Esc key dismissal, preserve ARIA attributes, and render within the application's visual hierarchy.
