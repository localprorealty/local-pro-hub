import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  UserCheck,
  Settings,
  RefreshCw,
  Edit,
  CheckCircle2,
} from 'lucide-react'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

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

type ActiveTab = 'ledger' | 'overrides' | 'resolution' | 'settings' | 'calc'

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val)
}

function RevenueShareContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('ledger')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 1. Ledger State
  const [ledger, setLedger] = useState<SuggestedPayment[]>([])
  const [periodLabel, setPeriodLabel] = useState('')
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

  // 4. Settings State
  const [settings, setSettings] = useState<GlobalSettings | null>(null)

  // Trigger Calculations
  const [isRunningCalcs, setIsRunningCalcs] = useState(false)

  // Fetch functions
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
      await Promise.all([fetchLedger(), fetchOverrides(), fetchLogs(), fetchSettings()])
      
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
      alert('Please specify a period label (e.g. Q3 2026) first.')
      return
    }
    
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
      // Refresh ledger & overrides
      await Promise.all([fetchLedger(), fetchOverrides()])
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

  // 3. Resolve Sponsor
  const handleResolveSponsor = async (user_id: string) => {
    const selectedSponsorId = selectedSponsors[user_id]
    if (!selectedSponsorId) {
      alert('Please select a sponsor from the list.')
      return
    }
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
      setSuccess('Sponsor resolution successfully resolved.')
      await Promise.all([fetchLogs(), fetchOverrides()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve sponsor.')
    }
  }

  // 4. Save settings
  const handleSaveSettings = async () => {
    if (!settings) return
    setError(null)
    setSuccess(null)
    try {
      await api('/revenue-share/settings', {
        method: 'POST',
        body: settings
      })
      setSuccess('Global revenue share settings updated successfully.')
      await fetchSettings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings.')
    }
  }

  // 5. Reprocess Calcs
  const handleReprocess = async () => {
    setIsRunningCalcs(true)
    setError(null)
    setSuccess(null)
    try {
      await api('/revenue-share/reprocess', { method: 'POST' })
      setSuccess('Revenue share earnings calculations successfully executed.')
      await fetchLedger()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reprocess calculations.')
    } finally {
      setIsRunningCalcs(false)
    }
  }

  return (
    <AdminShell title="Revenue Share Console">
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
          {(
            [
              { key: 'ledger', label: 'Payout Suggested Ledger', icon: <DollarSign className="size-4 mr-2" /> },
              { key: 'overrides', label: 'Agent Overrides', icon: <Edit className="size-4 mr-2" /> },
              { key: 'resolution', label: 'Sponsor Resolution', icon: <UserCheck className="size-4 mr-2" /> },
              { key: 'settings', label: 'Global Settings', icon: <Settings className="size-4 mr-2" /> },
              { key: 'calc', label: 'Calculations Run', icon: <RefreshCw className="size-4 mr-2" /> },
            ] as const
          ).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key)
                setError(null)
                setSuccess(null)
              }}
              className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors flex items-center relative ${
                activeTab === tab.key
                  ? 'text-[var(--color-gold)]'
                  : 'text-[var(--color-text-secondary)] hover:text-white'
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
            >
              {/* LEDGER TAB */}
              {activeTab === 'ledger' && (
                <div className="space-y-6">
                  {/* Period Configuration */}
                  <div className="bg-[var(--color-surface-2)] p-6 border border-[var(--color-border)] rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs uppercase tracking-widest text-[var(--color-gold)] font-bold">Payment Configuration</h4>
                      <p className="text-xs text-[var(--color-text-secondary)]">Specify the payout period for suggested ledger.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label htmlFor="period-label" className="text-xs uppercase text-gray-300 font-semibold">Period Label:</label>
                      <Input
                        id="period-label"
                        className="w-48 bg-black border-[var(--color-border)] text-white text-xs"
                        value={periodLabel}
                        onChange={e => setPeriodLabel(e.target.value)}
                        placeholder="e.g. Q3 2026"
                      />
                    </div>
                  </div>

                  {/* Ledger Table */}
                  <div className="border border-[var(--color-border)] rounded-sm overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/60 text-[var(--color-gold)] uppercase tracking-wider font-semibold border-b border-[var(--color-border)]">
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
                            <tr key={payment.recipient_id} className="hover:bg-black/20">
                              <td className="px-6 py-4">
                                <span className="font-semibold text-white block">{payment.recipient_name}</span>
                                <span className="text-[10px] text-[var(--color-text-secondary)]">{payment.recipient_email}</span>
                              </td>
                              <td className="px-6 py-4 font-bold text-white">
                                {formatCurrency(payment.unpaid_total)}
                              </td>
                              <td className="px-6 py-4 text-emerald-400">
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
                                  className="w-48 bg-black/40 border-[var(--color-border)] text-white text-xs h-8"
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
              )}

              {/* OVERRIDES TAB */}
              {activeTab === 'overrides' && (
                <div className="space-y-6">
                  <div className="border border-[var(--color-border)] rounded-sm overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/60 text-[var(--color-gold)] uppercase tracking-wider font-semibold border-b border-[var(--color-border)]">
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
                          <tr key={agent.user_id} className="hover:bg-black/20">
                            <td className="px-6 py-4">
                              <span className="font-semibold text-white block">{agent.full_name}</span>
                              <span className="text-[10px] text-[var(--color-text-secondary)]">{agent.email}</span>
                            </td>
                            <td className="px-6 py-4">
                              {editingOverrideId === agent.user_id ? (
                                <Input
                                  aria-label="Cap Override"
                                  className="w-24 bg-black border-[var(--color-border)] text-white text-xs h-8"
                                  value={editCap}
                                  onChange={e => setEditCap(e.target.value)}
                                  placeholder={agent.cap_amount ? String(agent.cap_amount) : 'None'}
                                />
                              ) : (
                                <span className="text-white font-medium">
                                  {agent.cap_override !== null ? formatCurrency(agent.cap_override) : 'Default'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {editingOverrideId === agent.user_id ? (
                                <select
                                  aria-label="Eligibility Override"
                                  className="bg-black border border-[var(--color-border)] text-white text-xs h-8 px-2 focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
                                  value={editElig}
                                  onChange={e => setEditElig(e.target.value as any)}
                                >
                                  <option value="default">Default Rules</option>
                                  <option value="force_true">Force Eligible</option>
                                  <option value="force_false">Force Ineligible</option>
                                </select>
                              ) : (
                                <span className={agent.eligibility_override !== null ? (agent.eligibility_override ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium') : 'text-[var(--color-text-secondary)]'}>
                                  {agent.eligibility_override !== null ? (agent.eligibility_override ? 'Force Eligible' : 'Force Ineligible') : 'Computed Rules'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {editingOverrideId === agent.user_id ? (
                                <input
                                  aria-label="Cash Override"
                                  type="checkbox"
                                  className="size-4 rounded-sm border-[var(--color-border)] bg-black text-[var(--color-gold)] accent-[var(--color-gold)] focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
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
                                  className="bg-black border border-[var(--color-border)] text-white text-xs h-8 px-2 max-w-[150px] focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
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
                                <span className="text-white">
                                  {agent.sponsor_override ? overrides.find(x => x.user_id === agent.sponsor_override)?.full_name || 'Overridden' : 'Resolved Default'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {editingOverrideId === agent.user_id ? (
                                <Input
                                  aria-label="Notes"
                                  className="w-32 bg-black border-[var(--color-border)] text-white text-xs h-8"
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
                                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-[10px] uppercase px-2.5 py-1 rounded-none h-8 focus:outline focus:outline-2 focus:outline-zinc-700"
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
              )}

              {/* RESOLUTION TAB */}
              {activeTab === 'resolution' && (
                <div className="space-y-6">
                  <div className="border border-[var(--color-border)] rounded-sm overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/60 text-[var(--color-gold)] uppercase tracking-wider font-semibold border-b border-[var(--color-border)]">
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
                            <tr key={log.id} className="hover:bg-black/20">
                              <td className="px-6 py-4">
                                <span className="font-semibold text-white block">{log.users.full_name}</span>
                                <span className="text-[10px] text-[var(--color-text-secondary)]">{log.users.email}</span>
                              </td>
                              <td className="px-6 py-4 font-mono font-semibold text-red-400">
                                "{log.raw_sponsor_text}"
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-wider font-semibold ${
                                  log.resolution_status === 'ambiguous'
                                    ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20'
                                    : 'bg-red-950/40 text-red-400 border border-red-500/20'
                                }`}>
                                  {log.resolution_status}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <select
                                  aria-label="Assign Sponsor"
                                  className="bg-black border border-[var(--color-border)] text-white text-xs h-8 px-2 max-w-[200px] focus:outline focus:outline-2 focus:outline-[var(--color-gold)]"
                                  value={selectedSponsors[log.user_id] || ''}
                                  onChange={e => setSelectedSponsors(prev => ({ ...prev, [log.user_id]: e.target.value }))}
                                >
                                  <option value="">Select Real Agent...</option>
                                  {overrides
                                    .filter(x => x.user_id !== log.user_id)
                                    .map(x => (
                                      <option key={x.user_id} value={x.user_id}>{x.full_name}</option>
                                    ))}
                                </select>
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
              )}

              {/* SETTINGS TAB */}
              {activeTab === 'settings' && settings && (
                <div className="bg-[var(--color-surface-2)] p-6 border border-[var(--color-border)] rounded-sm space-y-6">
                  <h4 className="text-xs uppercase tracking-widest text-[var(--color-gold)] font-bold border-b border-[var(--color-border)] pb-3">Global Configuration</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* General params */}
                    <div className="space-y-4">
                      <h5 className="text-xs font-semibold text-white uppercase tracking-wider">Eligibility Parameters</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label htmlFor="settings-min-cap" className="text-[10px] text-gray-400 uppercase font-semibold">Min Cap Amount</label>
                          <Input
                            id="settings-min-cap"
                            type="number"
                            className="bg-black border-[var(--color-border)] text-white text-xs h-9"
                            value={settings.min_cap_amount}
                            onChange={e => setSettings(prev => prev ? ({ ...prev, min_cap_amount: parseFloat(e.target.value) }) : null)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="settings-grace" className="text-[10px] text-gray-400 uppercase font-semibold">Grace Period (Months)</label>
                          <Input
                            id="settings-grace"
                            type="number"
                            className="bg-black border-[var(--color-border)] text-white text-xs h-9"
                            value={settings.grace_period_months}
                            onChange={e => setSettings(prev => prev ? ({ ...prev, grace_period_months: parseInt(e.target.value) }) : null)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="settings-prod-min" className="text-[10px] text-gray-400 uppercase font-semibold">Min Production Txns</label>
                          <Input
                            id="settings-prod-min"
                            type="number"
                            className="bg-black border-[var(--color-border)] text-white text-xs h-9"
                            value={settings.production_min_transactions}
                            onChange={e => setSettings(prev => prev ? ({ ...prev, production_min_transactions: parseInt(e.target.value) }) : null)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="settings-prod-window" className="text-[10px] text-gray-400 uppercase font-semibold">Production Window (Months)</label>
                          <Input
                            id="settings-prod-window"
                            type="number"
                            className="bg-black border-[var(--color-border)] text-white text-xs h-9"
                            value={settings.production_window_months}
                            onChange={e => setSettings(prev => prev ? ({ ...prev, production_window_months: parseInt(e.target.value) }) : null)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Rates */}
                    <div className="space-y-4">
                      <h5 className="text-xs font-semibold text-white uppercase tracking-wider">Generation Split Rates</h5>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map(g => (
                          <div key={g} className="space-y-1">
                            <label htmlFor={`settings-gen${g}-rate`} className="text-[10px] text-gray-400 uppercase font-semibold block text-center">Gen {g}</label>
                            <Input
                              id={`settings-gen${g}-rate`}
                              type="number"
                              step="0.0001"
                              className="bg-black border-[var(--color-border)] text-white text-xs h-9 text-center"
                              value={settings[`gen${g}_rate` as keyof GlobalSettings]}
                              onChange={e => setSettings(prev => prev ? ({ ...prev, [`gen${g}_rate`]: parseFloat(e.target.value) }) : null)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Max payouts */}
                    <div className="space-y-4 md:col-span-2">
                      <h5 className="text-xs font-semibold text-white uppercase tracking-wider border-t border-[var(--color-border)] pt-4">Generation Caps & Bonuses</h5>
                      <div className="grid grid-cols-5 gap-4">
                        {[1, 2, 3, 4, 5].map(g => (
                          <div key={g} className="space-y-3">
                            <h6 className="text-[10px] text-[var(--color-gold)] font-bold uppercase text-center">Gen {g} Metrics</h6>
                            <div className="space-y-1">
                              <label htmlFor={`settings-gen${g}-max`} className="text-[9px] text-gray-400 uppercase font-semibold block text-center">Max Payout</label>
                              <Input
                                id={`settings-gen${g}-max`}
                                type="number"
                                className="bg-black border-[var(--color-border)] text-white text-xs h-9 text-center"
                                value={settings[`gen${g}_max_payout` as keyof GlobalSettings]}
                                onChange={e => setSettings(prev => prev ? ({ ...prev, [`gen${g}_max_payout`]: parseFloat(e.target.value) }) : null)}
                              />
                            </div>
                            <div className="space-y-1">
                              <label htmlFor={`settings-gen${g}-bonus`} className="text-[9px] text-gray-400 uppercase font-semibold block text-center">Bonus Amt</label>
                              <Input
                                id={`settings-gen${g}-bonus`}
                                type="number"
                                className="bg-black border-[var(--color-border)] text-white text-xs h-9 text-center"
                                value={settings[`gen${g}_completion_bonus` as keyof GlobalSettings]}
                                onChange={e => setSettings(prev => prev ? ({ ...prev, [`gen${g}_completion_bonus`]: parseFloat(e.target.value) }) : null)}
                              />
                            </div>
                            {g >= 2 && (
                              <div className="space-y-1">
                                <label htmlFor={`settings-gen${g}-unlock`} className="text-[9px] text-gray-400 uppercase font-semibold block text-center">Unlock Count</label>
                                <Input
                                  id={`settings-gen${g}-unlock`}
                                  type="number"
                                  className="bg-black border-[var(--color-border)] text-white text-xs h-9 text-center"
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
