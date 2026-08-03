import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  StopCircle,
} from 'lucide-react'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

type SyncLog = {
  id?: string
  started_at: string
  finished_at: string | null
  agents_synced: number
  agents_failed: number
  txns_synced: number
  errors: any[]
  status: 'running' | 'success' | 'completed_with_errors' | 'failed' | 'never_synced' | 'cancelled'
}


function getStatusDetails(status: string) {
  switch (status) {
    case 'running':
      return {
        label: 'Running',
        color: 'text-blue-400 bg-blue-950/30 border border-blue-500/20',
        icon: <RefreshCw className="size-4 animate-spin text-blue-400" />,
      }
    case 'cancelled':
      return {
        label: 'Cancelled',
        color: 'text-zinc-400 bg-zinc-950/30 border border-zinc-500/20',
        icon: <StopCircle className="size-4 text-zinc-400" />,
      }
    case 'success':
      return {
        label: 'Success',
        color: 'text-emerald-400 bg-emerald-950/30 border border-emerald-500/20',
        icon: <CheckCircle2 className="size-4 text-emerald-400" />,
      }
    case 'completed_with_errors':
      return {
        label: 'Completed with Errors',
        color: 'text-amber-400 bg-amber-950/30 border border-amber-500/20',
        icon: <AlertTriangle className="size-4 text-amber-400" />,
      }
    case 'failed':
      return {
        label: 'Failed',
        color: 'text-red-400 bg-red-950/30 border border-red-500/20',
        icon: <XCircle className="size-4 text-red-400" />,
      }
    default:
      return {
        label: 'Never Synced',
        color: 'text-zinc-400 bg-zinc-950/30 border border-zinc-500/20',
        icon: <AlertTriangle className="size-4 text-zinc-400" />,
      }
  }
}

function formatDate(isoString: string | null): string {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function AdminBrokerMintContent() {
  const [log, setLog] = useState<SyncLog | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unmatchedEmails, setUnmatchedEmails] = useState<string[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [mappings, setMappings] = useState<Record<string, string>>({
    listing: '',
    buyer: '',
    lease: '',
  })
  const [isSavingMappings, setIsSavingMappings] = useState(false)
  const [mappingsMessage, setMappingsMessage] = useState<string | null>(null)

  const loadStatus = async (showLoader = true) => {
    if (showLoader) setIsLoading(true)
    setError(null)
    try {
      const res = await api<SyncLog>('/brokermint/sync-status')
      setLog(res)
      
      // Fetch mappings
      try {
        const mapRes = await api<Array<{ listing_type: string; checklist_template_id: number }>>('/brokermint/checklist-mappings')
        const mObj: Record<string, string> = { listing: '', buyer: '', lease: '' }
        for (const m of mapRes) {
          mObj[m.listing_type] = String(m.checklist_template_id)
        }
        setMappings(mObj)
      } catch (mapErr) {
        console.error('Failed to load mappings:', mapErr)
      }
      
      // Extract unmatched emails if there are unmatched users logged
      if (res && res.errors) {
        const emails = (res.errors || [])
          .filter((err: any) => err && err.error && err.error.includes('No LP Hub user for BrokerMint email'))
          .map((err: any) => {
            const match = err.error.match(/email: (.*)/)
            return match ? match[1] : err.error
          })
        // Remove duplicates
        setUnmatchedEmails(Array.from(new Set(emails)))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sync status.')
    } finally {
      if (showLoader) setIsLoading(false)
    }
  }

  const saveMappings = async () => {
    setIsSavingMappings(true)
    setMappingsMessage(null)
    setError(null)
    try {
      const payload = Object.entries(mappings).map(([type, id]) => ({
        listing_type: type,
        checklist_template_id: parseInt(id) || 0,
      }))
      await api('/brokermint/checklist-mappings', {
        method: 'POST',
        body: payload,
      })
      setMappingsMessage('Mappings saved successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save mappings.')
    } finally {
      setIsSavingMappings(false)
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  useEffect(() => {
    if (log?.status !== 'running') return

    const timer = setInterval(() => {
      void loadStatus(false)
    }, 3000)

    return () => clearInterval(timer)
  }, [log?.status])

  const handleResetSync = async () => {
    setIsResetting(true)
    setError(null)
    try {
      await api('/brokermint/sync/reset', { method: 'POST' })
      await loadStatus(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset sync lock.')
    } finally {
      setIsResetting(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setError(null)
    setLog((prev) =>
      prev
        ? { ...prev, status: 'running', started_at: new Date().toISOString() }
        : {
            started_at: new Date().toISOString(),
            finished_at: null,
            agents_synced: 0,
            agents_failed: 0,
            txns_synced: 0,
            errors: [],
            status: 'running',
          }
    )
    try {
      await api('/brokermint/sync', { method: 'POST' })
      await loadStatus(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync execution failed.')
      void loadStatus(false)
    } finally {
      setIsSyncing(false)
    }
  }

  const statusInfo = log ? getStatusDetails(log.status) : getStatusDetails('never_synced')

  // Identify unmatched warnings and general transaction errors
  const txErrors = (log?.errors || []).filter((e) => e && (e.bm_transaction_id || e.address))
  const progressItem = (log?.errors || []).find((e: any) => e && e.progress)
  const progressText = progressItem ? (progressItem.progress as string) : null

  return (
    <AdminShell title="BrokerMint Sync" eyebrow="Integrations">
      <div className="max-w-4xl space-y-8">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Synchronize LocalPRO Hub agent profiles, transactions, and commission splits directly with the BrokerMint API.
        </p>

        {error ? (
          <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-6 text-red-200">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading sync records...</p>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Sync Control Card */}
            <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-lg text-white">Manual Database Sync</h3>
                <p className="text-xs text-[var(--color-text-secondary)] max-w-lg">
                  Runs email matching to map BrokerMint User IDs, then pulls all transaction records and commission items for mapped agents.
                </p>
                {log?.started_at && (
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Last execution: <span className="text-white font-medium">{formatDate(log.started_at)}</span>
                  </p>
                )}
              </div>
              <div className="flex gap-3 shrink-0 flex-wrap">
                <Button
                  type="button"
                  disabled={isSyncing || log?.status === 'running'}
                  onClick={() => void handleSync()}
                  className="h-11 rounded-sm bg-[var(--color-gold)] font-bold tracking-widest text-[var(--color-black)] uppercase hover:bg-[#dcc487] disabled:opacity-60 px-6"
                >
                  {isSyncing || log?.status === 'running' ? (
                    <>
                      <RefreshCw className="mr-2 size-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 size-4" />
                      Run Sync Now
                    </>
                  )}
                </Button>
                
                {(log?.status === 'running' || isSyncing) && (
                  <Button
                    type="button"
                    disabled={isResetting}
                    onClick={() => void handleResetSync()}
                    className="h-11 rounded-sm bg-red-600 hover:bg-red-700 text-white font-bold tracking-widest uppercase px-6 border border-red-500/20"
                  >
                    {isResetting ? (
                      <>
                        <RefreshCw className="mr-2 size-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <StopCircle className="mr-2 size-4" />
                        Stop / Reset
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {log?.status === 'never_synced' ? (
              <div className="border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/30 p-8 text-center text-sm text-[var(--color-text-secondary)] rounded-sm">
                No sync history found. Click "Run Sync Now" to match agents and synchronize transactions.
              </div>
            ) : (
              <>
                {/* Sync Status Cards */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                  <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 rounded-sm space-y-3">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">Sync Status</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-sm text-xs font-semibold flex items-center gap-1.5 ${statusInfo.color}`}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </div>
                      </div>
                      {log?.status === 'running' && progressText && (
                        <p className="text-xs text-emerald-400 animate-pulse font-medium mt-1">
                          {progressText}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 rounded-sm space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">Agents Matched</p>
                    <div className="flex items-center gap-2 text-white">
                      <Users className="size-5 text-[var(--color-gold)]" />
                      <span className="text-2xl font-bold">{log?.agents_synced ?? 0}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">synced</span>
                    </div>
                  </div>

                  <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 rounded-sm space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">Transactions Loaded</p>
                    <div className="flex items-center gap-2 text-white">
                      <FileText className="size-5 text-[var(--color-gold)]" />
                      <span className="text-2xl font-bold">{log?.txns_synced ?? 0}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">synced</span>
                    </div>
                  </div>
                </div>

                {/* Unmatched User Alert List */}
                {(unmatchedEmails || []).length > 0 && (
                  <div className="border border-amber-500/20 bg-amber-500/5 p-6 rounded-sm space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                      <AlertTriangle className="size-5" />
                      Unmatched BrokerMint Emails ({(unmatchedEmails || []).length})
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      The following agents exist in BrokerMint but have no corresponding active account in LocalPRO Hub by email. Add these agents to the roster to sync their sales figures:
                    </p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-amber-200">
                      {(unmatchedEmails || []).map((email, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="size-1 bg-amber-400 rounded-full" />
                          {email}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Error logs collapse panel */}
                {(txErrors || []).length > 0 && (
                  <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] rounded-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowErrors(!showErrors)}
                      className="w-full px-6 py-4 flex items-center justify-between text-sm font-semibold text-white hover:bg-[var(--color-surface-3)] transition-colors"
                    >
                      <span className="flex items-center gap-2 text-red-400">
                        <XCircle className="size-4" />
                        Transaction Sync Warnings ({(txErrors || []).length})
                      </span>
                      {showErrors ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>

                    {showErrors && (
                      <div className="border-t border-[var(--color-border)] p-6 space-y-3 max-h-[300px] overflow-y-auto bg-black/20">
                        {(txErrors || []).map((err, i) => (
                          <div key={i} className="text-xs border-b border-[#222] pb-2 last:border-0 last:pb-0 space-y-1">
                            <div className="flex justify-between font-mono text-[var(--color-text-secondary)]">
                              <span>Transaction: {err.address || 'Unknown'} (ID: {err.bm_transaction_id})</span>
                            </div>
                            <p className="text-red-300 font-semibold">{err.error}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Checklist Mappings Settings */}
                <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 rounded-sm space-y-4">
                  <h3 className="font-semibold text-lg text-white">BrokerMint Checklist Mappings</h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Map each LocalPRO Listing Type to its corresponding BrokerMint Checklist Template ID.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {['listing', 'buyer', 'lease'].map((type) => (
                      <div key={type} className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-semibold capitalize">{type} Template ID</label>
                        <Input
                          type="number"
                          className="bg-black border-[var(--color-border)] text-white text-xs h-9"
                          value={mappings[type] || ''}
                          onChange={(e) => setMappings({ ...mappings, [type]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>

                  {mappingsMessage && (
                    <p className="text-xs font-semibold text-emerald-400" role="alert">
                      {mappingsMessage}
                    </p>
                  )}
                  
                  <Button
                    type="button"
                    onClick={() => void saveMappings()}
                    disabled={isSavingMappings}
                    className="h-10 rounded-sm bg-[var(--color-gold)] font-bold tracking-widest text-[var(--color-black)] uppercase hover:bg-[#dcc487] px-6 text-xs disabled:opacity-60"
                  >
                    {isSavingMappings ? 'Saving...' : 'Save Checklist Mappings'}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </AdminShell>
  )
}

export default function AdminBrokerMintPage() {
  return (
    <ErrorBoundary title="BrokerMint Sync">
      <AdminBrokerMintContent />
    </ErrorBoundary>
  )
}
