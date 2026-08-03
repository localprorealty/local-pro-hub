import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Undo2,
} from 'lucide-react'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

type AgentTransaction = {
  commission_id: string
  address: string
  city: string
  closing_date: string | null
  price: number | string
  amount: number
  status: string
  paid: boolean
  payment_note: string | null
}

type AgentRevenue = {
  name: string
  email: string
  total_earned: number
  total_paid: number
  total_unpaid: number
  transactions: AgentTransaction[]
}

type AllAgentsResponse = {
  agents: AgentRevenue[]
  date_from: string | null
  date_to: string | null
}

function formatCurrency(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return '$0'
  const numeric = typeof val === 'number' ? val : parseFloat(val)
  if (isNaN(numeric)) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(numeric)
}

function getInitialDates() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0')
  
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${lastDay}`,
  }
}

function RevenueOverviewContent() {
  const defaultDates = useMemo(() => getInitialDates(), [])
  
  const [dateFrom, setDateFrom] = useState(defaultDates.from)
  const [dateTo, setDateTo] = useState(defaultDates.to)
  
  const [agents, setAgents] = useState<AgentRevenue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  
  // Bulk paid workflow note state
  const [bulkNote, setBulkNote] = useState('')
  const [activeBulkAgent, setActiveBulkAgent] = useState<string | null>(null)

  // Undo states
  const [undoIds, setUndoIds] = useState<string[] | null>(null)
  const [showUndo, setShowUndo] = useState(false)
  const [undoTimeoutId, setUndoTimeoutId] = useState<number | null>(null)

  const fetchRevenue = async (fromVal: string, toVal: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await api<AllAgentsResponse>(
        `/brokermint/all-agents-revenue?date_from=${fromVal}&date_to=${toVal}`
      )
      setAgents(res.agents || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch revenue data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchRevenue(dateFrom, dateTo)
  }, [])

  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => b.total_unpaid - a.total_unpaid)
  }, [agents])

  const handleApplyFilter = () => {
    void fetchRevenue(dateFrom, dateTo)
  }

  const triggerUndoTimer = (ids: string[]) => {
    if (undoTimeoutId) {
      window.clearTimeout(undoTimeoutId)
    }
    setUndoIds(ids)
    setShowUndo(true)
    const timeout = window.setTimeout(() => {
      setShowUndo(false)
      setUndoIds(null)
    }, 5000)
    setUndoTimeoutId(timeout)
  }

  const handleMarkPaid = async (commissionId: string, note?: string) => {
    try {
      // Optimistic update
      setAgents((prev) =>
        prev.map((agent) => {
          const matchedTx = agent.transactions.find((tx) => tx.commission_id === commissionId)
          if (!matchedTx) return agent

          const updatedTxs = agent.transactions.map((tx) =>
            tx.commission_id === commissionId
              ? { ...tx, paid: true, payment_note: note || tx.payment_note }
              : tx
          )
          
          const totalPaid = updatedTxs
            .filter((tx) => tx.status === 'closed' && tx.paid)
            .reduce((sum, tx) => sum + tx.amount, 0)
          
          const totalUnpaid = updatedTxs
            .filter((tx) => tx.status === 'closed' && !tx.paid)
            .reduce((sum, tx) => sum + tx.amount, 0)

          return {
            ...agent,
            transactions: updatedTxs,
            total_paid: totalPaid,
            total_unpaid: totalUnpaid,
          }
        })
      )

      await api('/brokermint/mark-paid', {
        method: 'POST',
        body: JSON.stringify({
          commission_ids: [commissionId],
          payment_note: note,
        }),
      })

      triggerUndoTimer([commissionId])
    } catch (err) {
      // Re-fetch on error to revert state
      void fetchRevenue(dateFrom, dateTo)
      setError('Failed to mark commission as paid.')
    }
  }

  const handleMarkBulkPaid = async (agentEmail: string) => {
    const agent = agents.find((a) => a.email === agentEmail)
    if (!agent) return

    const unpaidIds = agent.transactions
      .filter((tx) => tx.status === 'closed' && !tx.paid)
      .map((tx) => tx.commission_id)

    if (unpaidIds.length === 0) return

    try {
      // Optimistic update
      setAgents((prev) =>
        prev.map((a) => {
          if (a.email !== agentEmail) return a
          
          const updatedTxs = a.transactions.map((tx) =>
            unpaidIds.includes(tx.commission_id)
              ? { ...tx, paid: true, payment_note: bulkNote || tx.payment_note }
              : tx
          )

          return {
            ...a,
            transactions: updatedTxs,
            total_paid: a.total_paid + a.total_unpaid,
            total_unpaid: 0,
          }
        })
      )

      await api('/brokermint/mark-paid', {
        method: 'POST',
        body: JSON.stringify({
          commission_ids: unpaidIds,
          payment_note: bulkNote || undefined,
        }),
      })

      triggerUndoTimer(unpaidIds)
      setActiveBulkAgent(null)
      setBulkNote('')
    } catch (err) {
      void fetchRevenue(dateFrom, dateTo)
      setError('Failed to mark commissions as paid.')
    }
  }

  const handleUndo = async () => {
    if (!undoIds || undoIds.length === 0) return
    const idsToRevert = [...undoIds]
    
    // Clear undo states
    setShowUndo(false)
    setUndoIds(null)
    if (undoTimeoutId) {
      window.clearTimeout(undoTimeoutId)
      setUndoTimeoutId(null)
    }

    try {
      await api('/brokermint/mark-unpaid', {
        method: 'POST',
        body: JSON.stringify({ commission_ids: idsToRevert }),
      })
      void fetchRevenue(dateFrom, dateTo)
    } catch (err) {
      setError('Failed to undo payment status.')
      void fetchRevenue(dateFrom, dateTo)
    }
  }

  return (
    <AdminShell title="Agent Commissions" eyebrow="Broker Control">
      <div className="max-w-4xl space-y-8">
        
        {/* Undo notification banner */}
        <AnimatePresence>
          {showUndo && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[var(--color-gold)] text-black px-6 py-3 rounded-sm flex items-center justify-between shadow-xl"
            >
              <span className="text-sm font-semibold">Payment marked as paid successfully.</span>
              <button
                onClick={() => void handleUndo()}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-black text-white px-3 py-1.5 rounded-sm hover:opacity-90"
              >
                <Undo2 className="size-3.5" />
                Undo
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Date Filters Header Section */}
        <div className="flex flex-wrap items-end justify-between gap-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] p-6 rounded-sm">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 bg-[var(--color-surface-3)] border-0 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 bg-[var(--color-surface-3)] border-0 text-white"
              />
            </div>
          </div>
          <Button
            onClick={handleApplyFilter}
            className="h-10 bg-[var(--color-gold)] text-black hover:bg-[#dcc487] font-bold uppercase text-xs tracking-wider px-6 rounded-sm"
          >
            Apply Range
          </Button>
        </div>

        {error && (
          <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-6 text-red-200">
            {error}
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading agent revenue information...</p>
        ) : sortedAgents.length === 0 ? (
          <div className="flex h-36 items-center justify-center border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] rounded-sm">
            No transactions found for the selected date range.
          </div>
        ) : (
          <div className="space-y-6">
            {sortedAgents.map((agent) => {
              const isExpanded = expandedAgent === agent.email
              const isBulking = activeBulkAgent === agent.email

              return (
                <div
                  key={agent.email}
                  className="border border-[var(--color-border)] bg-[var(--color-surface-2)] rounded-sm overflow-hidden"
                >
                  {/* Agent Card Summary Header */}
                  <div className="p-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#222]">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-white text-lg">{agent.name}</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] font-mono">{agent.email}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Total Earned</p>
                        <p className="text-base font-bold text-white">{formatCurrency(agent.total_earned)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Paid</p>
                        <p className="text-base font-bold text-emerald-400">{formatCurrency(agent.total_paid)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Unpaid</p>
                        <p className="text-base font-bold text-amber-400">{formatCurrency(agent.total_unpaid)}</p>
                      </div>
                      <button
                        onClick={() => setExpandedAgent(isExpanded ? null : agent.email)}
                        className="text-[var(--color-text-secondary)] hover:text-white p-2"
                        aria-label="Expand transactions"
                      >
                        {isExpanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Agent Transactions Panel */}
                  {isExpanded && (
                    <div className="p-6 bg-black/10 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* Bulk action row */}
                      {agent.total_unpaid > 0 && (
                        <div className="border-b border-[#222] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {!isBulking ? (
                            <Button
                              onClick={() => {
                                setBulkNote('')
                                setActiveBulkAgent(agent.email)
                              }}
                              className="bg-[var(--color-gold)] text-black hover:bg-[#dcc487] text-xs font-bold uppercase tracking-wider h-9 rounded-sm"
                            >
                              Mark All Unpaid as Paid
                            </Button>
                          ) : (
                            <div className="flex flex-wrap items-center gap-3 w-full max-w-xl">
                              <Input
                                value={bulkNote}
                                onChange={(e) => setBulkNote(e.target.value)}
                                placeholder="Add an optional payment note..."
                                className="h-9 bg-[var(--color-surface-3)] border-0 text-white placeholder-gray-500 text-xs flex-1 min-w-[200px]"
                              />
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => void handleMarkBulkPaid(agent.email)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider h-9 px-4 rounded-sm"
                                >
                                  Confirm
                                </Button>
                                <Button
                                  onClick={() => {
                                    setActiveBulkAgent(null)
                                    setBulkNote('')
                                  }}
                                  className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider h-9 px-4 rounded-sm"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Deals list */}
                      <div className="space-y-4">
                        {agent.transactions.map((tx) => (
                          <div
                            key={tx.commission_id}
                            className="bg-[var(--color-surface-3)]/60 border border-[var(--color-border)]/50 p-4 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-white text-sm">{tx.address}</span>
                                <span className={`px-1.5 py-0.5 rounded-sm text-[8px] uppercase tracking-wider font-bold ${
                                  tx.status === 'closed'
                                    ? 'bg-emerald-950/40 text-emerald-400'
                                    : 'bg-amber-950/40 text-amber-400'
                                }`}>
                                  {tx.status}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 text-xs text-[var(--color-text-secondary)]">
                                {tx.closing_date && (
                                  <span>Closed: {new Date(tx.closing_date).toLocaleDateString('en-US', { timeZone: 'UTC' })}</span>
                                )}
                                {tx.price && <span>Price: {formatCurrency(tx.price)}</span>}
                              </div>
                              {tx.payment_note && (
                                <p className="text-xs text-[var(--color-gold)]">
                                  Note: <span className="text-gray-300 italic font-light">{tx.payment_note}</span>
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <p className="text-[10px] uppercase text-[var(--color-text-secondary)]">Commission</p>
                                <p className="text-sm font-bold text-white">{formatCurrency(tx.amount)}</p>
                              </div>

                              {tx.paid ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-950/40 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 text-[10px] font-bold rounded-sm uppercase">
                                  <CheckCircle2 className="size-3.5" />
                                  PAID
                                </span>
                              ) : (
                                <Button
                                  onClick={() => void handleMarkPaid(tx.commission_id)}
                                  disabled={tx.status !== 'closed'}
                                  className="h-8 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 text-[10px] font-bold uppercase tracking-wider rounded-sm px-3"
                                >
                                  Mark Paid
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminShell>
  )
}

export default function RevenueOverviewPage() {
  return (
    <ErrorBoundary title="Agent Commissions">
      <RevenueOverviewContent />
    </ErrorBoundary>
  )
}
