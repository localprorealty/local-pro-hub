import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Home, Key, Loader2, Search, UserCheck, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MissionShell } from '@/components/layout/MissionShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createListing, type ListingType } from '@/lib/listings'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchUserProfile, fetchUsersByRole, type UserProfileRow } from '@/lib/users'

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

  // Auth & role state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentProfile, setCurrentProfile] = useState<UserProfileRow | null>(null)

  // Agent picker state for TC & Admin
  const [agents, setAgents] = useState<UserProfileRow[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [agentSearch, setAgentSearch] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<UserProfileRow | null>(null)
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function initUser() {
      try {
        const {
          data: { session },
        } = await getSupabaseClient().auth.getSession()
        const uid = session?.user?.id
        if (!uid) {
          return
        }
        if (isMounted) setCurrentUserId(uid)

        const profile = await fetchUserProfile(uid)
        if (isMounted) {
          setCurrentProfile(profile)
        }

        // If TC or Admin, fetch agents roster
        if (profile?.role === 'transaction_coordinator' || profile?.role === 'admin') {
          if (isMounted) setLoadingAgents(true)
          try {
            const roster = await fetchUsersByRole('agent')
            if (isMounted) {
              // Show active agents
              const activeAgents = roster.filter((a) => a.status === 'active')
              setAgents(activeAgents)
            }
          } catch (e) {
            console.error('Failed to fetch agents roster:', e)
          } finally {
            if (isMounted) setLoadingAgents(false)
          }
        }
      } catch (e) {
        console.error('Error initializing user for new listing:', e)
      }
    }
    void initUser()
    return () => {
      isMounted = false
    }
  }, [])

  const isStaff =
    currentProfile?.role === 'transaction_coordinator' || currentProfile?.role === 'admin'

  const filteredAgents = useMemo(() => {
    if (!agentSearch.trim()) return agents
    const q = agentSearch.toLowerCase()
    return agents.filter(
      (a) =>
        a.full_name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.mls_id?.toLowerCase().includes(q),
    )
  }, [agents, agentSearch])

  const handleContinue = async () => {
    if (!selectedType || isCreating) return

    if (isStaff && !selectedAgent) {
      setError('Please select an agent to create this listing on behalf of.')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const targetAgentId = isStaff ? selectedAgent!.id : currentUserId
      if (!targetAgentId) {
        setError('You must be signed in to create a listing.')
        return
      }

      const createdBy = isStaff && currentUserId ? currentUserId : undefined
      const result = await createListing(targetAgentId, selectedType, createdBy)
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
    <header className="hidden lg:flex relative items-center justify-center border-b border-[#2a2a2a] px-8 py-6">
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

  const shellRole =
    currentProfile?.role === 'transaction_coordinator' ? 'transaction_coordinator' : 'agent'

  return (
    <MissionShell role={shellRole} title="New Listing" backTo="/dashboard" headerSlot={headerSlot}>
      <div className="mx-auto flex max-w-5xl flex-col items-center">
        {/* TC / Admin Agent Selection Section */}
        {isStaff && (
          <div className="mb-8 w-full max-w-2xl">
            <div className="rounded-xl border border-[#CFB87C]/30 bg-[#161616] p-5 shadow-lg">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="size-5 text-[#CFB87C]" />
                  <h2 className="text-sm font-semibold tracking-wide uppercase text-white font-[family-name:var(--font-display)]">
                    Create on behalf of Agent
                  </h2>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded bg-[#CFB87C]/15 text-[#CFB87C] font-mono font-medium">
                  {currentProfile?.role === 'transaction_coordinator'
                    ? 'Transaction Coordinator'
                    : 'Admin'}
                </span>
              </div>

              {selectedAgent ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-[#CFB87C]/60 bg-[#1c1c1c] p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-[#CFB87C]/20 text-sm font-bold text-[#CFB87C]">
                      {selectedAgent.full_name
                        ? selectedAgent.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)
                        : 'AG'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">
                          {selectedAgent.full_name || 'Unnamed Agent'}
                        </span>
                        <CheckCircle2 className="size-4 text-emerald-400" />
                      </div>
                      <p className="text-xs text-[#888888]">
                        {selectedAgent.email}
                        {selectedAgent.mls_id && (
                          <span className="ml-2 rounded bg-[#2a2a2a] px-1.5 py-0.5 text-[10px] text-[#CFB87C]">
                            MLS: {selectedAgent.mls_id}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedAgent(null)
                      setIsPickerOpen(true)
                    }}
                    className="border-[#3a3a3a] text-xs text-[#aaaaaa] hover:border-[#CFB87C] hover:text-white"
                  >
                    Change Agent
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#888888]">
                    Select the agent who will own this listing. It will appear directly in their pipeline.
                  </p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#666666]" />
                    <Input
                      type="text"
                      value={agentSearch}
                      onChange={(e) => {
                        setAgentSearch(e.target.value)
                        setIsPickerOpen(true)
                      }}
                      onFocus={() => setIsPickerOpen(true)}
                      placeholder={
                        loadingAgents
                          ? 'Loading agents...'
                          : 'Search agents by name, email, or MLS ID...'
                      }
                      className="pl-9 bg-[#111111] border-[#333333] text-sm text-white placeholder:text-[#555555] focus:border-[#CFB87C]"
                    />
                    {agentSearch && (
                      <button
                        type="button"
                        onClick={() => setAgentSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-white"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>

                  {isPickerOpen && (
                    <div className="max-h-60 overflow-y-auto rounded-lg border border-[#2a2a2a] bg-[#141414] shadow-2xl divide-y divide-[#222222]">
                      {loadingAgents ? (
                        <div className="p-4 text-center text-xs text-[#888888]">
                          <Loader2 className="inline size-4 animate-spin mr-2 text-[#CFB87C]" />
                          Loading agents list...
                        </div>
                      ) : filteredAgents.length === 0 ? (
                        <div className="p-4 text-center text-xs text-[#888888]">
                          No agents found matching &ldquo;{agentSearch}&rdquo;
                        </div>
                      ) : (
                        filteredAgents.map((agent) => (
                          <button
                            key={agent.id}
                            type="button"
                            onClick={() => {
                              setSelectedAgent(agent)
                              setIsPickerOpen(false)
                              setError(null)
                            }}
                            className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-[#1f1f1f]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex size-8 items-center justify-center rounded-full bg-[#252525] text-xs font-semibold text-[#CFB87C]">
                                {agent.full_name
                                  ? agent.full_name
                                      .split(' ')
                                      .map((n) => n[0])
                                      .join('')
                                      .toUpperCase()
                                      .slice(0, 2)
                                  : 'AG'}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {agent.full_name || 'Unnamed Agent'}
                                </p>
                                <p className="text-xs text-[#777777]">{agent.email}</p>
                              </div>
                            </div>
                            {agent.mls_id && (
                              <span className="text-[10px] font-mono text-[#CFB87C] bg-[#222222] px-2 py-0.5 rounded">
                                MLS: {agent.mls_id}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

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
            disabled={!selectedType || isCreating || (isStaff && !selectedAgent)}
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
          {isStaff && !selectedAgent && (
            <p className="mt-2 text-center text-xs text-[#888888]">
              Select an agent above to proceed
            </p>
          )}
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
