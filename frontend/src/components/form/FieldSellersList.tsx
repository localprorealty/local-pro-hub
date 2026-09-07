import { Plus, Trash2 } from 'lucide-react'

import { fieldBorderClass, fieldInputClass, fieldLabelClass } from '@/components/form/field-styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SellerItem } from '@/lib/ntreis-sections'
import { cn } from '@/lib/utils'

type FieldSellersListProps = {
  value?: SellerItem[]
  onChange: (value: SellerItem[]) => void
  isPreFilled?: boolean
  readOnly?: boolean
}

const DEFAULT_SELLER: SellerItem = { name: '', email: '', phone: '' }

export function FieldSellersList({
  value,
  onChange,
  isPreFilled = false,
  readOnly = false,
}: FieldSellersListProps) {
  const sellers = Array.isArray(value) && value.length > 0 ? value : [DEFAULT_SELLER]

  const handleUpdate = (index: number, patch: Partial<SellerItem>) => {
    const next = sellers.map((item, idx) => {
      if (idx === index) {
        return { ...item, ...patch }
      }
      return item
    })
    onChange(next)
  }

  const handleAddSeller = () => {
    onChange([...sellers, { ...DEFAULT_SELLER }])
  }

  const handleRemoveSeller = (index: number) => {
    if (sellers.length <= 1) return
    onChange(sellers.filter((_, idx) => idx !== index))
  }

  return (
    <div className="space-y-4 md:col-span-2">
      <div className="flex items-center justify-between">
        <div>
          <Label className={cn(fieldLabelClass, 'text-[#CFB87C]')}>
            Sellers <span className="text-red-400">*</span>
          </Label>
          <p className="text-[11px] text-[#666666]">
            At least one seller is required. Add additional sellers if the property has multiple owners.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sellers.map((seller, index) => {
          const isFirst = index === 0
          return (
            <div
              key={index}
              className="rounded-lg border border-[#2a2a2a] bg-[#111111]/70 p-4 space-y-3 transition-colors hover:border-[#3a3a3a]"
            >
              <div className="flex items-center justify-between border-b border-[#222222] pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-display)] text-xs font-semibold text-white tracking-wide">
                    Seller {index + 1}
                  </span>
                  {isFirst && isPreFilled ? (
                    <span className="rounded bg-[#CFB87C]/15 px-1.5 py-0.5 text-[9px] tracking-wide text-[#CFB87C] uppercase">
                      from NTREIS
                    </span>
                  ) : null}
                </div>

                {!isFirst && !readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSeller(index)}
                    className="h-7 px-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="mr-1 size-3.5" />
                    Remove
                  </Button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label className={fieldLabelClass}>
                    Full Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    value={seller.name ?? ''}
                    onChange={(e) => handleUpdate(index, { name: e.target.value })}
                    placeholder="e.g. John Doe"
                    readOnly={readOnly}
                    className={cn(
                      fieldInputClass,
                      fieldBorderClass(true, seller.name, isFirst && isPreFilled),
                    )}
                  />
                </div>

                <div className="space-y-1">
                  <Label className={fieldLabelClass}>
                    Email <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={seller.email ?? ''}
                    onChange={(e) => handleUpdate(index, { email: e.target.value })}
                    placeholder="e.g. john@example.com"
                    readOnly={readOnly}
                    className={cn(fieldInputClass, fieldBorderClass(true, seller.email))}
                  />
                </div>

                <div className="space-y-1">
                  <Label className={fieldLabelClass}>
                    Phone <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="tel"
                    value={seller.phone ?? ''}
                    onChange={(e) => handleUpdate(index, { phone: e.target.value })}
                    placeholder="e.g. (555) 000-0000"
                    readOnly={readOnly}
                    className={cn(fieldInputClass, fieldBorderClass(true, seller.phone))}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!readOnly ? (
        <Button
          type="button"
          variant="outline"
          onClick={handleAddSeller}
          className="border-dashed border-[#3a3a3a] bg-transparent text-[#CFB87C] hover:border-[#CFB87C] hover:bg-[#CFB87C]/10 text-xs font-medium"
        >
          <Plus className="mr-1.5 size-3.5" />
          Add another seller
        </Button>
      ) : null}
    </div>
  )
}
