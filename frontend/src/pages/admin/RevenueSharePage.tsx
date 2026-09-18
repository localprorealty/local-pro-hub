import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  UserCheck,
  Settings,
  RefreshCw,
  Edit,
  CheckCircle2,
  Users,
  HelpCircle,
  ArrowRight,
  Info,
  Calendar,
  Layers,
  FileText,
  Building2,
} from 'lucide-react'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { FEATURE_SPONSOR_TREE } from '@/lib/featureFlags'

type AgentSummary = {
  user_id: string
  name: string
  email: string
  total_earned: number
  total_paid: number
  remaining_owed: number
}

type SuggestedPayment = {
  recipient_id: string
  recipient_name: string
  recipient_email: string
  unpaid_total: number
  credit_suggested: number
  cash_suggested: number
  remaining_cap_room: number
  earning_ids: string[]
  bonus_ids: string[]
  items: {
    type: 'earning' | 'bonus'
    id: string
    contributor: string
    generation: number
    amount: number
  }[]
}

type Override = {
  user_id: string
  full_name: string
  email: string
  status: string
  cap_amount: number | null
  cap_override: number | null
  eligibility_override: boolean | null
  cash_override: boolean
  sponsor_override: string | null
  notes: string | null
}

type ResolutionLog = {
  id: string
  user_id: string
  raw_sponsor_text: string
  resolution_status: 'unmatched' | 'ambiguous' | 'resolved_to_deana' | 'resolved_manually'
  resolved_user_id: string | null
  candidate_matches: { user_id: string; name: string }[] | null
  created_at: string
  users: {
    full_name: string
    email: string
  }
}

type GlobalSettings = {
  min_cap_amount: number
  grace_period_months: number
  production_min_transactions: number
  production_window_months: number
  gen1_rate: number
  gen2_rate: number
  gen3_rate: number
  gen4_rate: number
  gen5_rate: number
  gen1_completion_bonus: number
  gen2_completion_bonus: number
  gen3_completion_bonus: number
  gen4_completion_bonus: number
  gen5_completion_bonus: number
  gen1_max_payout: number
  gen2_max_payout: number
  gen3_max_payout: number
  gen4_max_payout: number
  gen5_max_payout: number
  gen2_unlock_count: number
  gen3_unlock_count: number
  gen4_unlock_count: number
  gen5_unlock_count: number
}

type ActiveTab = 'summary' | 'ledger' | 'overrides' | 'resolution' | 'settings' | 'calc' | 'how_it_works'

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val)
}

function formatMoney(val: number | null | undefined): string {
  if (val === null || val === undefined) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

function RevenueShareContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('summary')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 0. Agent Summary State
  const [summaries, setSummaries] = useState<AgentSummary[]>([])

  // 1. Ledger State
  const [ledger, setLedger] = useState<SuggestedPayment[]>([])
  const [periodLabel, setPeriodLabel] = useState('')
  const [periodLabelError, setPeriodLabelError] = useState<string | null>(null)
  const [notesByRecipient, setNotesByRecipient] = useState<Record<string, string>>({})
  const [payingState, setPayingState] = useState<Record<string, boolean>>({})

  // 2. Overrides State
  const [overrides, setOverrides] = useState<Override[]>([])
  const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null)
  const [editCap, setEditCap] = useState('')
  const [editElig, setEditElig] = useState<'default' | 'force_true' | 'force_false'>('default')
  const [editCash, setEditCash] = useState(false)
  const [editSponsor, setEditSponsor] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // 3. Resolution Logs State
  const [logs, setLogs] = useState<ResolutionLog[]>([])
  const [selectedSponsors, setSelectedSponsors] = useState<Record<string, string>>({})
  const [sponsorErrors, setSponsorErrors] = useState<Record<string, string>>({})

  // 4. Settings State
  const [settings, setSettings] = useState<GlobalSettings | null>(null)

  // Trigger Calculations
  const [isRunningCalcs, setIsRunningCalcs] = useState(false)

  // Fetch functions
  const fetchSummaries = async () => {
    try {
      const data = await api<AgentSummary[]>('/revenue-share/agent-summaries')
      setSummaries(data || [])
    } catch (err) {
      console.error('Error fetching agent summaries:', err)
    }
  }

  const fetchLedger = async () => {
    try {
      const data = await api<SuggestedPayment[]>('/revenue-share/payments')
      setLedger(data || [])
    } catch (err) {
      console.error('Error fetching ledger:', err)
    }
  }

  const fetchOverrides = async () => {
    try {
      const data = await api<Override[]>('/revenue-share/overrides')
      setOverrides(data || [])
    } catch (err) {
      console.error('Error fetching overrides:', err)
    }
  }

  const fetchLogs = async () => {
    try {
      const data = await api<ResolutionLog[]>('/revenue-share/resolution-logs')
      setLogs(data || [])
    } catch (err) {
      console.error('Error fetching logs:', err)
    }
  }

  const fetchSettings = async () => {
    try {
      const data = await api<GlobalSettings>('/revenue-share/settings')
      setSettings(data)
    } catch (err) {
      console.error('Error fetching settings:', err)
    }
  }

  const loadAll = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await Promise.all([fetchSummaries(), fetchLedger(), fetchOverrides(), fetchLogs(), fetchSettings()])
      
      // Default period label to current Quarter/Year
      const now = new Date()
      const quarter = Math.floor(now.getMonth() / 3) + 1
      setPeriodLabel(`Q${quarter} ${now.getFullYear()}`)
    } catch (err) {
      setError('Failed to load revenue share console data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  // 1. Mark Paid action
  const handleMarkPaid = async (payment: SuggestedPayment) => {
    if (!periodLabel.trim()) {
      setPeriodLabelError('Please specify a period label (e.g. Q3 2026) first.')
      return
    }
    setPeriodLabelError(null)
    
    const recId = payment.recipient_id
    setPayingState(prev => ({ ...prev, [recId]: true }))
    setError(null)
    setSuccess(null)

    try {
      await api('/revenue-share/payments', {
        method: 'POST',
        body: {
          recipient_user_id: recId,
          period_label: periodLabel,
          cash_amount: payment.cash_suggested,
          credit_amount: payment.credit_suggested,
          earning_ids: payment.earning_ids,
          bonus_ids: payment.bonus_ids,
          notes: notesByRecipient[recId] || ''
        }
      })
      setSuccess(`Payment for ${payment.recipient_name} successfully processed and synced to BrokerMint.`)
      // Refresh summaries, ledger & overrides
      await Promise.all([fetchSummaries(), fetchLedger(), fetchOverrides()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment.')
    } finally {
      setPayingState(prev => ({ ...prev, [recId]: false }))
    }
  }

  // 2. Override Save
  const handleSaveOverride = async (user_id: string) => {
    setError(null)
    setSuccess(null)
    try {
      const elig_override = editElig === 'default' ? null : editElig === 'force_true'
      await api('/revenue-share/overrides', {
        method: 'POST',
        body: {
          user_id,
          cap_override: editCap ? parseFloat(editCap) : null,
          eligibility_override: elig_override,
          cash_override: editCash,
          sponsor_override: editSponsor || null,
          notes: editNotes || null
        }
      })
      setSuccess('Agent override successfully updated.')
      setEditingOverrideId(null)
      await fetchOverrides()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save override.')
    }
  }

  // 3. Resolve Sponsor Log
  const handleResolveSponsor = async (user_id: string) => {
    const selectedSponsorId = selectedSponsors[user_id]
    if (!selectedSponsorId) {
      setSponsorErrors(prev => ({ ...prev, [user_id]: 'Please select a sponsor from candidates or overrides.' }))
      return
    }
    setSponsorErrors(prev => ({ ...prev, [user_id]: '' }))
    setError(null)
    setSuccess(null)
    try {
      await api('/revenue-share/resolution-logs/resolve', {
        method: 'POST',
        body: {
          user_id,
          sponsor_override: selectedSponsorId
        }
      })
      setSuccess('Sponsor resolution successfully applied.')
      await Promise.all([fetchLogs(), fetchOverrides(), fetchLedger(), fetchSummaries()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve sponsor.')
    }
  }

  // 4. Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return
    setError(null)
    setSuccess(null)
    try {
      await api('/revenue-share/settings', {
        method: 'POST',
        body: settings
      })
      setSuccess('Global revenue share settings successfully updated.')
      await fetchSettings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings.')
    }
  }

  // 5. Trigger Calculations Run
  const handleReprocess = async () => {
    setIsRunningCalcs(true)
    setError(null)
    setSuccess(null)
    try {
      await api('/revenue-share/reprocess', { method: 'POST' })
      setSuccess('Revenue share earnings calculations successfully executed.')
      await Promise.all([fetchSummaries(), fetchLedger()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reprocess calculations.')
    } finally {
      setIsRunningCalcs(false)
    }
  }

  return (
    <AdminShell title="Revenue Share Console">
      <div className="space-y-6 w-full min-w-0">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--color-border)] overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              { key: 'summary', label: 'Agent Summary', icon: <Users className="size-4 mr-2" /> },
              { key: 'ledger', label: 'Payout Suggested Ledger', icon: <DollarSign className="size-4 mr-2" /> },
              FEATURE_SPONSOR_TREE ? { key: 'overrides', label: 'Agent Overrides', icon: <Edit className="size-4 mr-2" /> } : null,
              FEATURE_SPONSOR_TREE ? { key: 'resolution', label: 'Sponsor Resolution', icon: <UserCheck className="size-4 mr-2" /> } : null,
              { key: 'settings', label: 'Global Settings', icon: <Settings className="size-4 mr-2" /> },
              { key: 'calc', label: 'Calculations Run', icon: <RefreshCw className="size-4 mr-2" /> },
              { key: 'how_it_works', label: 'How This Works', icon: <HelpCircle className="size-4 mr-2" /> },
            ] as ({ key: ActiveTab; label: string; icon: JSX.Element } | null)[]
          ).filter((t): t is { key: ActiveTab; label: string; icon: JSX.Element } => t !== null)
          .map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key)
                setError(null)
                setSuccess(null)
              }}
              className={`shrink-0 whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center relative ${
                activeTab === tab.key
                  ? 'text-[var(--color-gold)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === 'resolution' && logs.length > 0 && (
                <span className="ml-2 bg-red-600 text-white rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                  {logs.length}
                </span>
              )}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="activeSubTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-gold)]"
                />
              )}
            </button>
          ))}
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="p-4 border border-red-500/30 bg-red-500/10 rounded-sm text-red-200 text-xs">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 border border-emerald-500/30 bg-emerald-500/10 rounded-sm text-emerald-200 text-xs flex items-center">
            <CheckCircle2 className="size-4 text-emerald-400 mr-2 shrink-0" />
            {success}
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="py-12 text-center text-xs text-[var(--color-text-secondary)] uppercase tracking-wider animate-pulse">
            Loading Revenue Share console...
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="w-full min-w-0"
            >
              {/* AGENT SUMMARY TAB */}
              {activeTab === 'summary' && (
                <div className="space-y-6 w-full min-w-0">
                  {/* Top Aggregate Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 rounded-sm flex flex-col justify-between">
                      <span className="text-[10px] uppercase text-[var(--color-text-secondary)] font-bold tracking-wider">
                        Total Company Rev Share Earned
                      </span>
                      <span className="text-2xl font-bold text-[var(--color-text)] mt-2">
                        {formatMoney(summaries.reduce((acc, s) => acc + s.total_earned, 0))}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                        All overrides & cap completion bonuses
                      </span>
                    </div>

                    <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 rounded-sm flex flex-col justify-between">
                      <span className="text-[10px] uppercase text-[var(--color-text-secondary)] font-bold tracking-wider">
                        Total Disbursed / Credited
                      </span>
                      <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                        {formatMoney(summaries.reduce((acc, s) => acc + s.total_paid, 0))}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                        Cash payments & cap credits marked paid
                      </span>
                    </div>

                    <div className="border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 p-5 rounded-sm flex flex-col justify-between">
                      <span className="text-[10px] uppercase text-[var(--color-gold)] font-bold tracking-wider">
                        Total Remaining Owed
                      </span>
                      <span className="text-2xl font-bold text-[var(--color-gold)] mt-2">
                        {formatMoney(summaries.reduce((acc, s) => acc + s.remaining_owed, 0))}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                        Outstanding balance across all agents
                      </span>
                    </div>
                  </div>

                  {/* Summary Table */}
                  <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-sm overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs uppercase tracking-widest text-[var(--color-gold)] font-bold">
                          Agent Balance Summary
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          Plain-language running balance of all revenue share overrides and completion bonuses. Sorted by remaining owed.
                        </p>
                      </div>
                      <span className="text-xs text-[var(--color-text-secondary)] font-medium shrink-0">
                        {summaries.length} {summaries.length === 1 ? 'agent' : 'agents'} with earnings
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[var(--color-surface-3)] text-[var(--color-gold)] uppercase tracking-wider font-semibold border-b border-[var(--color-border)]">
                          <tr>
                            <th className="px-6 py-4">Agent</th>
                            <th className="px-6 py-4">Total Earned</th>
                            <th className="px-6 py-4">Total Paid</th>
                            <th className="px-6 py-4 text-[var(--color-gold)]">Remaining Owed</th>
                            <th className="px-6 py-4 text-right">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface-2)]">
                          {summaries.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-[var(--color-text-secondary)] italic">
                                No revenue share earnings or bonuses recorded yet.
                              </td>
                            </tr>
                          ) : (
                            summaries.map(s => (
                              <tr key={s.user_id} className="hover:bg-[var(--color-surface-3)]/50 transition-colors">
                                <td className="px-6 py-4">
                                  <span className="font-semibold text-[var(--color-text)] block">{s.name}</span>
                                  <span className="text-[10px] text-[var(--color-text-secondary)]">{s.email}</span>
                                </td>
                                <td className="px-6 py-4 font-medium text-[var(--color-text)]">
                                  {formatMoney(s.total_earned)}
                                </td>
                                <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-medium">
                                  {formatMoney(s.total_paid)}
                                </td>
                                <td className="px-6 py-4 font-bold text-[var(--color-gold)] text-sm">
                                  {formatMoney(s.remaining_owed)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  {s.remaining_owed > 0 ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={() => setActiveTab('ledger')}
                                      className="text-[11px] text-[var(--color-gold)] hover:text-[var(--color-gold)]/80 hover:bg-[var(--color-gold)]/10 font-semibold px-2.5 py-1 h-auto"
                                    >
                                      View in Ledger &rarr;
                                    </Button>
                                  ) : (
                                    <span className="inline-flex items-center text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                      Fully Paid
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* LEDGER TAB */}
              {activeTab === 'ledger' && (
                <div className="space-y-6 w-full min-w-0">
                  {/* Period Configuration */}
                  <div className="bg-[var(--color-surface-2)] p-4 sm:p-6 border border-[var(--color-border)] rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs uppercase tracking-widest text-[var(--color-gold)] font-bold">Payment Configuration</h4>
                      <p className="text-xs text-[var(--color-text-secondary)]">Specify the payout period for suggested ledger.</p>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-1 w-full md:w-auto">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        <label htmlFor="period-label" className="text-xs uppercase text-[var(--color-text-secondary)] font-semibold shrink-0">Period Label:</label>
                        <Input
                          id="period-label"
                          className="w-full sm:w-48 bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs"
                          value={periodLabel}
                          onChange={e => {
                            setPeriodLabel(e.target.value)
                            if (periodLabelError) setPeriodLabelError(null)
                          }}
                          placeholder="e.g. Q3 2026"
                        />
                      </div>
                      {periodLabelError && (
                        <p className="text-[11px] text-red-400">{periodLabelError}</p>
                      )}
                    </div>
                  </div>

                  {/* Ledger Table */}
                  <div className="w-full max-w-full border border-[var(--color-border)] rounded-sm overflow-hidden">
                    <div className="w-full overflow-x-auto">
                      <table className="w-full min-w-[700px] text-left text-xs">
                      <thead className="bg-[var(--color-surface-3)] text-[var(--color-gold)] uppercase tracking-wider font-semibold border-b border-[var(--color-border)]">
                        <tr>
                          <th className="px-6 py-4">Agent</th>
                          <th className="px-6 py-4">Unpaid Total</th>
                          <th className="px-6 py-4">Suggest Credit (Cap)</th>
                          <th className="px-6 py-4">Suggest Cash</th>
                          <th className="px-6 py-4">Note / Reason</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface-2)]">
                        {ledger.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-[var(--color-text-secondary)] italic">
                              No suggested payments found. All earnings and bonuses are fully paid.
                            </td>
                          </tr>
                        ) : (
                          ledger.map(payment => (
                            <tr key={payment.recipient_id} className="hover:bg-[var(--color-surface-3)]/50">
                              <td className="px-6 py-4">
                                <span className="font-semibold text-[var(--color-text)] block">{payment.recipient_name}</span>
                                <span className="text-[10px] text-[var(--color-text-secondary)]">{payment.recipient_email}</span>
                              </td>
                              <td className="px-6 py-4 font-bold text-[var(--color-text)]">
                                {formatCurrency(payment.unpaid_total)}
                              </td>
                              <td className="px-6 py-4 text-emerald-700 dark:text-emerald-400 font-semibold">
                                {formatCurrency(payment.credit_suggested)}
                                <span className="block text-[9px] text-[var(--color-text-secondary)] mt-0.5">
                                  Remaining room: {formatCurrency(payment.remaining_cap_room)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-[var(--color-gold)] font-medium">
                                {formatCurrency(payment.cash_suggested)}
                              </td>
                              <td className="px-6 py-4">
                                <Input
                                  aria-label={`Payment note for ${payment.recipient_name}`}
                                  className="w-48 bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-8"
                                  value={notesByRecipient[payment.recipient_id] || ''}
                                  onChange={e => setNotesByRecipient(prev => ({ ...prev, [payment.recipient_id]: e.target.value }))}
                                  placeholder="Add payout details..."
                                />
                              </td>
                              <td className="px-6 py-4 text-right">
                                <Button
                                  type="button"
                                  onClick={() => handleMarkPaid(payment)}
                                  disabled={payingState[payment.recipient_id]}
                                  className="bg-[var(--color-gold)] text-black font-semibold text-[10px] uppercase px-3 py-1 rounded-none hover:bg-[var(--color-gold)]/90 h-8 focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
                                >
                                  {payingState[payment.recipient_id] ? 'Syncing...' : 'Mark Paid'}
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}

              {/* OVERRIDES TAB */}
              {activeTab === 'overrides' && FEATURE_SPONSOR_TREE && (
                <div className="space-y-6 w-full min-w-0">
                  <div className="w-full max-w-full border border-[var(--color-border)] rounded-sm overflow-hidden">
                    <div className="w-full overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="bg-[var(--color-surface-3)] text-[var(--color-gold)] uppercase tracking-wider font-semibold border-b border-[var(--color-border)]">
                        <tr>
                          <th className="px-6 py-4">Agent</th>
                          <th className="px-6 py-4">Cap Override</th>
                          <th className="px-6 py-4">Eligibility Override</th>
                          <th className="px-6 py-4">Cash Override</th>
                          <th className="px-6 py-4">Sponsor Override</th>
                          <th className="px-6 py-4">Notes</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface-2)]">
                        {overrides.map(agent => (
                          <tr key={agent.user_id} className="hover:bg-[var(--color-surface-3)]/50">
                            <td className="px-6 py-4">
                              <span className="font-semibold text-[var(--color-text)] block">{agent.full_name}</span>
                              <span className="text-[10px] text-[var(--color-text-secondary)]">{agent.email}</span>
                            </td>
                            <td className="px-6 py-4">
                              {editingOverrideId === agent.user_id ? (
                                <Input
                                  aria-label="Cap Override"
                                  className="w-24 bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-8"
                                  value={editCap}
                                  onChange={e => setEditCap(e.target.value)}
                                  placeholder={agent.cap_amount ? String(agent.cap_amount) : 'None'}
                                />
                              ) : (
                                <span className="text-[var(--color-text)] font-medium">
                                  {agent.cap_override !== null ? formatCurrency(agent.cap_override) : 'Default'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {editingOverrideId === agent.user_id ? (
                                <select
                                  aria-label="Eligibility Override"
                                  className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-8 px-2 focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
                                  value={editElig}
                                  onChange={e => setEditElig(e.target.value as any)}
                                >
                                  <option value="default">Default Rules</option>
                                  <option value="force_true">Force Eligible</option>
                                  <option value="force_false">Force Ineligible</option>
                                </select>
                              ) : (
                                <span className={agent.eligibility_override !== null ? (agent.eligibility_override ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-red-700 dark:text-red-400 font-medium') : 'text-[var(--color-text-secondary)]'}>
                                  {agent.eligibility_override !== null ? (agent.eligibility_override ? 'Force Eligible' : 'Force Ineligible') : 'Computed Rules'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {editingOverrideId === agent.user_id ? (
                                <input
                                  aria-label="Cash Override"
                                  type="checkbox"
                                  className="size-4 rounded-sm border-[var(--color-border)] bg-[var(--color-surface-3)] text-[var(--color-gold)] accent-[var(--color-gold)] focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
                                  checked={editCash}
                                  onChange={e => setEditCash(e.target.checked)}
                                />
                              ) : (
                                <span className={agent.cash_override ? 'text-[var(--color-gold)] font-semibold' : 'text-[var(--color-text-secondary)]'}>
                                  {agent.cash_override ? 'Force Cash' : 'Default'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {editingOverrideId === agent.user_id ? (
                                <select
                                  aria-label="Sponsor Override"
                                  className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-8 px-2 max-w-[150px] focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
                                  value={editSponsor}
                                  onChange={e => setEditSponsor(e.target.value)}
                                >
                                  <option value="">No Override</option>
                                  {overrides
                                    .filter(x => x.user_id !== agent.user_id)
                                    .map(x => (
                                      <option key={x.user_id} value={x.user_id}>{x.full_name}</option>
                                    ))}
                                </select>
                              ) : (
                                <span className="text-[var(--color-text)]">
                                  {agent.sponsor_override ? overrides.find(x => x.user_id === agent.sponsor_override)?.full_name || 'Overridden' : 'Resolved Default'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {editingOverrideId === agent.user_id ? (
                                <Input
                                  aria-label="Notes"
                                  className="w-32 bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-8"
                                  value={editNotes}
                                  onChange={e => setEditNotes(e.target.value)}
                                  placeholder="Add note..."
                                />
                              ) : (
                                <span className="text-[var(--color-text-secondary)] max-w-[100px] truncate block">
                                  {agent.notes || '—'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {editingOverrideId === agent.user_id ? (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    onClick={() => handleSaveOverride(agent.user_id)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] uppercase px-2.5 py-1 rounded-none h-8 focus:outline focus:outline-2 focus:outline-emerald-500"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => setEditingOverrideId(null)}
                                    className="border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-surface-3)] text-[var(--color-text)] font-semibold text-[10px] uppercase px-2.5 py-1 rounded-none h-8"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setEditingOverrideId(agent.user_id)
                                    setEditCap(agent.cap_override ? String(agent.cap_override) : '')
                                    setEditElig(agent.eligibility_override === null ? 'default' : agent.eligibility_override ? 'force_true' : 'force_false')
                                    setEditCash(agent.cash_override)
                                    setEditSponsor(agent.sponsor_override || '')
                                    setEditNotes(agent.notes || '')
                                  }}
                                  className="bg-transparent text-[var(--color-gold)] font-semibold text-[10px] uppercase border border-[var(--color-gold)]/40 hover:bg-[var(--color-gold)]/10 px-2.5 py-1 rounded-none h-8 focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
                                >
                                  Edit
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}

              {/* RESOLUTION TAB */}
              {activeTab === 'resolution' && FEATURE_SPONSOR_TREE && (
                <div className="space-y-6 w-full min-w-0">
                  <div className="w-full max-w-full border border-[var(--color-border)] rounded-sm overflow-hidden">
                    <div className="w-full overflow-x-auto">
                      <table className="w-full min-w-[700px] text-left text-xs">
                      <thead className="bg-[var(--color-surface-3)] text-[var(--color-gold)] uppercase tracking-wider font-semibold border-b border-[var(--color-border)]">
                        <tr>
                          <th className="px-6 py-4">Agent Name</th>
                          <th className="px-6 py-4">Sponsor Text Synced</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Assign Correct Sponsor</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface-2)]">
                        {logs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-[var(--color-text-secondary)] italic">
                              No unresolved sponsor resolution logs found! Everything is cleanly resolved.
                            </td>
                          </tr>
                        ) : (
                          logs.map(log => (
                            <tr key={log.id} className="hover:bg-[var(--color-surface-3)]/50">
                              <td className="px-6 py-4">
                                <span className="font-semibold text-[var(--color-text)] block">{log.users.full_name}</span>
                                <span className="text-[10px] text-[var(--color-text-secondary)]">{log.users.email}</span>
                              </td>
                              <td className="px-6 py-4 font-mono font-semibold text-red-600 dark:text-red-400">
                                "{log.raw_sponsor_text}"
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-wider font-bold border ${
                                  log.resolution_status === 'ambiguous'
                                    ? 'bg-amber-500/10 text-amber-800 border-amber-600/25 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-500/25'
                                    : 'bg-red-500/10 text-red-800 border-red-600/25 dark:bg-red-950/40 dark:text-red-400 dark:border-red-500/25'
                                }`}>
                                  {log.resolution_status}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-1">
                                  <select
                                    aria-label="Assign Sponsor"
                                    className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-8 px-2 max-w-[200px] focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
                                    value={selectedSponsors[log.user_id] || ''}
                                    onChange={e => {
                                      setSelectedSponsors(prev => ({ ...prev, [log.user_id]: e.target.value }))
                                      setSponsorErrors(prev => {
                                        const next = { ...prev }
                                        delete next[log.user_id]
                                        return next
                                      })
                                    }}
                                  >
                                    <option value="">Select Real Agent...</option>
                                    {overrides
                                      .filter(x => x.user_id !== log.user_id)
                                      .map(x => (
                                       <option key={x.user_id} value={x.user_id}>{x.full_name}</option>
                                      ))}
                                  </select>
                                  {sponsorErrors[log.user_id] && (
                                    <p className="text-[11px] text-red-400">{sponsorErrors[log.user_id]}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <Button
                                  type="button"
                                  onClick={() => handleResolveSponsor(log.user_id)}
                                  className="bg-[var(--color-gold)] text-black font-semibold text-[10px] uppercase px-3 py-1 rounded-none hover:bg-[var(--color-gold)]/90 h-8 focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
                                >
                                  Resolve
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SETTINGS TAB */}
              {activeTab === 'settings' && settings && (
                <div className="bg-[var(--color-surface-2)] p-6 border border-[var(--color-border)] rounded-sm space-y-6">
                  <h4 className="text-xs uppercase tracking-widest text-[var(--color-gold)] font-bold border-b border-[var(--color-border)] pb-3">Global Configuration</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* General params */}
                    <div className="space-y-4">
                      <h5 className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wider">Eligibility Parameters</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label htmlFor="settings-min-cap" className="text-[10px] text-[var(--color-text-secondary)] uppercase font-semibold">Min Cap Amount</label>
                          <Input
                            id="settings-min-cap"
                            type="number"
                            className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-9"
                            value={settings.min_cap_amount}
                            onChange={e => setSettings(prev => prev ? ({ ...prev, min_cap_amount: parseFloat(e.target.value) }) : null)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="settings-grace" className="text-[10px] text-[var(--color-text-secondary)] uppercase font-semibold">Grace Period (Months)</label>
                          <Input
                            id="settings-grace"
                            type="number"
                            className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-9"
                            value={settings.grace_period_months}
                            onChange={e => setSettings(prev => prev ? ({ ...prev, grace_period_months: parseInt(e.target.value) }) : null)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="settings-prod-min" className="text-[10px] text-[var(--color-text-secondary)] uppercase font-semibold">Min Production Txns</label>
                          <Input
                            id="settings-prod-min"
                            type="number"
                            className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-9"
                            value={settings.production_min_transactions}
                            onChange={e => setSettings(prev => prev ? ({ ...prev, production_min_transactions: parseInt(e.target.value) }) : null)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="settings-prod-window" className="text-[10px] text-[var(--color-text-secondary)] uppercase font-semibold">Production Window (Months)</label>
                          <Input
                            id="settings-prod-window"
                            type="number"
                            className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-9"
                            value={settings.production_window_months}
                            onChange={e => setSettings(prev => prev ? ({ ...prev, production_window_months: parseInt(e.target.value) }) : null)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Rates */}
                    <div className="space-y-4">
                      <h5 className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wider">Generation Split Rates</h5>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map(g => (
                          <div key={g} className="space-y-1">
                            <label htmlFor={`settings-gen${g}-rate`} className="text-[10px] text-[var(--color-text-secondary)] uppercase font-semibold block text-center">Gen {g}</label>
                            <Input
                              id={`settings-gen${g}-rate`}
                              type="number"
                              step="0.0001"
                              className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-9 text-center"
                              value={settings[`gen${g}_rate` as keyof GlobalSettings]}
                              onChange={e => setSettings(prev => prev ? ({ ...prev, [`gen${g}_rate`]: parseFloat(e.target.value) }) : null)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Max payouts */}
                    <div className="space-y-4 md:col-span-2">
                      <h5 className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wider border-t border-[var(--color-border)] pt-4">Generation Caps & Bonuses</h5>
                      <div className="grid grid-cols-5 gap-4">
                        {[1, 2, 3, 4, 5].map(g => (
                          <div key={g} className="space-y-3">
                            <h6 className="text-[10px] text-[var(--color-gold)] font-bold uppercase text-center">Gen {g} Metrics</h6>
                            <div className="space-y-1">
                              <label htmlFor={`settings-gen${g}-max`} className="text-[9px] text-[var(--color-text-secondary)] uppercase font-semibold block text-center">Max Payout</label>
                              <Input
                                id={`settings-gen${g}-max`}
                                type="number"
                                className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-9 text-center"
                                value={settings[`gen${g}_max_payout` as keyof GlobalSettings]}
                                onChange={e => setSettings(prev => prev ? ({ ...prev, [`gen${g}_max_payout`]: parseFloat(e.target.value) }) : null)}
                              />
                            </div>
                            <div className="space-y-1">
                              <label htmlFor={`settings-gen${g}-bonus`} className="text-[9px] text-[var(--color-text-secondary)] uppercase font-semibold block text-center">Bonus Amt</label>
                              <Input
                                id={`settings-gen${g}-bonus`}
                                type="number"
                                className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-9 text-center"
                                value={settings[`gen${g}_completion_bonus` as keyof GlobalSettings]}
                                onChange={e => setSettings(prev => prev ? ({ ...prev, [`gen${g}_completion_bonus`]: parseFloat(e.target.value) }) : null)}
                              />
                            </div>
                            {g >= 2 && (
                              <div className="space-y-1">
                                <label htmlFor={`settings-gen${g}-unlock`} className="text-[9px] text-[var(--color-text-secondary)] uppercase font-semibold block text-center">Unlock Count</label>
                                <Input
                                  id={`settings-gen${g}-unlock`}
                                  type="number"
                                  className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] text-xs h-9 text-center"
                                  value={settings[`gen${g}_unlock_count` as keyof GlobalSettings]}
                                  onChange={e => setSettings(prev => prev ? ({ ...prev, [`gen${g}_unlock_count`]: parseInt(e.target.value) }) : null)}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[var(--color-border)] text-right">
                    <Button
                      type="button"
                      onClick={handleSaveSettings}
                      className="bg-[var(--color-gold)] text-black font-semibold text-xs uppercase px-5 py-2.5 rounded-none hover:bg-[var(--color-gold)]/90 focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
                    >
                      Save Configuration
                    </Button>
                  </div>
                </div>
              )}

              {/* CALCULATION RUN TAB */}
              {activeTab === 'calc' && (
                <div className="bg-[var(--color-surface-2)] p-6 border border-[var(--color-border)] rounded-sm space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-xs uppercase tracking-widest text-[var(--color-gold)] font-bold">Calculation Reprocess Panel</h4>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-xl">
                      Re-run calculations for all eligible transactions closed on or after the July 1, 2026 launch date. 
                      This job is fully idempotent; it will update existing splits and add new splits without creating duplicates.
                    </p>
                  </div>
                  
                  <div className="pt-4">
                    <Button
                      type="button"
                      onClick={handleReprocess}
                      disabled={isRunningCalcs}
                      className="bg-[var(--color-gold)] text-black font-semibold text-xs uppercase px-6 py-3 rounded-none hover:bg-[var(--color-gold)]/90 flex items-center gap-2 focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
                    >
                      <RefreshCw className={`size-4 ${isRunningCalcs ? 'animate-spin' : ''}`} />
                      {isRunningCalcs ? 'Running Job...' : 'Trigger Manual Reprocess'}
                    </Button>
                  </div>
                </div>
              )}

              {/* HOW THIS WORKS / NOTES TAB */}
              {activeTab === 'how_it_works' && (
                <div className="space-y-6 w-full min-w-0">
                  {/* Hero Intro Card */}
                  <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] p-6 rounded-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-[var(--color-gold)]/10 text-[var(--color-gold)] rounded-sm shrink-0 mt-0.5">
                        <HelpCircle className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs uppercase tracking-widest text-[var(--color-gold)] font-bold">
                          Revenue Share Quick-Start & Admin Guide
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-3xl">
                          A plain-language guide for administrators explaining how LocalPRO Realty's sponsor bonus program works, how earnings are calculated, and how to record payments in this console.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: What is Revenue Share vs Commission Payouts */}
                  <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-sm overflow-hidden">
                    <div className="p-5 border-b border-[var(--color-border)] bg-[var(--color-surface-3)]">
                      <h5 className="text-xs uppercase tracking-wider text-[var(--color-gold)] font-bold flex items-center gap-2">
                        <Building2 className="size-4" />
                        1. What Revenue Share Is (and How It Differs from Regular Commissions)
                      </h5>
                    </div>
                    <div className="p-6 space-y-4 text-xs leading-relaxed text-[var(--color-text)]">
                      <p>
                        Revenue Share is LocalPRO Realty’s <strong>recruiting and sponsor-tree bonus system</strong>. When an agent sponsors (recruits) another agent to join LocalPRO, they earn bonuses whenever that recruit—and any agents that recruit sponsors down to 5 generations—closes a transaction.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 rounded-sm space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] block">
                            /admin/revenue • Commission Payouts
                          </span>
                          <p className="text-[var(--color-text-secondary)]">
                            Tracks <strong>direct transaction commissions</strong> for an agent’s personal sales. When an agent closes a deal, this console tracks their personal commission split (e.g. 80/20 or 85/15), their annual cap progress ($16,000), and their net commission paycheck.
                          </p>
                        </div>
                        <div className="border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5 p-4 rounded-sm space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-gold)] block">
                            /admin/revenue-share • Sponsor Bonus Console (This Page)
                          </span>
                          <p className="text-[var(--color-text-secondary)]">
                            Tracks <strong>passive sponsor tree bonuses</strong>. When an agent’s recruited downlines close deals, this console computes the bonus owed to the sponsor. <em>This bonus is funded entirely out of LocalPRO’s retained company split—it never reduces the producing agent’s paycheck.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: How the Numbers are Calculated */}
                  <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-sm overflow-hidden">
                    <div className="p-5 border-b border-[var(--color-border)] bg-[var(--color-surface-3)]">
                      <h5 className="text-xs uppercase tracking-wider text-[var(--color-gold)] font-bold flex items-center gap-2">
                        <Layers className="size-4" />
                        2. How the Numbers Are Calculated
                      </h5>
                    </div>
                    <div className="p-6 space-y-5 text-xs leading-relaxed text-[var(--color-text)]">
                      <p>
                        For every closed deal, LocalPRO receives a company split (the brokerage fee, typically 15% or 20% of gross commission). Revenue share pays sponsors a flat percentage of that company split, plus a separate completion bonus when the downline hits their cap:
                      </p>

                      {/* Rates & Bonuses Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                        {[
                          { gen: 'Gen 1', title: 'Direct Sponsor', rate: '13.75%', bonus: '$1,000', max: '$3,200', req: 'Direct recruit' },
                          { gen: 'Gen 2', title: 'Tier 2 Sponsor', rate: '5.31%', bonus: '$750', max: '$1,600', req: '3 active recruits' },
                          { gen: 'Gen 3', title: 'Tier 3 Sponsor', rate: '1.875%', bonus: '$500', max: '$800', req: '7 active recruits' },
                          { gen: 'Gen 4', title: 'Tier 4 Sponsor', rate: '1.565%', bonus: '$750', max: '$1,000', req: '12 active recruits' },
                          { gen: 'Gen 5', title: 'Tier 5 Sponsor', rate: '2.50%', bonus: '$1,000', max: '$1,400', req: '20 active recruits' },
                        ].map(tier => (
                          <div key={tier.gen} className="border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3.5 rounded-sm space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-[var(--color-gold)] uppercase">{tier.gen}</span>
                              <span className="text-[9px] text-[var(--color-text-secondary)] uppercase">{tier.req}</span>
                            </div>
                            <div className="space-y-1 pt-1 border-t border-[var(--color-border)]">
                              <div className="flex justify-between items-baseline">
                                <span className="text-[10px] text-[var(--color-text-secondary)]">Split Rate:</span>
                                <span className="font-semibold text-[var(--color-text)]">{tier.rate}</span>
                              </div>
                              <div className="flex justify-between items-baseline">
                                <span className="text-[10px] text-[var(--color-text-secondary)]">Cap Bonus:</span>
                                <span className="font-semibold text-emerald-500 dark:text-emerald-400">{tier.bonus}</span>
                              </div>
                              <div className="flex justify-between items-baseline pt-1 border-t border-[var(--color-border)]/50">
                                <span className="text-[9px] text-[var(--color-text-secondary)] uppercase">Max Cap/Yr:</span>
                                <span className="text-[10px] font-bold text-[var(--color-gold)]">{tier.max}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Personal Cap Cycle Note */}
                      <div className="border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 p-4 rounded-sm flex items-start gap-3">
                        <Calendar className="size-4 text-[var(--color-gold)] shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-[var(--color-gold)] uppercase tracking-wider block">
                            Personal 12-Month Cap Cycles (No Calendar Quarters)
                          </span>
                          <p className="text-[var(--color-text-secondary)] leading-relaxed">
                            Each agent has their own personal 12-month cap year starting on their <strong>join/anniversary date</strong>. Cap cycles do <em>not</em> reset on January 1st or quarterly calendar dates. Once a downline agent pays their full $16,000 annual cap within their personal 12-month window, their sponsor earns the one-time completion bonus, and company split overrides pause until that downline agent's next anniversary year begins.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Period Label Explanation */}
                  <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-sm overflow-hidden">
                    <div className="p-5 border-b border-[var(--color-border)] bg-[var(--color-surface-3)]">
                      <h5 className="text-xs uppercase tracking-wider text-[var(--color-gold)] font-bold flex items-center gap-2">
                        <FileText className="size-4" />
                        3. What the "Period Label" Field Does
                      </h5>
                    </div>
                    <div className="p-6 space-y-3 text-xs leading-relaxed text-[var(--color-text)]">
                      <p>
                        On the <strong>Payout Suggested Ledger</strong> tab, you will see an input field labeled <strong>Period Label</strong> (e.g. "Q3 2026", "September 2026", or "Batch 14").
                      </p>
                      <div className="space-y-2 pt-1">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <p>
                            <strong>It is strictly a memo / record-keeping tag:</strong> Typing in this field does <strong>NOT</strong> filter, restrict, or hide any transactions on the page.
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <p>
                            <strong>The "Unpaid Total" is always the live running balance:</strong> Regardless of what text is in the Period Label box, the ledger always calculates the true, all-time balance of all unpaid earnings and bonuses owed to that agent.
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <p>
                            <strong>Attached upon payment:</strong> When you click <strong>Mark Paid</strong>, the current text in the Period Label is permanently stamped onto that payout record, so you can easily reference which cycle or month the payment was processed for in audit logs.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Where the Money Lives & BrokerMint's Role */}
                  <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-sm overflow-hidden">
                    <div className="p-5 border-b border-[var(--color-border)] bg-[var(--color-surface-3)]">
                      <h5 className="text-xs uppercase tracking-wider text-[var(--color-gold)] font-bold flex items-center gap-2">
                        <Info className="size-4" />
                        4. Where the Money Lives & BrokerMint's Role
                      </h5>
                    </div>
                    <div className="p-6 space-y-4 text-xs leading-relaxed text-[var(--color-text)]">
                      <p>
                        Understanding where data lives is essential for seamless accounting between LocalPRO Hub and BrokerMint:
                      </p>
                      <div className="space-y-3">
                        <div className="border-l-2 border-[var(--color-gold)] pl-3 space-y-1">
                          <strong className="text-[var(--color-gold)] block">LocalPRO Hub is the Single Source of Truth</strong>
                          <p className="text-[var(--color-text-secondary)]">
                            LocalPRO Hub computes all sponsor hierarchies, rates, cap bonuses, and running balances. The numbers you see on this console represent the true accounting balance of who is owed what.
                          </p>
                        </div>

                        <div className="border-l-2 border-amber-500/80 pl-3 space-y-1">
                          <strong className="text-amber-400 block">BrokerMint Profile Fields Are Informational Reference Notes Only</strong>
                          <p className="text-[var(--color-text-secondary)]">
                            When payments are marked in LocalPRO Hub, the system updates two custom fields on each agent's BrokerMint profile: <code className="text-[11px] bg-[var(--color-surface-3)] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)]">RS Credit Toward Cap</code> and <code className="text-[11px] bg-[var(--color-surface-3)] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)]">RS Cash Owed</code>. These are purely informational notes so admins looking at an agent in BrokerMint can see their current status.
                          </p>
                        </div>

                        <div className="border-l-2 border-red-500/80 pl-3 space-y-1">
                          <strong className="text-red-400 block">BrokerMint Does NOT Auto-Deduct Cap Credits on Real Deals</strong>
                          <p className="text-[var(--color-text-secondary)]">
                            BrokerMint's commission calculation engine does not read or apply custom fields automatically. If an agent has a revenue share cap credit (e.g. $500) and closes a transaction where that credit should offset their company split, an administrator must <strong>manually adjust the brokerage split on that specific transaction inside BrokerMint</strong>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 5: How to Use the Tabs Day-to-Day */}
                  <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-sm overflow-hidden">
                    <div className="p-5 border-b border-[var(--color-border)] bg-[var(--color-surface-3)]">
                      <h5 className="text-xs uppercase tracking-wider text-[var(--color-gold)] font-bold flex items-center gap-2">
                        <Users className="size-4" />
                        5. How to Use This Console Day-to-Day
                      </h5>
                    </div>
                    <div className="p-6 space-y-5 text-xs leading-relaxed text-[var(--color-text)]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 rounded-sm flex flex-col justify-between space-y-3">
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-[var(--color-gold)] uppercase tracking-wider block">
                              Agent Summary Tab
                            </span>
                            <p className="text-[var(--color-text-secondary)]">
                              The fastest way to answer: <em>"Who does the brokerage owe right now, and how much?"</em> Shows all-time Total Earned, Total Paid, and current Remaining Owed for every agent in one clean view.
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={() => setActiveTab('summary')}
                            className="bg-[var(--color-surface-3)] hover:bg-[var(--color-gold)]/20 text-[var(--color-gold)] border border-[var(--color-gold)]/40 font-semibold text-xs uppercase px-4 py-2 rounded-sm self-start flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            Go to Agent Summary
                            <ArrowRight className="size-3.5" />
                          </Button>
                        </div>

                        <div className="border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 rounded-sm flex flex-col justify-between space-y-3">
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-[var(--color-gold)] uppercase tracking-wider block">
                              Payout Suggested Ledger Tab
                            </span>
                            <p className="text-[var(--color-text-secondary)]">
                              The operational workspace for disbursing funds. It automatically splits balances into <strong>Suggest Credit</strong> (if the recipient has remaining cap room) vs. <strong>Suggest Cash</strong> (if they have already capped), and lets you record payouts with one click.
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={() => setActiveTab('ledger')}
                            className="bg-[var(--color-surface-3)] hover:bg-[var(--color-gold)]/20 text-[var(--color-gold)] border border-[var(--color-gold)]/40 font-semibold text-xs uppercase px-4 py-2 rounded-sm self-start flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            Go to Suggested Ledger
                            <ArrowRight className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </AdminShell>
  )
}

export default function RevenueSharePage() {
  return (
    <ErrorBoundary title="Revenue Share Settings">
      <RevenueShareContent />
    </ErrorBoundary>
  )
}
