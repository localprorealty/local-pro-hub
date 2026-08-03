import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ShieldAlert, Trash2, UserCheck, UserX } from 'lucide-react'

import { AdminShell } from '@/components/admin/AdminShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import type { UserRole } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase'

type AdminUserRow = {
  id: string
  email: string
  full_name: string | null
  mls_id: string | null
  role: UserRole | null
  status: 'pending' | 'active' | 'suspended'
  created_at: string
}

const ROLE_OPTIONS: UserRole[] = ['agent', 'marketing', 'photographer', 'admin']
const APPROVAL_TABS = ['pending', 'active', 'suspended'] as const
type ApprovalTab = (typeof APPROVAL_TABS)[number]

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

function tabLabel(tab: ApprovalTab): string {
  if (tab === 'pending') return 'Pending'
  if (tab === 'active') return 'Approved'
  return 'Rejected'
}

function AdminApprovalsContent() {
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null)
  const [pendingUsers, setPendingUsers] = useState<AdminUserRow[]>([])
  const [activeUsers, setActiveUsers] = useState<AdminUserRow[]>([])
  const [suspendedUsers, setSuspendedUsers] = useState<AdminUserRow[]>([])
  const [suspendedCount, setSuspendedCount] = useState(0)
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole>>({})
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<ApprovalTab>('pending')
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const isSelf = useCallback(
    (userId: string) => Boolean(currentAdminId && userId === currentAdminId),
    [currentAdminId],
  )

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error: queryError } = await getSupabaseClient()
        .from('users')
        .select('id, email, full_name, mls_id, role, status, created_at')
        .order('created_at', { ascending: false })

      if (queryError) throw queryError
      const rows = (data ?? []) as AdminUserRow[]

      const pending = rows.filter((row) => row.status === 'pending')
      const active = rows.filter((row) => row.status === 'active')
      const suspended = rows.filter((row) => row.status === 'suspended')
      setPendingUsers(pending)
      setActiveUsers(active)
      setSuspendedUsers(suspended)
      setSuspendedCount(suspended.length)
      setRoleDrafts(() => {
        const next: Record<string, UserRole> = {}
        rows.forEach((row) => {
          next[row.id] = (row.role ?? 'agent') as UserRole
        })
        return next
      })
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Failed to load users.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await getSupabaseClient().auth.getUser()
      setCurrentAdminId(data.user?.id ?? null)
    }
    void loadSession()

    const timeoutId = window.setTimeout(() => {
      void loadUsers()
    }, 0)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadUsers])

  const pendingCount = useMemo(() => pendingUsers.length, [pendingUsers.length])
  const visibleUsers = useMemo(() => {
    if (activeTab === 'pending') return pendingUsers
    if (activeTab === 'active') return activeUsers
    return suspendedUsers
  }, [activeTab, pendingUsers, activeUsers, suspendedUsers])
  const allVisibleSelected =
    visibleUsers.length > 0 && visibleUsers.every((row) => selectedIds[row.id])

  const assertCanModifyUser = useCallback(
    (targetUserId: string, values: Partial<AdminUserRow>) => {
      if (!currentAdminId) return

      if (targetUserId === currentAdminId) {
        if (values.role && values.role !== 'admin') {
          throw new Error('You cannot change your own admin role.')
        }
        if (values.status === 'suspended') {
          throw new Error('You cannot suspend your own admin account.')
        }
      }
    },
    [currentAdminId],
  )

  const updateUser = useCallback(
    async (id: string, values: Partial<AdminUserRow> & { approved_at?: string }) => {
      setIsMutating((prev) => ({ ...prev, [id]: true }))
      setError(null)
      try {
        assertCanModifyUser(id, values)

        const { error: updateError } = await getSupabaseClient()
          .from('users')
          .update(values)
          .eq('id', id)
        if (updateError) throw updateError
        await loadUsers()
      } catch (updateErr) {
        const message =
          updateErr instanceof Error ? updateErr.message : 'Update failed.'
        setError(message)
      } finally {
        setIsMutating((prev) => ({ ...prev, [id]: false }))
      }
    },
    [assertCanModifyUser, loadUsers],
  )

  const approveUser = useCallback(
    async (id: string, role: UserRole) => {
      await updateUser(id, {
        status: 'active',
        role,
        approved_at: new Date().toISOString(),
      })
    },
    [updateUser],
  )

  const deleteUserPermanently = useCallback(
    async (id: string, email: string) => {
      const confirmed = window.confirm(
        `Permanently delete ${email}? This removes their login entirely and frees the email for a new signup.`,
      )
      if (!confirmed) return

      setIsMutating((prev) => ({ ...prev, [id]: true }))
      setError(null)
      try {
        if (isSelf(id)) {
          throw new Error('You cannot delete your own account.')
        }

        const { error: deleteError } = await getSupabaseClient().rpc('admin_delete_user', {
          target_user_id: id,
        })
        if (deleteError) throw deleteError
        await loadUsers()
      } catch (deleteErr) {
        const message =
          deleteErr instanceof Error ? deleteErr.message : 'Delete failed.'
        setError(message)
      } finally {
        setIsMutating((prev) => ({ ...prev, [id]: false }))
      }
    },
    [isSelf, loadUsers],
  )

  const bulkApproveSelected = useCallback(async () => {
    const ids = visibleUsers
      .filter((row) => selectedIds[row.id])
      .filter((row) => row.id !== currentAdminId)
      .map((row) => row.id)
    if (ids.length === 0) return

    setError(null)
    try {
      for (const id of ids) {
        const role = roleDrafts[id] ?? 'agent'
        assertCanModifyUser(id, { status: 'active', role })
        const { error: updateError } = await getSupabaseClient()
          .from('users')
          .update({
            status: 'active',
            role,
            approved_at: new Date().toISOString(),
          })
          .eq('id', id)
        if (updateError) throw updateError
      }
      setSelectedIds({})
      await loadUsers()
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'Bulk approve failed.')
    }
  }, [visibleUsers, selectedIds, roleDrafts, loadUsers, currentAdminId, assertCanModifyUser])

  return (
    <AdminShell title="Access approvals">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="border-l-2 border-[var(--color-gold)] bg-[var(--color-surface-2)] p-4">
            <p className="text-xs tracking-widest text-[var(--color-text-secondary)] uppercase">
              Awaiting approvals
            </p>
            <p className="mt-2 text-4xl font-semibold text-[var(--color-gold)]">
              {pendingCount}
            </p>
          </div>
          <div className="border-l-2 border-[var(--color-gold)] bg-[var(--color-surface-2)] p-4">
            <p className="text-xs tracking-widest text-[var(--color-text-secondary)] uppercase">
              Active users
            </p>
            <p className="mt-2 text-4xl font-semibold text-[var(--color-gold)]">
              {activeUsers.length}
            </p>
          </div>
          <div className="border-l-2 border-[var(--color-gold)] bg-[var(--color-surface-2)] p-4">
            <p className="text-xs tracking-widest text-[var(--color-text-secondary)] uppercase">
              Rejected users
            </p>
            <p className="mt-2 text-4xl font-semibold text-[var(--color-gold)]">
              {suspendedCount}
            </p>
          </div>
        </section>

        <div className="mb-6 flex gap-3">
          {APPROVAL_TABS.map((tab) => {
            const isActive = activeTab === tab
            const count =
              tab === 'pending'
                ? pendingUsers.length
                : tab === 'active'
                  ? activeUsers.length
                  : suspendedUsers.length
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs tracking-widest uppercase transition-colors ${
                  isActive
                    ? 'border-b-2 border-[var(--color-gold)] bg-[var(--color-surface-3)] text-[var(--color-gold)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-white)]'
                }`}
              >
                {tabLabel(tab)}
                <span className="bg-[var(--color-gold)] px-1.5 py-0.5 text-[10px] text-[var(--color-black)]">
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {error ? (
          <div className="mb-6 flex items-center gap-2 border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <ShieldAlert className="size-4" aria-hidden />
            {error}
          </div>
        ) : null}

        <section className="mb-6 flex items-center justify-between border-b border-[var(--color-border)] pb-4">
          <label className="inline-flex items-center gap-2 text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(event) => {
                const checked = event.target.checked
                setSelectedIds((prev) => {
                  const next = { ...prev }
                  visibleUsers.forEach((row) => {
                    next[row.id] = checked
                  })
                  return next
                })
              }}
              className="size-4 border-[var(--color-border)] bg-transparent"
            />
            Select all visible
          </label>
          <Button
            type="button"
            onClick={() => void bulkApproveSelected()}
            className="rounded-sm bg-[var(--color-gold)] px-4 text-[var(--color-black)] hover:bg-[#dcc487] disabled:opacity-50"
            disabled={
              (activeTab !== 'pending' && activeTab !== 'suspended') ||
              visibleUsers.every((row) => !selectedIds[row.id])
            }
          >
            Approve Selected
          </Button>
        </section>

        <section className="mb-10 space-y-3">
          {isLoading ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Loading...</p>
          ) : visibleUsers.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No users in this tab.
            </p>
          ) : (
            visibleUsers.map((user) => {
              const draftRole = roleDrafts[user.id] ?? user.role ?? 'agent'
              const busy = Boolean(isMutating[user.id])
              const changed = draftRole !== (user.role ?? 'agent')
              const selfRow = isSelf(user.id)
              const selfRoleLocked = selfRow && user.role === 'admin'
              const canSaveRole = !selfRow && changed
              const canApprove =
                (activeTab === 'pending' || activeTab === 'suspended') && !selfRow
              const canReject =
                (activeTab === 'pending' || activeTab === 'active') && !selfRow
              const canDelete = !selfRow
              const approveLabel =
                activeTab === 'suspended' ? 'Re-approve' : 'Approve'

              return (
                <div
                  key={user.id}
                  className="border-l-2 border-[var(--color-gold)] bg-[var(--color-surface-2)] p-5"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--color-white)]">
                        {user.full_name ?? user.email}
                        {selfRow ? (
                          <span className="ml-2 rounded-sm border border-[var(--color-gold-border)] px-2 py-0.5 text-[10px] tracking-wide text-[var(--color-gold)] uppercase">
                            You
                          </span>
                        ) : null}
                      </h3>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {user.email}
                        {user.mls_id ? ` · MLS ${user.mls_id}` : ''} · Requested{' '}
                        <span className="text-[var(--color-gold)]">
                          {user.role ?? 'agent'}
                        </span>
                        {' · '}
                        Submitted {fmtDate(user.created_at)}
                      </p>
                      {selfRow ? (
                        <p className="mt-2 text-xs text-[var(--color-gold)]">
                          Your admin role is locked on this account.
                        </p>
                      ) : null}
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedIds[user.id])}
                      disabled={selfRow}
                      onChange={(event) =>
                        setSelectedIds((prev) => ({
                          ...prev,
                          [user.id]: event.target.checked,
                        }))
                      }
                      className="mt-1 size-4 border-[var(--color-border)] bg-transparent disabled:opacity-40"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
                    {selfRoleLocked ? (
                      <div className="h-10 min-w-36 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-white)]">
                        admin
                      </div>
                    ) : (
                      <select
                        value={draftRole}
                        onChange={(event) =>
                          setRoleDrafts((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as UserRole,
                          }))
                        }
                        className="h-10 min-w-36 border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)]"
                        disabled={busy}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    )}

                    <Button
                      type="button"
                      onClick={() => void approveUser(user.id, draftRole)}
                      disabled={busy || !canApprove}
                      className="h-10 rounded-sm bg-[#1a2e1a] px-4 text-[#4ade80] hover:bg-[#254525] disabled:opacity-50"
                    >
                      <UserCheck className="mr-2 size-4" aria-hidden />
                      {approveLabel}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => void updateUser(user.id, { status: 'suspended' })}
                      disabled={busy || !canReject}
                      className="h-10 rounded-sm bg-[#2e1a1a] px-4 text-[#f87171] hover:bg-[#452525] disabled:opacity-50"
                    >
                      <UserX className="mr-2 size-4" aria-hidden />
                      Reject
                    </Button>

                    <Button
                      type="button"
                      onClick={() => void updateUser(user.id, { role: draftRole })}
                      disabled={busy || !canSaveRole}
                      className="h-10 rounded-sm bg-[var(--color-gold)] px-4 text-[var(--color-black)] hover:bg-[#dcc487] disabled:opacity-50"
                    >
                      <Check className="mr-2 size-4" aria-hidden />
                      Save Role
                    </Button>

                    <Button
                      type="button"
                      onClick={() => void deleteUserPermanently(user.id, user.email)}
                      disabled={busy || !canDelete}
                      className="h-10 rounded-sm border border-red-500/40 bg-transparent px-4 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <Trash2 className="mr-2 size-4" aria-hidden />
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </section>

        <section className="overflow-x-auto border border-[var(--color-border)] bg-[var(--color-surface-2)]">
          <table className="min-w-full text-left">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-3)]">
              <tr>
                <th className="px-4 py-3 text-xs tracking-widest text-[var(--color-text-secondary)] uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-xs tracking-widest text-[var(--color-text-secondary)] uppercase">
                  Email
                </th>
                <th className="px-4 py-3 text-xs tracking-widest text-[var(--color-text-secondary)] uppercase">
                  Requested role
                </th>
                <th className="px-4 py-3 text-xs tracking-widest text-[var(--color-text-secondary)] uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-xs tracking-widest text-[var(--color-text-secondary)] uppercase">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody>
              {[...pendingUsers, ...activeUsers, ...suspendedUsers].map((user) => (
                <tr key={`table-${user.id}`} className="border-b border-[var(--color-border)]/40">
                  <td className="px-4 py-3 text-sm text-[var(--color-white)]">
                    {user.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-white)]">
                    {user.role ?? 'agent'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-gold)]">
                    {user.status}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                    {fmtDate(user.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </motion.div>
    </AdminShell>
  )
}

export default function AdminApprovalsPage() {
  return (
    <ErrorBoundary title="Admin approvals">
      <AdminApprovalsContent />
    </ErrorBoundary>
  )
}
