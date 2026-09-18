import { motion } from 'framer-motion'

import { Label } from '@/components/ui/label'
import { fieldLabelClass } from '@/components/form/field-styles'
import { cn } from '@/lib/utils'

type FieldRadioProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  required?: boolean
  isPreFilled?: boolean
}

export function FieldRadio({
  label,
  value,
  onChange,
  options,
  required = false,
  isPreFilled = false,
}: FieldRadioProps) {
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
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option
          return (
            <motion.button
              key={option}
              type="button"
              animate={{ scale: selected ? 1.05 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onClick={() => onChange(option)}
              className={cn(
                'rounded-full border px-4 py-2 text-xs transition-colors',
                selected
                  ? 'border-[var(--color-gold)] bg-[var(--color-gold)] font-semibold text-black'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]',
              )}
            >
              {option}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

/** Yes/No radio using FieldRadio with fixed options */
export function FieldYesNo(props: Omit<FieldRadioProps, 'options'>) {
  return <FieldRadio {...props} options={['Yes', 'No']} />
}
