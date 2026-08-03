import { useState } from 'react'
import { Loader2, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const PACKAGE_TOTAL = 8

type PaymentStepProps = {
  onPaid: () => void
}

export function PaymentStep({ onPaid }: PaymentStepProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handlePay = async () => {
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsProcessing(false)
    onPaid()
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-md border border-[var(--color-border)] bg-[#1a1a1a] p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-white">
          Marketing Package
        </h2>

        <ul className="mt-6 space-y-3 text-sm text-white">
          <li className="flex justify-between">
            <span>✓ Just Sold Post (Instagram)</span>
            <span>$15</span>
          </li>
          <li className="flex justify-between">
            <span>✓ New Listing Flyer (Print)</span>
            <span>$20</span>
          </li>
          <li className="flex justify-between">
            <span>✓ Listing Book (Full PDF)</span>
            <span>$45</span>
          </li>
        </ul>

        <div className="mt-4 flex justify-between border-t border-[var(--color-border)] pt-4 text-white">
          <span className="font-semibold">Total</span>
          <span className="font-[family-name:var(--font-display)] text-xl">${PACKAGE_TOTAL}</span>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="card-number" className="text-xs text-[var(--color-text-secondary)]">
              Card number
            </Label>
            <Input
              id="card-number"
              placeholder="4242 4242 4242 4242"
              className="mt-1 border-[var(--color-border)] bg-[#0a0a0a] text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="card-expiry" className="text-xs text-[var(--color-text-secondary)]">
                Expiry
              </Label>
              <Input
                id="card-expiry"
                placeholder="MM / YY"
                className="mt-1 border-[var(--color-border)] bg-[#0a0a0a] text-white"
              />
            </div>
            <div>
              <Label htmlFor="card-cvv" className="text-xs text-[var(--color-text-secondary)]">
                CVV
              </Label>
              <Input
                id="card-cvv"
                placeholder="123"
                className="mt-1 border-[var(--color-border)] bg-[#0a0a0a] text-white"
              />
            </div>
          </div>
        </div>

        <Button
          type="button"
          disabled={isProcessing}
          onClick={() => void handlePay()}
          className="mt-6 h-12 w-full rounded-sm bg-[#CFB87C] text-base font-bold text-[#0a0a0a] hover:bg-[#dcc487]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" />
              Processing payment...
            </>
          ) : (
            `Pay $${PACKAGE_TOTAL} & generate assets →`
          )}
        </Button>

        <p className="mt-3 text-center text-xs text-[var(--color-text-secondary)]">
          Demo mode — no real charge
        </p>

        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <Lock className="size-3.5" />
          Powered by Stripe (demo mode)
        </p>
      </div>
    </div>
  )
}
