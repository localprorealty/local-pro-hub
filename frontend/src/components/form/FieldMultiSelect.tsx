import { Label } from '@/components/ui/label'
import { fieldLabelClass } from '@/components/form/field-styles'
import { cn } from '@/lib/utils'

type FieldMultiSelectProps = {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  options: string[]
  required?: boolean
  isPreFilled?: boolean
}

export function FieldMultiSelect({
  label,
  value,
  onChange,
  options,
  required = false,
  isPreFilled = false,
}: FieldMultiSelectProps) {
  const toggle = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option))
    } else {
      onChange([...value, option])
    }
  }

  const showRequiredError = required && value.length === 0

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className={fieldLabelClass}>
          {label}
          {required ? <span className="text-red-400"> *</span> : null}
        </Label>
        {isPreFilled ? (
          <span className="rounded bg-[var(--color-gold)]/15 px-1.5 py-0.5 text-[9px] tracking-wide text-[var(--color-gold)] uppercase">
            from NTREIS
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          'flex flex-wrap gap-2 rounded-lg border p-3',
          showRequiredError && !isPreFilled
            ? 'border-red-500/70'
            : 'border-[var(--color-border)]',
        )}
      >
        {options.map((option) => {
          const selected = value.includes(option)
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs transition-colors',
                selected
                  ? 'border-[var(--color-gold)] bg-[var(--color-gold)] font-medium text-black'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]',
              )}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
