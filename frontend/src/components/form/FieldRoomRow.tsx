import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { FieldMultiSelect } from '@/components/form/FieldMultiSelect'
import { fieldInputClass, fieldLabelClass } from '@/components/form/field-styles'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { RoomRowValue } from '@/lib/ntreis-sections'
import { cn } from '@/lib/utils'

type FieldRoomRowProps = {
  label: string
  value: RoomRowValue
  onChange: (value: RoomRowValue) => void
  features?: string[]
  showRoomName?: boolean
}

const EMPTY_ROOM: RoomRowValue = {}

export function FieldRoomRow({
  label,
  value = EMPTY_ROOM,
  onChange,
  features,
  showRoomName = false,
}: FieldRoomRowProps) {
  const [featuresOpen, setFeaturesOpen] = useState(false)

  const patch = (next: Partial<RoomRowValue>) => onChange({ ...value, ...next })

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#111111]/50 p-4">
      <Label className={cn(fieldLabelClass, 'mb-3 block text-[#CFB87C]')}>{label}</Label>
      <div className="grid gap-3 md:grid-cols-4">
        {showRoomName ? (
          <div className="space-y-1 md:col-span-4">
            <Label className={fieldLabelClass}>Room Name</Label>
            <Input
              value={value.room_name ?? ''}
              onChange={(e) => patch({ room_name: e.target.value })}
              className={fieldInputClass}
              placeholder="e.g. Office"
            />
          </div>
        ) : null}
        <div className="space-y-1">
          <Label className={fieldLabelClass}>Level</Label>
          <Input
            value={value.level ?? ''}
            onChange={(e) => patch({ level: e.target.value })}
            className={fieldInputClass}
          />
        </div>
        <div className="space-y-1">
          <Label className={fieldLabelClass}>Length (ft)</Label>
          <Input
            type="number"
            value={value.length ?? ''}
            onChange={(e) => patch({ length: e.target.value })}
            className={fieldInputClass}
          />
        </div>
        <div className="space-y-1">
          <Label className={fieldLabelClass}>Width (ft)</Label>
          <Input
            type="number"
            value={value.width ?? ''}
            onChange={(e) => patch({ width: e.target.value })}
            className={fieldInputClass}
          />
        </div>
        {features && features.length > 0 ? (
          <div className="flex items-end md:col-span-1">
            <button
              type="button"
              onClick={() => setFeaturesOpen((o) => !o)}
              className="flex h-10 w-full items-center justify-between rounded-lg border border-[#333333] bg-[#111111] px-3 text-xs text-[#888888]"
            >
              Features ({value.features?.length ?? 0})
              <ChevronDown
                className={cn('size-4 transition-transform', featuresOpen && 'rotate-180')}
              />
            </button>
          </div>
        ) : null}
      </div>
      {features && features.length > 0 && featuresOpen ? (
        <div className="mt-3">
          <FieldMultiSelect
            label="Features"
            value={value.features ?? []}
            onChange={(next) => patch({ features: next })}
            options={features}
          />
        </div>
      ) : null}
    </div>
  )
}
