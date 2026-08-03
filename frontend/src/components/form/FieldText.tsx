import { useEffect, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fieldBorderClass, fieldInputClass, fieldLabelClass } from '@/components/form/field-styles'
import { cn } from '@/lib/utils'

type FieldTextProps = {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: 'text' | 'number' | 'currency' | 'textarea'
  placeholder?: string
  maxLength?: number
  helpText?: string
  isPreFilled?: boolean
  readOnly?: boolean
  rows?: number
}

function formatCurrencyDisplay(raw: string): string {
  const digits = raw.replace(/[^\d.]/g, '')
  if (!digits) return ''
  const parts = digits.split('.')
  const whole = parts[0] ?? ''
  const decimal = parts[1]
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decimal !== undefined ? `${withCommas}.${decimal.slice(0, 2)}` : withCommas
}

export function FieldText({
  label,
  value,
  onChange,
  required = false,
  type = 'text',
  placeholder,
  maxLength,
  helpText,
  isPreFilled = false,
  readOnly = false,
  rows = 4,
}: FieldTextProps) {
  const [displayValue, setDisplayValue] = useState(
    type === 'currency' ? formatCurrencyDisplay(value) : value,
  )

  useEffect(() => {
    if (type === 'currency') {
      setDisplayValue(formatCurrencyDisplay(value))
    }
  }, [value, type])

  const handleBlur = () => {
    if (type === 'currency') {
      const normalized = value.replace(/[^\d.]/g, '')
      setDisplayValue(formatCurrencyDisplay(normalized))
      onChange(normalized)
    }
  }

  const handleChange = (next: string) => {
    if (type === 'currency') {
      const normalized = next.replace(/[^\d.]/g, '')
      setDisplayValue(formatCurrencyDisplay(normalized))
      onChange(normalized)
      return
    }
    setDisplayValue(next)
    onChange(next)
  }

  const inputValue = type === 'currency' ? displayValue : value
  const charCount = type === 'textarea' ? value.length : undefined

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className={fieldLabelClass}>
          {label}
          {required ? <span className="text-red-400"> *</span> : null}
        </Label>
        {isPreFilled ? (
          <span className="rounded bg-[#CFB87C]/15 px-1.5 py-0.5 text-[9px] tracking-wide text-[#CFB87C] uppercase">
            from NTREIS
          </span>
        ) : null}
      </div>
      {type === 'textarea' ? (
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            readOnly={readOnly}
            rows={rows}
            className={cn(
              'w-full resize-y rounded-lg border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white outline-none focus-visible:border-[#CFB87C] focus-visible:ring-3 focus-visible:ring-[#CFB87C]/50',
              fieldBorderClass(required, value, isPreFilled),
            )}
          />
          {maxLength ? (
            <span className="absolute right-2 bottom-2 text-[10px] text-[#555555]">
              {charCount}/{maxLength}
            </span>
          ) : null}
        </div>
      ) : (
        <div className={cn('relative', type === 'currency' && 'flex items-center')}>
          {type === 'currency' ? (
            <span className="pointer-events-none absolute left-3 text-sm text-[#888888]">$</span>
          ) : null}
          <Input
            type={type === 'number' ? 'number' : 'text'}
            value={inputValue}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            maxLength={maxLength}
            readOnly={readOnly}
            className={cn(
              fieldInputClass,
              fieldBorderClass(required, value, isPreFilled),
              type === 'currency' && 'pl-7',
              readOnly && 'cursor-not-allowed opacity-70',
            )}
          />
        </div>
      )}
      {helpText ? <p className="text-[11px] text-[#666666]">{helpText}</p> : null}
    </div>
  )
}
