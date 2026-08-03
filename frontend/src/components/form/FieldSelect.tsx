import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fieldBorderClass, fieldInputClass, fieldLabelClass } from '@/components/form/field-styles'
import { cn } from '@/lib/utils'

type FieldSelectProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  required?: boolean
  placeholder?: string
  isPreFilled?: boolean
}

export function FieldSelect({
  label,
  value,
  onChange,
  options,
  required = false,
  placeholder = 'Select one...',
  isPreFilled = false,
}: FieldSelectProps) {
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
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger
          className={cn(fieldInputClass, fieldBorderClass(required, value, isPreFilled))}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
