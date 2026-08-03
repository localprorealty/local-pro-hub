import { FieldDate } from '@/components/form/FieldDate'
import { FieldMultiSelect } from '@/components/form/FieldMultiSelect'
import { FieldRadio, FieldYesNo } from '@/components/form/FieldRadio'
import { FieldRoomRow } from '@/components/form/FieldRoomRow'
import { FieldSelect } from '@/components/form/FieldSelect'
import { FieldText } from '@/components/form/FieldText'
import type { NtreisField, RoomRowValue } from '@/lib/ntreis-sections'
import { isFieldVisible } from '@/lib/ntreis-sections'

type NtreisFieldRendererProps = {
  field: NtreisField
  formData: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  addressSummary?: string
  onEditAddress?: () => void
  preFilledKeys?: Set<string>
  readOnlyKeys?: Set<string>
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return ''
  return String(value)
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function asRoomRow(value: unknown): RoomRowValue {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as RoomRowValue
  }
  return {}
}

export function NtreisFieldRenderer({
  field,
  formData,
  onChange,
  addressSummary,
  onEditAddress,
  preFilledKeys,
  readOnlyKeys,
}: NtreisFieldRendererProps) {
  if (!isFieldVisible(field, formData)) return null

  const isPreFilled = preFilledKeys?.has(field.key) ?? false
  const readOnly = readOnlyKeys?.has(field.key) ?? false
  const value = formData[field.key]

  if (field.key === '_address_summary') {
    return (
      <div className="space-y-2 md:col-span-2">
        <p className="font-[family-name:var(--font-display)] text-[11px] tracking-wider text-[#888888] uppercase">
          Property Address
        </p>
        <div className="rounded-lg border border-[#2a2a2a] bg-[#111111] px-4 py-3">
          <p className="text-sm text-white">{addressSummary || 'No address entered'}</p>
          {onEditAddress ? (
            <button
              type="button"
              onClick={onEditAddress}
              className="mt-2 text-xs text-[#CFB87C] hover:underline"
            >
              Edit address
            </button>
          ) : null}
          {field.helpText ? (
            <p className="mt-1 text-[11px] text-[#666666]">{field.helpText}</p>
          ) : null}
        </div>
      </div>
    )
  }

  switch (field.type) {
    case 'text':
      return (
        <FieldText
          label={field.label}
          value={asString(value)}
          onChange={(v) => onChange(field.key, v)}
          required={field.required}
          placeholder={field.placeholder}
          helpText={field.helpText}
          isPreFilled={isPreFilled}
          readOnly={readOnly}
        />
      )
    case 'number':
      return (
        <FieldText
          label={field.label}
          value={asString(value)}
          onChange={(v) => onChange(field.key, v)}
          required={field.required}
          type="number"
          placeholder={field.placeholder}
          helpText={field.helpText}
          isPreFilled={isPreFilled}
          readOnly={readOnly}
        />
      )
    case 'currency':
      return (
        <FieldText
          label={field.label}
          value={asString(value)}
          onChange={(v) => onChange(field.key, v)}
          required={field.required}
          type="currency"
          helpText={field.helpText}
          isPreFilled={isPreFilled}
          readOnly={readOnly}
        />
      )
    case 'textarea':
      return (
        <FieldText
          label={field.label}
          value={asString(value)}
          onChange={(v) => onChange(field.key, v)}
          required={field.required}
          type="textarea"
          maxLength={field.maxLength}
          helpText={field.helpText}
          isPreFilled={isPreFilled}
          readOnly={readOnly}
        />
      )
    case 'select':
      return (
        <FieldSelect
          label={field.label}
          value={asString(value)}
          onChange={(v) => onChange(field.key, v)}
          options={field.options ?? []}
          required={field.required}
          isPreFilled={isPreFilled}
        />
      )
    case 'radio':
      return (
        <FieldRadio
          label={field.label}
          value={asString(value)}
          onChange={(v) => onChange(field.key, v)}
          options={field.options ?? []}
          required={field.required}
          isPreFilled={isPreFilled}
        />
      )
    case 'yes_no':
      return (
        <FieldYesNo
          label={field.label}
          value={asString(value)}
          onChange={(v) => onChange(field.key, v)}
          required={field.required}
          isPreFilled={isPreFilled}
        />
      )
    case 'multiselect':
      return (
        <FieldMultiSelect
          label={field.label}
          value={asStringArray(value)}
          onChange={(v) => onChange(field.key, v)}
          options={field.options ?? []}
          required={field.required}
          isPreFilled={isPreFilled}
        />
      )
    case 'date':
      return (
        <FieldDate
          label={field.label}
          value={asString(value)}
          onChange={(v) => onChange(field.key, v)}
          required={field.required}
          isPreFilled={isPreFilled}
        />
      )
    case 'room_row':
      return (
        <div className="md:col-span-2">
          <FieldRoomRow
            label={field.label}
            value={asRoomRow(value)}
            onChange={(v) => onChange(field.key, v)}
            features={field.roomFeatures}
            showRoomName={field.key.startsWith('additional_room_')}
          />
        </div>
      )
    default:
      return null
  }
}
