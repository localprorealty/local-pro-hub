import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, DollarSign, Briefcase, Calendar, CheckCircle2, AlertCircle, FileDown } from 'lucide-react'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MissionShell } from '@/components/layout/MissionShell'
import { getMyHistory, type TransactionHistory } from '@/lib/brokermint'
import CapProgressCard from '@/components/overview/CapProgressCard'
import { api } from '@/lib/api'
import { FEATURE_REVENUE_DASHBOARD } from '@/lib/featureFlags'

type ActiveTab = 'history' | 'earnings' | 'revenue_share'
type StatusFilter = 'all' | 'closed' | 'active' | 'pending' | 'cancelled'

const STATUS_PILLS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'closed', label: 'Closed' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
]

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

function getStatusBadgeClass(status: string): string {
  const norm = status.toLowerCase()
  if (norm === 'closed') {
    return 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/25'
  }
  if (norm === 'active') {
    return 'bg-blue-950/40 text-blue-400 border border-blue-500/25'
  }
  if (norm === 'pending') {
    return 'bg-amber-950/40 text-amber-400 border border-amber-500/25'
  }
  if (norm === 'listing') {
    return 'bg-transparent text-[var(--color-gold)] border border-[var(--color-gold)]/40'
  }
  return 'bg-zinc-900 text-zinc-400 border border-zinc-700/50'
}

function OverviewContent() {
  const [data, setData] = useState<TransactionHistory | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('history')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Revenue Share States
  const [revData, setRevData] = useState<any>(null)
  const [isRevLoading, setIsRevLoading] = useState(false)
  const [policyLoading, setPolicyLoading] = useState(false)

  useEffect(() => {
    if (activeTab !== 'revenue_share') return
    let active = true
    const fetchRevenueData = async () => {
      try {
        setIsRevLoading(true)
        const res = await api<any>('/revenue-share/my-earnings')
        if (active) setRevData(res)
      } catch (err) {
        console.error('Error loading revenue share data:', err)
      } finally {
        if (active) setIsRevLoading(false)
      }
    }
    void fetchRevenueData()
    return () => {
      active = false
    }
  }, [activeTab])

  const handleDownloadPolicy = async (type: 'growth_club_deck' | 'revenue_share_policy') => {
    try {
      setPolicyLoading(true)
      const res = await api<{ growth_club_deck: string | null; revenue_share_policy: string | null }>('/revenue-share/policy-url')
      const url = res[type]
      if (url) {
        window.open(url, '_blank')
      } else {
        alert('Document is not currently uploaded by Admin. Please check back later.')
      }
    } catch (err) {
      console.error('Error opening document:', err)
    } finally {
      setPolicyLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    const loadData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await getMyHistory()
        if (active) setData(res)
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch transaction data.'
          )
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }
    void loadData()
    return () => {
      active = false
    }
  }, [])

  const transactions = data?.transactions || []

  const filteredTransactions = useMemo(() => {
    if (activeTab === 'earnings') {
      // Earnings tab shows closed deals only
      return transactions.filter((tx) => (tx.status || '').toLowerCase() === 'closed')
    }

    return transactions.filter((tx) => {
      if (statusFilter === 'all') return true
      const txStatus = (tx.status || '').toLowerCase()
      if (statusFilter === 'cancelled') {
        return ['cancelled', 'terminated', 'withdrawn'].includes(txStatus)
      }
      return txStatus === statusFilter
    })
  }, [transactions, activeTab, statusFilter])

  // Count in-progress transactions
  const inProgressCount = useMemo(() => {
    return transactions.filter((tx) =>
      ['active', 'pending', 'listing'].includes((tx.status || '').toLowerCase())
    ).length
  }, [transactions])

  const closedCount = useMemo(() => {
    return transactions.filter((tx) => (tx.status || '').toLowerCase() === 'closed').length
  }, [transactions])

  const stats = data?.summary || {
    total_earned: 0,
    pending: 0,
    this_month: 0,
    total_transactions: 0,
    closed_count: 0,
  }

  const tabHeaderSlot = (
    <div className="flex border-b border-[var(--color-border)]">
      <button
        type="button"
        onClick={() => setActiveTab('history')}
        className={`px-6 py-3.5 text-xs font-semibold tracking-wider uppercase transition-colors relative ${
          activeTab === 'history'
            ? 'text-[var(--color-gold)]'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-white)]'
        }`}
      >
        Property History
        {activeTab === 'history' && (
          <motion.div
            layoutId="activeTabUnderline"
            className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-gold)]"
          />
        )}
      </button>
      {FEATURE_REVENUE_DASHBOARD && (
        <>
          <button
            type="button"
            onClick={() => setActiveTab('earnings')}
            className={`px-6 py-3.5 text-xs font-semibold tracking-wider uppercase transition-colors relative ${
              activeTab === 'earnings'
                ? 'text-[var(--color-gold)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-white)]'
            }`}
          >
            My Earnings
            {activeTab === 'earnings' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-gold)]"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('revenue_share')}
            className={`px-6 py-3.5 text-xs font-semibold tracking-wider uppercase transition-colors relative ${
              activeTab === 'revenue_share'
                ? 'text-[var(--color-gold)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-white)]'
            }`}
          >
            Revenue Share
            {activeTab === 'revenue_share' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-gold)]"
              />
            )}
          </button>
        </>
      )}
    </div>
  )

  return (
    <MissionShell
      role="agent"
      title="Overview"
      subtitle="Track your production history and revenue"
    >
      <div className="max-w-5xl space-y-8">
        {FEATURE_REVENUE_DASHBOARD && <CapProgressCard />}

        {tabHeaderSlot}

        {isLoading ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading dashboard data...</p>
        ) : error ? (
          <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-6 text-red-200">
            {error}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {activeTab === 'revenue_share' ? (
              <div className="space-y-8">
                {isRevLoading ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">Loading Revenue Share stats...</p>
                ) : !revData || !revData.eligible ? (
                  <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-8 rounded-sm text-center text-xs text-[var(--color-text-secondary)] italic">
                    Revenue Share information is not available. Please verify eligibility with Admin.
                  </div>
                ) : (
                  <>
                    {/* Stats Summary Row */}
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                      <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 rounded-sm relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold text-[var(--color-gold)]">Total Earned</p>
                          <h3 className="text-3xl font-bold text-white mt-2">
                            {formatCurrency(revData.summary.total_earned)}
                          </h3>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-2">All-time revenue share take-home</p>
                        <DollarSign className="absolute right-4 bottom-4 size-8 opacity-5 text-[var(--color-gold)]" />
                      </div>

                      <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 rounded-sm relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold text-[var(--color-gold)]">Paid Out</p>
                          <h3 className="text-3xl font-bold text-white mt-2">
                            {formatCurrency(revData.summary.paid_cash + revData.summary.paid_credit)}
                          </h3>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-2">
                          {formatCurrency(revData.summary.paid_cash)} cash + {formatCurrency(revData.summary.paid_credit)} cap credit
                        </p>
                        <CheckCircle2 className="absolute right-4 bottom-4 size-8 opacity-5 text-[var(--color-gold)]" />
                      </div>

                      <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 rounded-sm relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold text-[var(--color-gold)]">Unpaid Balance</p>
                          <h3 className="text-3xl font-bold text-[var(--color-gold)] mt-2">
                            {formatCurrency(revData.summary.unpaid_balance)}
                          </h3>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-2">To be paid next payout cycle</p>
                        <AlertCircle className="absolute right-4 bottom-4 size-8 opacity-5 text-[var(--color-gold)]" />
                      </div>
                    </div>

                    {/* Policy and Docs */}
                    <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 rounded-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs uppercase tracking-widest text-[var(--color-gold)] font-bold">Policy & Marketing Resources</h4>
                          <p className="text-xs text-[var(--color-text-secondary)]">Download documents and decks for the Growth Club.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          type="button"
                          disabled={policyLoading}
                          onClick={() => handleDownloadPolicy('growth_club_deck')}
                          className="flex items-center justify-between p-4 border border-[var(--color-border)] hover:border-[var(--color-gold)]/40 transition-colors bg-black text-left group w-full"
                        >
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-white group-hover:text-[var(--color-gold)] block transition-colors">Growth Club Deck (PDF)</span>
                            <span className="text-[10px] text-[var(--color-text-secondary)]">Revenue share model presentation</span>
                          </div>
                          <FileDown className="size-5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-gold)] transition-colors" />
                        </button>

                        <button
                          type="button"
                          disabled={policyLoading}
                          onClick={() => handleDownloadPolicy('revenue_share_policy')}
                          className="flex items-center justify-between p-4 border border-[var(--color-border)] hover:border-[var(--color-gold)]/40 transition-colors bg-black text-left group w-full"
                        >
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-white group-hover:text-[var(--color-gold)] block transition-colors">Revenue Share Policy (PDF)</span>
                            <span className="text-[10px] text-[var(--color-text-secondary)]">Rules, cap periods, and unlocks</span>
                          </div>
                          <FileDown className="size-5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-gold)] transition-colors" />
                        </button>
                      </div>
                    </div>

                    {/* Generation Breakdown Grid */}
                    <div className="space-y-4">
                      <h4 className="text-xs uppercase tracking-widest text-[var(--color-gold)] font-bold">Generation Breakdown</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                        {(
                          [
                            { g: 1, rate: '13.75%' },
                            { g: 2, rate: '5.31%' },
                            { g: 3, rate: '4.25%' },
                            { g: 4, rate: '3.18%' },
                            { g: 5, rate: '2.12%' },
                          ]
                        ).map(item => {
                          const amt = revData.summary.generation_breakdown[item.g] || 0
                          const contributors = Array.from(new Set(
                            revData.earnings
                              .filter((e: any) => e.generation === item.g)
                              .map((e: any) => e.contributor)
                          )) as string[]

                          return (
                            <div key={item.g} className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 rounded-sm space-y-3 flex flex-col justify-between">
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase text-[var(--color-text-secondary)] font-bold block">Gen {item.g} ({item.rate})</span>
                                <span className="text-lg font-bold text-white block">{formatCurrency(amt)}</span>
                              </div>
                              {contributors.length > 0 ? (
                                <div className="border-t border-[#2a2a2a] pt-2">
                                  <span className="text-[9px] text-[var(--color-text-secondary)] uppercase block mb-1">Contributors:</span>
                                  <div className="space-y-0.5 max-h-[60px] overflow-y-auto pr-1">
                                    {contributors.map(c => (
                                      <span key={c} className="text-[9px] text-white block font-light truncate">{c}</span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[9px] text-[var(--color-text-secondary)] italic block border-t border-[#2a2a2a] pt-2">No contributors yet</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Earnings list */}
                    <div className="space-y-4">
                      <h4 className="text-xs uppercase tracking-widest text-[var(--color-gold)] font-bold">Revenue Share Ledger</h4>
                      <div className="border border-[var(--color-border)] rounded-sm overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-black/60 text-[var(--color-gold)] uppercase tracking-wider font-semibold border-b border-[var(--color-border)]">
                            <tr>
                              <th className="px-6 py-4">Transaction / Type</th>
                              <th className="px-6 py-4">Contributor</th>
                              <th className="px-6 py-4">Gen</th>
                              <th className="px-6 py-4">Date</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface-2)]">
                            {revData.earnings.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-[var(--color-text-secondary)] italic">
                                  No revenue share earnings or bonuses recorded yet.
                                </td>
                              </tr>
                            ) : (
                              revData.earnings.map((e: any) => (
                                <tr key={e.id} className="hover:bg-black/20">
                                  <td className="px-6 py-4 font-semibold text-white">
                                    {e.description}
                                  </td>
                                  <td className="px-6 py-4 text-white">
                                    {e.contributor}
                                  </td>
                                  <td className="px-6 py-4 text-white">
                                    Gen {e.generation}
                                  </td>
                                  <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                                    {new Date(e.created_at).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </td>
                                  <td className="px-6 py-4">
                                    {e.is_paid ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[9px] uppercase font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-500/25">
                                        Paid
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[9px] uppercase font-bold bg-zinc-900 text-zinc-400 border border-zinc-700/50">
                                        Unpaid
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right font-bold text-[var(--color-gold)]">
                                    {formatCurrency(e.amount)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : activeTab === 'history' ? (
              // PROPERTY HISTORY VIEW
              <>
                {/* Stats cards */}
                <div className={`grid gap-4 grid-cols-1 ${FEATURE_REVENUE_DASHBOARD ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                  <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 rounded-sm relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">Total Closed</p>
                      <h3 className="text-3xl font-bold text-[var(--color-white)] mt-2">{closedCount}</h3>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-2">transactions finalized</p>
                    <Briefcase className="absolute right-4 bottom-4 size-8 opacity-5 text-[var(--color-gold)]" />
                  </div>

                  <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 rounded-sm relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">In Progress</p>
                      <h3 className="text-3xl font-bold text-[var(--color-white)] mt-2">{inProgressCount}</h3>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-2">active, pending, or listings</p>
                    <Calendar className="absolute right-4 bottom-4 size-8 opacity-5 text-[var(--color-gold)]" />
                  </div>

                  {FEATURE_REVENUE_DASHBOARD && (
                    <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 rounded-sm relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">Total Earned</p>
                        <h3 className="text-3xl font-bold text-[var(--color-gold)] mt-2">{formatCurrency(stats.total_earned)}</h3>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-2">agent split take-home</p>
                      <DollarSign className="absolute right-4 bottom-4 size-8 opacity-5 text-[var(--color-gold)]" />
                    </div>
                  )}
                </div>

                {/* Filter pills */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {STATUS_PILLS.map((pill) => (
                    <button
                      key={pill.value}
                      type="button"
                      onClick={() => setStatusFilter(pill.value)}
                      className={`px-3 py-1.5 text-[10px] tracking-wider uppercase transition-colors rounded-sm ${
                        statusFilter === pill.value
                          ? 'border border-[var(--color-gold)] bg-[var(--color-gold)]/10 text-[var(--color-gold)]'
                          : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-gold)]/50'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              // REVENUE / MY EARNINGS VIEW
              <>
                {/* Stats cards */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                  <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 rounded-sm relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold text-[var(--color-gold)]">Total Earned</p>
                      <h3 className="text-3xl font-bold text-[var(--color-gold)] mt-2">{formatCurrency(stats.total_earned)}</h3>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-2">all-time closed split</p>
                    <DollarSign className="absolute right-4 bottom-4 size-8 opacity-5 text-[var(--color-gold)]" />
                  </div>

                  <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 rounded-sm relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold text-[var(--color-gold)]">This Month</p>
                      <h3 className="text-3xl font-bold text-[var(--color-gold)] mt-2">{formatCurrency(stats.this_month)}</h3>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-2">closing this month</p>
                    <Calendar className="absolute right-4 bottom-4 size-8 opacity-5 text-[var(--color-gold)]" />
                  </div>

                  <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 rounded-sm relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold text-[var(--color-gold)]">Pending</p>
                      <h3 className="text-3xl font-bold text-[var(--color-gold)] mt-2">{formatCurrency(stats.pending)}</h3>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-2">in progress active/pending</p>
                    <FileText className="absolute right-4 bottom-4 size-8 opacity-5 text-[var(--color-gold)]" />
                  </div>
                </div>
              </>
            )}

            {/* List */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase tracking-widest text-[var(--color-gold)] font-bold">
                {activeTab === 'history' ? 'Transactions List' : 'Earnings Breakdown'}
              </h3>

              {filteredTransactions.length === 0 ? (
                <div className="flex h-36 items-center justify-center border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] rounded-sm">
                  Your transaction history will appear here after your account is synced.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="font-semibold text-white text-base">
                            {tx.address}
                          </h4>
                          {tx.city && (
                            <span className="text-xs text-[var(--color-text-secondary)]">
                              ({tx.city}, {tx.state})
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-wider font-semibold ${getStatusBadgeClass(tx.status)}`}>
                            {tx.status}
                          </span>
                          {activeTab === 'earnings' && (
                            tx.paid_at ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[9px] uppercase font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-500/25">
                                <CheckCircle2 className="size-2.5" />
                                PAID
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[9px] uppercase font-bold bg-zinc-900 text-zinc-400 border border-zinc-700/50">
                                <AlertCircle className="size-2.5" />
                                UNPAID
                              </span>
                            )
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                          {tx.closing_date && (
                            <span>
                              {tx.status.toLowerCase() === 'closed' ? 'Closed: ' : 'Target Closing: '}
                              <span className="text-white font-medium">
                                {new Date(tx.closing_date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  timeZone: 'UTC'
                                })}
                              </span>
                            </span>
                          )}
                           {FEATURE_REVENUE_DASHBOARD && tx.price && (
                            <span>
                              Volume: <span className="text-white font-medium">{formatCurrency(tx.price)}</span>
                            </span>
                          )}
                          {tx.representing && (
                            <span>
                              Representing: <span className="text-white font-medium uppercase">{tx.representing}</span>
                            </span>
                          )}
                        </div>
                        {activeTab === 'earnings' && tx.payment_note && (
                          <p className="text-xs text-[var(--color-gold)] font-medium">
                            Payment Note: <span className="text-gray-300 font-light italic">{tx.payment_note}</span>
                          </p>
                        )}
                      </div>

                      {FEATURE_REVENUE_DASHBOARD && (
                        <div className="flex items-center gap-6 border-t md:border-t-0 border-[#2a2a2a] pt-3 md:pt-0">
                          {activeTab === 'history' ? (
                            <>
                              <div className="text-left md:text-right">
                                <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Gross</p>
                                <p className="text-sm font-semibold text-white">{formatCurrency(tx.adjusted_basis)}</p>
                              </div>
                              <div className="text-left md:text-right">
                                <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">Net take-home</p>
                                <p className="text-base font-bold text-[var(--color-gold)]">{formatCurrency(tx.net_commission)}</p>
                              </div>
                            </>
                          ) : (
                            <div className="text-left md:text-right">
                              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Net Earnings</p>
                              <p className="text-base font-bold text-[var(--color-gold)]">{formatCurrency(tx.net_commission)}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeTab === 'earnings' && (
              <p className="text-[11px] text-[var(--color-text-secondary)] italic text-center pt-4">
                Earnings reflect your net commission from closed deals. Pending amounts are estimates and may change.
              </p>
            )}
          </motion.div>
        )}
      </div>
    </MissionShell>
  )
}

export default function OverviewPage() {
  return (
    <ErrorBoundary title="Overview">
      <OverviewContent />
    </ErrorBoundary>
  )
}
