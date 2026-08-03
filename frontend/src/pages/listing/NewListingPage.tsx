import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Home, Key, Loader2, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MissionShell } from '@/components/layout/MissionShell'
import { Button } from '@/components/ui/button'
import { createListing, type ListingType } from '@/lib/listings'
import { getSupabaseClient } from '@/lib/supabase'

type TypeCardConfig = {
  type: ListingType
  icon: typeof Home
  title: string
  subtitle: string
  docs: string
  enabled: boolean
}

const TYPE_CARDS: TypeCardConfig[] = [
  {
    type: 'listing',
    icon: Home,
    title: 'Listing',
    subtitle: 'Represent the seller, list on NTREIS',
    docs: "Listing Agreement · Seller's Disclosure · IABS",
    enabled: true,
  },
  {
    type: 'buyer',
    icon: Users,
    title: 'Buyer',
    subtitle: 'Represent the buyer through their purchase',
    docs: 'Buyer Rep Agreement · IABS',
    enabled: false,
  },
  {
    type: 'lease',
    icon: Key,
    title: 'Lease',
    subtitle: 'List a rental or represent a tenant',
    docs: 'Residential Lease · Pet Addendum · IABS',
    enabled: false,
  },
]

function NewListingContent() {
  const navigate = useNavigate()
  const [selectedType, setSelectedType] = useState<ListingType | null>('listing')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async () => {
    if (!selectedType || isCreating) return
    setIsCreating(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession()
      const agentId = session?.user?.id
      if (!agentId) {
        setError('You must be signed in to create a listing.')
        return
      }

      const result = await createListing(agentId, selectedType)
      if (!result) {
        setError('Failed to create listing. Try again.')
        return
      }

      navigate(`/listing/${result.id}/form`)
    } catch {
      setError('Failed to create listing. Try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const headerSlot = (
    <header className="relative flex items-center justify-center border-b border-[#2a2a2a] px-8 py-6">
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="absolute left-8 flex items-center text-[#CFB87C] transition-opacity hover:opacity-80"
        aria-label="Back to dashboard"
      >
        <ArrowLeft className="size-5" />
      </button>
      <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-white">
        New Listing
      </h1>
    </header>
  )

  return (
    <MissionShell role="agent" headerSlot={headerSlot}>
      <div className="mx-auto flex max-w-5xl flex-col items-center">
        <motion.div
          className="grid w-full gap-6 md:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } },
          }}
        >
          {TYPE_CARDS.map((card) => {
            const Icon = card.icon
            const isSelected = card.enabled && selectedType === card.type
            return (
              <motion.div
                key={card.type}
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                animate={{ scale: isSelected ? 1.02 : 1 }}
                className={`relative rounded-lg border bg-[#1a1a1a] p-7 text-left transition-[border-color,box-shadow] ${
                  card.enabled
                    ? isSelected
                      ? 'border-[#CFB87C] shadow-[0_0_24px_rgba(207,184,124,0.2)]'
                      : 'border-[#2a2a2a] hover:border-[#CFB87C] hover:shadow-[0_0_20px_rgba(207,184,124,0.15)]'
                    : 'cursor-not-allowed border-[#2a2a2a] opacity-50'
                }`}
              >
                {card.enabled ? (
                  <button
                    type="button"
                    onClick={() => setSelectedType(card.type)}
                    className="absolute inset-0 z-10 rounded-lg"
                    aria-label={`Select ${card.title}`}
                  />
                ) : (
                  <span className="absolute top-4 right-4 z-10 rounded border border-[#444444] px-2 py-0.5 text-[10px] tracking-wider text-[#888888] uppercase">
                    Coming soon
                  </span>
                )}
                <Icon
                  className={`size-8 ${card.enabled ? 'text-[#CFB87C]' : 'text-[#555555]'}`}
                  strokeWidth={1.5}
                />
                <h2 className="mt-5 font-[family-name:var(--font-display)] text-lg font-semibold text-white">
                  {card.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#888888]">{card.subtitle}</p>
                <p className="mt-4 text-xs text-[#555555]">{card.docs}</p>
              </motion.div>
            )
          })}
        </motion.div>

        <div className="mt-12 flex w-full max-w-xs flex-col items-center">
          <Button
            type="button"
            disabled={!selectedType || isCreating}
            onClick={() => void handleContinue()}
            className="h-11 w-full rounded-lg bg-[#CFB87C] font-[family-name:var(--font-display)] text-sm font-bold tracking-wide text-black uppercase hover:bg-[#CFB87C]/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCreating ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Creating listing...
              </span>
            ) : (
              'Continue →'
            )}
          </Button>
          {error ? (
            <p className="mt-3 text-center text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </MissionShell>
  )
}

export default function NewListingPage() {
  return (
    <ErrorBoundary title="New Listing">
      <NewListingContent />
    </ErrorBoundary>
  )
}
