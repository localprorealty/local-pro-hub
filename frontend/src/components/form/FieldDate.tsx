import { format, parse, isValid } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'

import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fieldBorderClass, fieldInputClass, fieldLabelClass } from '@/components/form/field-styles'
import { cn } from '@/lib/utils'

type FieldDateProps = {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  isPreFilled?: boolean
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined
  const iso = parse(value, 'yyyy-MM-dd', new Date())
  if (isValid(iso)) return iso
  const us = parse(value, 'MM/dd/yyyy', new Date())
  return isValid(us) ? us : undefined
}

export function FieldDate({
  label,
  value,
  onChange,
  required = false,
  isPreFilled = false,
}: FieldDateProps) {
  const [open, setOpen] = useState(false)
  const selected = parseDate(value)

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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              fieldInputClass,
              'flex w-full items-center justify-between px-3 text-left text-sm',
              fieldBorderClass(required, value, isPreFilled),
              !value && 'text-[#888888]',
            )}
          >
            {selected ? format(selected, 'MM/dd/yyyy') : 'Select date...'}
            <CalendarIcon className="size-4 text-[#888888]" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, 'yyyy-MM-dd'))
                setOpen(false)
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
