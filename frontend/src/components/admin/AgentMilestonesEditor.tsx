import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MILESTONE_TYPE_OPTIONS,
  type MilestoneFormRow,
  newMilestoneRow,
} from '@/lib/milestones'

const fieldClass =
  'h-10 rounded-sm border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)]'

type AgentMilestonesEditorProps = {
  rows: MilestoneFormRow[]
  onChange: (rows: MilestoneFormRow[]) => void
  disabled?: boolean
}

export function AgentMilestonesEditor({
  rows,
  onChange,
  disabled = false,
}: AgentMilestonesEditorProps) {
  const updateRow = (clientId: string, patch: Partial<MilestoneFormRow>) => {
    onChange(
      rows.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row)),
    )
  }

  const removeRow = (clientId: string) => {
    onChange(rows.filter((row) => row.clientId !== clientId))
  }

  const addRow = () => {
    onChange([...rows, newMilestoneRow()])
  }

  const showPersonName = (type: MilestoneFormRow['milestone_type']) =>
    type === 'child_birthday' || type === 'spouse_birthday'

  const showCustomLabel = (type: MilestoneFormRow['milestone_type']) =>
    type === 'custom' || type === 'home_purchase_anniversary'

  return (
    <div className="space-y-4 border-t border-[var(--color-border)] pt-6">
      <div>
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-white)]">
          Personal milestones
        </h3>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Admin-only dates for birthday and anniversary automations. Agents cannot see
          these.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-[var(--color-text-secondary)]">
          No milestones yet. Add dates to enable automated emails.
        </p>
      ) : null}

      <div className="space-y-4">
        {rows.map((row, index) => (
          <div
            key={row.clientId}
            className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] tracking-widest text-[var(--color-gold)] uppercase">
                Milestone {index + 1}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => removeRow(row.clientId)}
                className="h-8 rounded-sm border-red-500/40 px-2 text-red-300"
              >
                <Trash2 className="size-3.5" aria-hidden />
                <span className="sr-only">Remove milestone</span>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs uppercase text-[var(--color-text-secondary)]">
                  Type
                </Label>
                <select
                  value={row.milestone_type}
                  disabled={disabled}
                  onChange={(e) =>
                    updateRow(row.clientId, {
                      milestone_type: e.target.value as MilestoneFormRow['milestone_type'],
                    })
                  }
                  className={`mt-1 w-full px-3 text-sm ${fieldClass}`}
                >
                  {MILESTONE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs uppercase text-[var(--color-text-secondary)]">
                  Date
                </Label>
                <Input
                  type="date"
                  value={row.event_date}
                  disabled={disabled}
                  onChange={(e) => updateRow(row.clientId, { event_date: e.target.value })}
                  className={`mt-1 ${fieldClass}`}
                />
              </div>

              <div>
                <Label className="text-xs uppercase text-[var(--color-text-secondary)]">
                  Send days before
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={row.send_lead_days}
                  disabled={disabled}
                  onChange={(e) =>
                    updateRow(row.clientId, { send_lead_days: e.target.value })
                  }
                  className={`mt-1 ${fieldClass}`}
                />
              </div>

              {showPersonName(row.milestone_type) ? (
                <div className="sm:col-span-2">
                  <Label className="text-xs uppercase text-[var(--color-text-secondary)]">
                    Person name
                  </Label>
                  <Input
                    value={row.person_name}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(row.clientId, { person_name: e.target.value })
                    }
                    placeholder="e.g. Emma"
                    className={`mt-1 ${fieldClass}`}
                  />
                </div>
              ) : null}

              {showCustomLabel(row.milestone_type) ? (
                <div className="sm:col-span-2">
                  <Label className="text-xs uppercase text-[var(--color-text-secondary)]">
                    {row.milestone_type === 'home_purchase_anniversary'
                      ? 'Property / label'
                      : 'Custom label'}
                  </Label>
                  <Input
                    value={row.custom_label}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(row.clientId, { custom_label: e.target.value })
                    }
                    placeholder={
                      row.milestone_type === 'home_purchase_anniversary'
                        ? '123 Richardson St'
                        : 'e.g. Got licensed in Texas'
                    }
                    className={`mt-1 ${fieldClass}`}
                  />
                </div>
              ) : null}

              <div className="sm:col-span-2">
                <Label className="text-xs uppercase text-[var(--color-text-secondary)]">
                  Admin notes (internal)
                </Label>
                <Input
                  value={row.notes}
                  disabled={disabled}
                  onChange={(e) => updateRow(row.clientId, { notes: e.target.value })}
                  className={`mt-1 ${fieldClass}`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={addRow}
        className="h-9 rounded-sm border-[var(--color-border)] text-[var(--color-white)]"
      >
        <Plus className="mr-2 size-4" aria-hidden />
        Add milestone
      </Button>
    </div>
  )
}
