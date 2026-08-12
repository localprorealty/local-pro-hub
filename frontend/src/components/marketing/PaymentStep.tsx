import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

const PACKAGE_TOTAL = 80

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
            <span className="text-[var(--color-text-secondary)]">
              <span className="line-through mr-1.5">$15</span>
              <span className="text-emerald-400 font-medium">Free</span>
            </span>
          </li>
          <li className="flex justify-between">
            <span>✓ New Listing Flyer (Print)</span>
            <span className="text-[var(--color-text-secondary)]">
              <span className="line-through mr-1.5">$20</span>
              <span className="text-emerald-400 font-medium">Free</span>
            </span>
          </li>
          <li className="flex justify-between">
            <span>✓ Listing Book (Full PDF)</span>
            <span className="text-[var(--color-text-secondary)]">
              <span className="line-through mr-1.5">$45</span>
              <span className="text-emerald-400 font-medium">Free</span>
            </span>
          </li>
        </ul>

        <div className="mt-4 flex justify-between border-t border-[var(--color-border)] pt-4 text-white">
          <span className="font-semibold">Total</span>
          <span>
            <span className="line-through text-lg opacity-50 mr-2">${PACKAGE_TOTAL}</span>
            <span className="text-[#CFB87C] font-bold text-xl">Free</span>
          </span>
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
              Generating assets...
            </>
          ) : (
            'Generate marketing assets (Free) →'
          )}
        </Button>
      </div>
    </div>
  )
}
