import { useState } from 'react'
import { Check, Loader2, Tag } from 'lucide-react'

import { Button } from '@/components/ui/button'

const PACKAGE_ITEMS = [
  { id: 'just_sold', label: '✓ Just Sold Post (Instagram)', price: 5 },
  { id: 'flyer', label: '✓ New Listing Flyer (Print)', price: 10 },
  { id: 'book', label: '✓ Listing Book (Full PDF)', price: 15 },
]

const PACKAGE_TOTAL = PACKAGE_ITEMS.reduce((sum, item) => sum + item.price, 0)

type PaymentStepProps = {
  onPaid: () => void
}

export function PaymentStep({ onPaid }: PaymentStepProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)

  const handleApplyPromo = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (promoInput.trim().toUpperCase() === 'ILOVELPR') {
      setPromoApplied(true)
      setPromoError(null)
    } else {
      setPromoApplied(false)
      setPromoError('Invalid promo code. Enter ILoveLPR for 100% off.')
    }
  }

  const handlePay = async () => {
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsProcessing(false)
    onPaid()
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-md border border-[var(--color-border)] bg-[#1a1a1a] p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-white">
            Marketing Package
          </h2>
          <span className="flex items-center gap-1 text-xs text-[#CFB87C]">
            <Tag className="size-3.5" />
            Launch Special
          </span>
        </div>

        {/* Line Items */}
        <ul className="mt-6 space-y-3 text-sm text-white">
          {PACKAGE_ITEMS.map((item) => (
            <li key={item.id} className="flex items-center justify-between">
              <span className="text-stone-200">{item.label}</span>
              {promoApplied ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500 line-through">${item.price}</span>
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-bold tracking-wide text-emerald-400">
                    FREE
                  </span>
                </div>
              ) : (
                <span className="font-medium text-white">${item.price}</span>
              )}
            </li>
          ))}
        </ul>

        {/* Promo Code Input */}
        <form onSubmit={handleApplyPromo} className="mt-5 border-t border-[var(--color-border)] pt-4">
          <label
            htmlFor="promo-code"
            className="mb-2 block text-[11px] font-bold tracking-wider text-[var(--color-text-secondary)] uppercase"
          >
            Promo Code
          </label>
          <div className="flex gap-2">
            <input
              id="promo-code"
              type="text"
              value={promoInput}
              onChange={(e) => {
                setPromoInput(e.target.value)
                if (promoError) setPromoError(null)
              }}
              placeholder="Enter promo code (e.g. ILoveLPR)"
              className="flex-1 rounded-sm border border-[var(--color-border)] bg-[#0d0d0d] px-3 py-2 text-sm text-white placeholder:text-stone-500 focus:border-[#CFB87C] focus:outline-none"
            />
            <Button
              type="submit"
              variant="outline"
              className="shrink-0 rounded-sm border-[#CFB87C]/60 bg-[#CFB87C]/10 text-xs font-bold tracking-wider text-[#CFB87C] hover:bg-[#CFB87C]/20"
            >
              Apply
            </Button>
          </div>

          {promoError && <p className="mt-2 text-xs text-red-400">{promoError}</p>}

          {promoApplied && (
            <div className="mt-3 flex items-center justify-between rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="size-3.5 text-emerald-400" />
                Promo <strong>ILoveLPR</strong> active ($30 value free)
              </span>
              <button
                type="button"
                onClick={() => {
                  setPromoApplied(false)
                  setPromoInput('')
                }}
                className="text-[11px] text-stone-400 underline hover:text-white"
              >
                Remove
              </button>
            </div>
          )}
        </form>

        {/* Total Summary */}
        <div className="mt-4 border-t border-[var(--color-border)] pt-4 text-white">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-stone-200">Total</span>
            {promoApplied ? (
              <div className="text-right">
                <span className="mr-2 text-sm text-stone-500 line-through">${PACKAGE_TOTAL}</span>
                <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-emerald-400">
                  $0
                </span>
              </div>
            ) : (
              <span className="font-[family-name:var(--font-display)] text-xl font-bold text-white">
                ${PACKAGE_TOTAL}
              </span>
            )}
          </div>
          {promoApplied && (
            <p className="mt-1 text-right text-xs font-medium text-emerald-400">
              $0 — LocalPRO Promo Applied
            </p>
          )}
        </div>

        {/* Action Button */}
        <Button
          type="button"
          disabled={isProcessing}
          onClick={() => void handlePay()}
          className="mt-6 h-12 w-full rounded-sm bg-[#CFB87C] text-base font-bold text-[#0a0a0a] hover:bg-[#dcc487]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" />
              Generating assets...
            </>
          ) : promoApplied ? (
            'Generate marketing assets (Free Promo) →'
          ) : (
            'Generate marketing assets →'
          )}
        </Button>
      </div>
    </div>
  )
}
