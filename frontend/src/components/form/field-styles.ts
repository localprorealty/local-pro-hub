export const fieldInputClass =
  'h-10 rounded-lg border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] focus-visible:border-[var(--color-gold)] focus-visible:ring-[var(--color-gold-border)]'

export const fieldLabelClass =
  'font-[family-name:var(--font-display)] text-[11px] tracking-wider text-[var(--color-text-secondary)] uppercase'

export function fieldBorderClass(required: boolean, value: unknown, isPreFilled = false): string {
  const empty =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  if (required && empty && !isPreFilled) {
    return 'border-red-500/70 focus-visible:border-red-500 focus-visible:ring-red-500/30'
  }
  return ''
}
