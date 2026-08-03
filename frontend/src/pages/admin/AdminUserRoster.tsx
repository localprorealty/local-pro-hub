import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Trash2, UserPen } from 'lucide-react'

import { AgentMilestonesEditor } from '@/components/admin/AgentMilestonesEditor'
import { AdminShell } from '@/components/admin/AdminShell'
import { ConfirmSaveDialog } from '@/components/profile/ConfirmSaveDialog'
import {
  UserProfileForm,
  type ProfileFormValues,
} from '@/components/profile/UserProfileForm'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { UserRole, UserProfileStatus } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase'
import {
  adminCreateUser,
  adminDeleteUser,
  adminUpdateUser,
  diffProfileFields,
  fetchUsersByRole,
  type AdminCreateUserPayload,
  type UserProfileRow,
} from '@/lib/users'
import {
  fetchMilestoneCounts,
  fetchUserMilestones,
  formRowsToPayload,
  milestoneToFormRow,
  replaceUserMilestones,
  validateMilestoneRows,
  type MilestoneFormRow,
} from '@/lib/milestones'

type AdminUserRosterProps = {
  roleFilter: UserRole | 'all'
  title: string
  description: string
}

function AdminUserRosterContent({ roleFilter, title, description }: AdminUserRosterProps) {
  const [users, setUsers] = useState<UserProfileRow[]>([])
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [editingUser, setEditingUser] = useState<UserProfileRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingValues, setPendingValues] = useState<ProfileFormValues | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [bulkAddText, setBulkAddText] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<UserProfileRow | null>(null)
  const [milestoneRows, setMilestoneRows] = useState<MilestoneFormRow[]>([])
  const [milestoneCounts, setMilestoneCounts] = useState<Record<string, number>>({})
  const [milestonesLoading, setMilestonesLoading] = useState(false)

  const [newUser, setNewUser] = useState<AdminCreateUserPayload>({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    mls_id: '',
    brokermint_id: '',
    role: roleFilter === 'all' ? 'agent' : roleFilter,
    status: 'active',
    photographer_tier: 'standard',
  })

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const rows = await fetchUsersByRole(roleFilter)
      setUsers(rows)
      try {
        const counts = await fetchMilestoneCounts(rows.map((row) => row.id))
        setMilestoneCounts(counts)
      } catch {
        setMilestoneCounts({})
      }
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : 'Failed to load users.')
    } finally {
      setIsLoading(false)
    }
  }, [roleFilter])

  useEffect(() => {
    const init = async () => {
      const { data } = await getSupabaseClient().auth.getUser()
      setCurrentAdminId(data.user?.id ?? null)
    }
    void init()

    const timeoutId = window.setTimeout(() => {
      void loadUsers()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadUsers])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const text = `${u.full_name ?? ''} ${u.email} ${u.mls_id ?? ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [users, search])

  const allSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds[u.id])

  const isSelf = (id: string) => Boolean(currentAdminId && id === currentAdminId)

  useEffect(() => {
    if (!editingUser) {
      setMilestoneRows([])
      return
    }

    let cancelled = false
    setMilestonesLoading(true)
    void fetchUserMilestones(editingUser.id)
      .then((rows) => {
        if (cancelled) return
        setMilestoneRows(rows.map(milestoneToFormRow))
      })
      .catch(() => {
        if (!cancelled) setMilestoneRows([])
      })
      .finally(() => {
        if (!cancelled) setMilestonesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [editingUser])

  const handleEditSaveRequest = (values: ProfileFormValues) => {
    const milestoneError = validateMilestoneRows(milestoneRows)
    if (milestoneError) {
      setError(milestoneError)
      return
    }
    setPendingValues(values)
    setConfirmOpen(true)
  }

  const handleConfirmEdit = async () => {
    if (!editingUser || !pendingValues) return
    if (isSelf(editingUser.id) && pendingValues.role !== 'admin') {
      setError('You cannot change your own admin role.')
      setConfirmOpen(false)
      return
    }
    if (isSelf(editingUser.id) && pendingValues.status === 'suspended') {
      setError('You cannot suspend your own admin account.')
      setConfirmOpen(false)
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const patch: Parameters<typeof adminUpdateUser>[1] = {
        email: pendingValues.email.trim(),
        full_name: pendingValues.full_name,
        phone: pendingValues.phone,
        mls_id: pendingValues.mls_id,
        brokermint_id: pendingValues.brokermint_id,
        role: pendingValues.role,
        status: pendingValues.status,
        photographer_tier:
          pendingValues.role === 'photographer' ? pendingValues.photographer_tier : null,
      }
      if (
        pendingValues.status === 'active' &&
        editingUser.status !== 'active'
      ) {
        patch.approved_at = new Date().toISOString()
      }
      await adminUpdateUser(editingUser.id, patch)
      await replaceUserMilestones(editingUser.id, formRowsToPayload(milestoneRows))
      setSuccess('User updated.')
      setEditingUser(null)
      setConfirmOpen(false)
      setPendingValues(null)
      await loadUsers()
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Update failed.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleBulkAddUsers = async () => {
    const lines = bulkAddText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) {
      setError('Add at least one line (email, password, full name, phone, MLS ID, license).')
      return
    }

    setIsSaving(true)
    setError(null)
    let created = 0
    const failures: string[] = []

    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim())
      if (parts.length < 6) {
        failures.push(`${line.slice(0, 40)}… — need 6 comma-separated fields`)
        continue
      }
      const [email, password, full_name, phone, mls_id, brokermint_id] = parts
      try {
        await adminCreateUser({
          email,
          password,
          full_name,
          phone,
          mls_id,
          brokermint_id,
          role: newUser.role,
          status: newUser.status,
          photographer_tier: newUser.photographer_tier,
        })
        created += 1
      } catch (bulkErr) {
        const msg = bulkErr instanceof Error ? bulkErr.message : 'Create failed'
        failures.push(`${email}: ${msg}`)
      }
    }

    setIsSaving(false)
    if (created > 0) {
      setSuccess(`Created ${created} user${created === 1 ? '' : 's'}.`)
      setBulkAddOpen(false)
      setBulkAddText('')
      await loadUsers()
    }
    if (failures.length > 0) {
      setError(failures.slice(0, 3).join(' · ') + (failures.length > 3 ? ' …' : ''))
    } else if (created === 0) {
      setError('No users were created.')
    }
  }

  const handleAddUser = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await adminCreateUser(newUser)
      setSuccess('User created.')
      setAddOpen(false)
      setNewUser({
        email: '',
        password: '',
        full_name: '',
        phone: '',
        mls_id: '',
        brokermint_id: '',
        role: roleFilter === 'all' ? 'agent' : roleFilter,
        status: 'active',
        photographer_tier: 'standard',
      })
      await loadUsers()
    } catch (addErr) {
      setError(addErr instanceof Error ? addErr.message : 'Create failed.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsSaving(true)
    setError(null)
    try {
      await adminDeleteUser(deleteTarget.id)
      setSuccess('User deleted.')
      setDeleteTarget(null)
      await loadUsers()
    } catch (delErr) {
      setError(delErr instanceof Error ? delErr.message : 'Delete failed.')
    } finally {
      setIsSaving(false)
    }
  }

  const runBulk = async (action: 'active' | 'suspended' | 'delete') => {
    const ids = filteredUsers
      .filter((u) => selectedIds[u.id])
      .filter((u) => !isSelf(u.id))
      .map((u) => u.id)
    if (ids.length === 0) return

    setIsSaving(true)
    setError(null)
    try {
      for (const id of ids) {
        if (action === 'delete') {
          await adminDeleteUser(id)
        } else {
          await adminUpdateUser(id, { status: action })
        }
      }
      setSuccess('Bulk update complete.')
      setSelectedIds({})
      await loadUsers()
    } catch (bulkErr) {
      setError(bulkErr instanceof Error ? bulkErr.message : 'Bulk action failed.')
    } finally {
      setIsSaving(false)
    }
  }

  const editChanges = useMemo(() => {
    if (!editingUser || !pendingValues) return []
    return diffProfileFields(editingUser, {
      email: pendingValues.email,
      full_name: pendingValues.full_name,
      phone: pendingValues.phone,
      mls_id: pendingValues.mls_id,
      brokermint_id: pendingValues.brokermint_id,
      role: pendingValues.role,
      status: pendingValues.status,
      photographer_tier: pendingValues.photographer_tier,
    })
  }, [editingUser, pendingValues])

  return (
    <AdminShell title={title} eyebrow="Team roster">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">{description}</p>

        {error ? (
          <p className="mb-4 text-sm text-red-300">{error}</p>
        ) : null}
        {success ? (
          <p className="mb-4 text-sm text-emerald-300">{success}</p>
        ) : null}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <label className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, MLS..."
              className="h-10 rounded-sm border-[var(--color-border)] bg-[var(--color-surface)] pl-10 text-[var(--color-white)]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setAddOpen(true)}
              className="h-10 rounded-sm bg-[var(--color-gold)] px-4 font-semibold text-[var(--color-black)]"
            >
              <Plus className="mr-2 size-4" aria-hidden />
              Add user
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkAddOpen(true)}
              className="h-10 rounded-sm border-[var(--color-border)] text-[var(--color-white)]"
            >
              Bulk add
            </Button>
          </div>
        </div>

        <section className="mb-4 flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] pb-4">
          <label className="inline-flex items-center gap-2 text-xs uppercase text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => {
                const checked = e.target.checked
                const next: Record<string, boolean> = {}
                filteredUsers.forEach((u) => {
                  next[u.id] = checked
                })
                setSelectedIds(next)
              }}
            />
            Select all
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => void runBulk('active')}
            className="h-9 rounded-sm border-[var(--color-border)] text-[var(--color-white)]"
          >
            Bulk activate
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => void runBulk('suspended')}
            className="h-9 rounded-sm border-[var(--color-border)] text-[var(--color-white)]"
          >
            Bulk reject
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => void runBulk('delete')}
            className="h-9 rounded-sm border-red-500/40 text-red-300"
          >
            Bulk delete
          </Button>
        </section>

        {isLoading ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">No users found.</p>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="border-l-2 border-[var(--color-gold)] bg-[var(--color-surface-2)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedIds[user.id])}
                      disabled={isSelf(user.id)}
                      onChange={(e) =>
                        setSelectedIds((prev) => ({
                          ...prev,
                          [user.id]: e.target.checked,
                        }))
                      }
                      className="mt-1"
                    />
                    <div>
                      <p className="font-semibold text-[var(--color-white)]">
                        {user.full_name ?? user.email}
                        {isSelf(user.id) ? (
                          <span className="ml-2 text-[10px] text-[var(--color-gold)] uppercase">
                            You
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {user.email} · {user.role ?? '—'} · {user.status}
                        {(milestoneCounts[user.id] ?? 0) > 0 ? (
                          <span>
                            {' '}
                            · {milestoneCounts[user.id]} milestone
                            {milestoneCounts[user.id] === 1 ? '' : 's'}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingUser(user)}
                      className="h-9 rounded-sm border-[var(--color-border)] text-[var(--color-white)]"
                    >
                      <UserPen className="mr-1 size-4" aria-hidden />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSelf(user.id)}
                      onClick={() => setDeleteTarget(user)}
                      className="h-9 rounded-sm border-red-500/40 text-red-300"
                    >
                      <Trash2 className="mr-1 size-4" aria-hidden />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-white)] sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-display)]">
                Edit user
              </DialogTitle>
            </DialogHeader>
            {editingUser ? (
              <div className="space-y-2">
                <UserProfileForm
                  key={editingUser.id}
                  mode="admin"
                  initial={editingUser}
                  onCancel={() => setEditingUser(null)}
                  onRequestSave={handleEditSaveRequest}
                  isSaving={isSaving || milestonesLoading}
                />
                {editingUser.role === 'agent' ? (
                  milestonesLoading ? (
                    <p className="border-t border-[var(--color-border)] pt-6 text-xs text-[var(--color-text-secondary)]">
                      Loading milestones...
                    </p>
                  ) : (
                    <AgentMilestonesEditor
                      rows={milestoneRows}
                      onChange={setMilestoneRows}
                      disabled={isSaving}
                    />
                  )
                ) : null}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={bulkAddOpen} onOpenChange={setBulkAddOpen}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-white)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-display)]">
                Bulk add users
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-[var(--color-text-secondary)]">
              One user per line. Comma-separated: email, password, full name, phone, MLS ID
              (7 digits), license number. Role, status, and photographer tier use the
              values from the single-user form defaults below.
            </p>
            <textarea
              value={bulkAddText}
              onChange={(e) => setBulkAddText(e.target.value)}
              rows={8}
              placeholder="agent@localpro.com,TempPass123!,Jane Agent,5551234567,1234567,TX-12345"
              className="mt-3 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-xs text-[var(--color-white)]"
            />
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs uppercase text-[var(--color-text-secondary)]">
                  Role (all lines)
                </Label>
                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      role: e.target.value as UserRole,
                    }))
                  }
                  className="mt-1 h-10 w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-white)]"
                >
                  {(['agent', 'marketing', 'photographer', 'admin'] as UserRole[]).map(
                    (r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <Label className="text-xs uppercase text-[var(--color-text-secondary)]">
                  Status (all lines)
                </Label>
                <select
                  value={newUser.status}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      status: e.target.value as UserProfileStatus,
                    }))
                  }
                  className="mt-1 h-10 w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-white)]"
                >
                  {(['pending', 'active', 'suspended'] as UserProfileStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => void handleBulkAddUsers()}
              className="mt-4 h-10 w-full rounded-sm bg-[var(--color-gold)] font-semibold text-[var(--color-black)]"
            >
              {isSaving ? 'Creating...' : 'Create users'}
            </Button>
          </DialogContent>
        </Dialog>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-white)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-display)]">
                Add user
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {(
                [
                  ['email', 'Email', 'email'],
                  ['password', 'Temporary password', 'password'],
                  ['full_name', 'Full name', 'text'],
                  ['phone', 'Phone', 'text'],
                  ['mls_id', 'MLS ID', 'text'],
                  ['brokermint_id', 'Broker Mint ID', 'text'],
                ] as const
              ).map(([key, label, type]) => (
                <div key={key}>
                  <Label className="text-xs uppercase text-[var(--color-text-secondary)]">
                    {label}
                  </Label>
                  <Input
                    type={type}
                    value={newUser[key]}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="mt-1 h-10 border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-white)]"
                  />
                </div>
              ))}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs uppercase text-[var(--color-text-secondary)]">
                    Role
                  </Label>
                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        role: e.target.value as UserRole,
                      }))
                    }
                    className="mt-1 h-10 w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-white)]"
                  >
                    {(['agent', 'marketing', 'photographer', 'admin'] as UserRole[]).map(
                      (r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <Label className="text-xs uppercase text-[var(--color-text-secondary)]">
                    Status
                  </Label>
                  <select
                    value={newUser.status}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        status: e.target.value as UserProfileStatus,
                      }))
                    }
                    className="mt-1 h-10 w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-white)]"
                  >
                    {(['pending', 'active', 'suspended'] as UserProfileStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => void handleAddUser()}
                className="h-10 w-full rounded-sm bg-[var(--color-gold)] font-semibold text-[var(--color-black)]"
              >
                {isSaving ? 'Creating...' : 'Create user'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmSaveDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Confirm user update"
          description="Review changes before updating this user in Supabase."
          changes={editChanges}
          onConfirm={() => void handleConfirmEdit()}
          isLoading={isSaving}
        />

        <ConfirmSaveDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete user permanently?"
          description={`Remove ${deleteTarget?.email ?? 'this user'} from auth and the database. This cannot be undone.`}
          changes={[
            {
              label: 'Action',
              from: 'keep',
              to: 'permanent delete',
            },
          ]}
          onConfirm={() => void handleDelete()}
          isLoading={isSaving}
          confirmLabel="Delete"
        />
      </motion.div>
    </AdminShell>
  )
}

export default function AdminUserRoster(props: AdminUserRosterProps) {
  return (
    <ErrorBoundary title={props.title}>
      <AdminUserRosterContent {...props} />
    </ErrorBoundary>
  )
}
