import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  Lock,
  Mail,
  Plus,
  Trash2,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createAgentVendor,
  deleteAgentVendor,
  deleteGmailCredentials,
  fetchAgentVendors,
  fetchGmailCredentialsStatus,
  saveGmailCredentials,
  updateAgentVendor,
  type AgentVendor,
  type GmailCredentialsStatus,
} from '@/lib/vendors'

const fieldClass =
  'h-10 rounded-sm border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)]'

export function PhotographerVendorsSection() {
  const [vendors, setVendors] = useState<AgentVendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Vendor edit/create modal/form state
  const [isEditingVendor, setIsEditingVendor] = useState(false)
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null)
  const [vendorName, setVendorName] = useState('')
  const [vendorUrl, setVendorUrl] = useState('')
  const [vendorEmail, setVendorEmail] = useState('')
  const [vendorPhone, setVendorPhone] = useState('')
  const [vendorNotes, setVendorNotes] = useState('')
  const [isSavingVendor, setIsSavingVendor] = useState(false)
  const [vendorToDelete, setVendorToDelete] = useState<AgentVendor | null>(null)
  const [isDeletingVendor, setIsDeletingVendor] = useState(false)

  const loadVendors = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const list = await fetchAgentVendors()
      setVendors(list)
    } catch (err) {
      console.error('Failed to load vendors:', err)
      setError(err instanceof Error ? err.message : 'Failed to load vendors')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadVendors()
  }, [loadVendors])

  const openNewVendorForm = () => {
    setEditingVendorId(null)
    setVendorName('')
    setVendorUrl('')
    setVendorEmail('')
    setVendorPhone('')
    setVendorNotes('')
    setIsEditingVendor(true)
  }

  const openEditVendorForm = (v: AgentVendor) => {
    setEditingVendorId(v.id)
    setVendorName(v.name)
    setVendorUrl(v.website_url || '')
    setVendorEmail(v.email || '')
    setVendorPhone(v.phone || '')
    setVendorNotes(v.notes || '')
    setIsEditingVendor(true)
  }

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendorName.trim()) return
    setIsSavingVendor(true)
    setError(null)
    try {
      const payload = {
        name: vendorName.trim(),
        website_url: vendorUrl.trim() || null,
        email: vendorEmail.trim() || null,
        phone: vendorPhone.trim() || null,
        notes: vendorNotes.trim() || null,
        is_default: true,
      }
      if (editingVendorId) {
        await updateAgentVendor(editingVendorId, payload)
      } else {
        await createAgentVendor(payload)
      }
      setIsEditingVendor(false)
      await loadVendors()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vendor')
    } finally {
      setIsSavingVendor(false)
    }
  }

  const confirmDeleteVendor = async () => {
    if (!vendorToDelete) return
    setIsDeletingVendor(true)
    try {
      await deleteAgentVendor(vendorToDelete.id)
      await loadVendors()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete vendor')
    } finally {
      setIsDeletingVendor(false)
      setVendorToDelete(null)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[#101010] p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 pb-3">
        <div className="flex items-center gap-2.5">
          <Building2 className="size-4 text-[var(--color-gold)]" />
          <div>
            <h4 className="text-sm font-semibold text-white">Preferred Photographer Vendors</h4>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              Manage your preferred photographer vendor directory for quick order links and email dispatch.
            </p>
          </div>
        </div>
        {!isEditingVendor && (
          <Button
            type="button"
            size="sm"
            onClick={openNewVendorForm}
            className="h-8 gap-1.5 rounded-sm bg-[var(--color-gold)] px-3 text-xs font-semibold text-black hover:bg-[#dcc487]"
          >
            <Plus className="size-3.5" />
            {vendors.length === 0 ? 'Add Vendor' : 'New'}
          </Button>
        )}
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-xs text-[var(--color-text-secondary)]">
          <Loader2 className="mr-2 size-4 animate-spin text-[var(--color-gold)]" />
          Loading vendors...
        </div>
      ) : isEditingVendor ? (
        <form onSubmit={handleSaveVendor} className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-gold)] uppercase tracking-wider">
              {editingVendorId ? 'Edit Vendor' : 'Add Preferred Vendor'}
            </span>
            <button
              type="button"
              onClick={() => setIsEditingVendor(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          <div>
            <Label className="text-xs text-zinc-300">Vendor / Business Name *</Label>
            <Input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. Shoot2Sell, Full Frame Media"
              required
              className={`mt-1 ${fieldClass}`}
            />
          </div>

          <div>
            <Label className="text-xs text-zinc-300">Ordering Website URL</Label>
            <Input
              value={vendorUrl}
              onChange={(e) => setVendorUrl(e.target.value)}
              placeholder="https://vendor.com/order"
              type="url"
              className={`mt-1 ${fieldClass}`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-zinc-300">Contact Email</Label>
              <Input
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
                placeholder="orders@vendor.com"
                type="email"
                className={`mt-1 ${fieldClass}`}
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-300">Phone</Label>
              <Input
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
                placeholder="(214) 555-0199"
                className={`mt-1 ${fieldClass}`}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-zinc-300">Default Package / Order Notes</Label>
            <Input
              value={vendorNotes}
              onChange={(e) => setVendorNotes(e.target.value)}
              placeholder="e.g. 25 HDR + Aerial Drone package"
              className={`mt-1 ${fieldClass}`}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditingVendor(false)}
              className="h-8 text-xs text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSavingVendor || !vendorName.trim()}
              className="h-8 bg-[var(--color-gold)] text-xs font-semibold text-black hover:bg-[#dcc487]"
            >
              {isSavingVendor ? 'Saving...' : 'Save Vendor'}
            </Button>
          </div>
        </form>
      ) : vendors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-5 text-center">
          <p className="text-xs text-zinc-300 font-medium">No external photographer saved</p>
          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            Add your photographer to quickly open their ordering portal and dispatch order emails
            directly from Mission Control.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={openNewVendorForm}
            className="mt-3 h-8 bg-[var(--color-gold)] text-xs font-semibold text-black hover:bg-[#dcc487]"
          >
            + Add Photographer
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {vendors.map((v) => (
            <div
              key={v.id}
              className="rounded-lg border border-[var(--color-border)] bg-[#161616] p-4 text-xs space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white text-sm">{v.name}</p>
                  {v.website_url ? (
                    <a
                      href={v.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--color-gold)] hover:underline mt-0.5"
                    >
                      <span>{v.website_url.replace(/^https?:\/\//, '')}</span>
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditVendorForm(v)}
                    className="h-7 px-2 text-[11px] text-zinc-300 hover:text-white"
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setVendorToDelete(v)}
                    className="h-7 px-2 text-[11px] text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {(v.email || v.phone) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-400 border-t border-[var(--color-border)]/50 pt-2 text-[11px]">
                  {v.email && <span>Email: {v.email}</span>}
                  {v.phone && <span>Phone: {v.phone}</span>}
                </div>
              )}

              {v.notes && (
                <p className="text-[11px] text-zinc-400 italic">Package note: {v.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(vendorToDelete)}
        onOpenChange={(open) => !open && setVendorToDelete(null)}
        title="Remove preferred photographer?"
        description={`Remove ${vendorToDelete?.name ?? 'this photographer'} from your preferred vendors?`}
        confirmLabel="Remove photographer"
        variant="destructive"
        isLoading={isDeletingVendor}
        onConfirm={confirmDeleteVendor}
      />
    </div>
  )
}

export function GmailDispatchSection() {
  const [gmailStatus, setGmailStatus] = useState<GmailCredentialsStatus>({
    is_configured: false,
    gmail_email: null,
  })
  const [gmailEmail, setGmailEmail] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingGmail, setIsSavingGmail] = useState(false)
  const [gmailError, setGmailError] = useState<string | null>(null)
  const [gmailSuccess, setGmailSuccess] = useState<string | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  const loadGmailStatus = useCallback(async () => {
    setIsLoading(true)
    setGmailError(null)
    try {
      const status = await fetchGmailCredentialsStatus()
      setGmailStatus(status)
      if (status.gmail_email) {
        setGmailEmail(status.gmail_email)
      }
    } catch (err) {
      console.error('Failed to load Gmail credentials status:', err)
      setGmailError(err instanceof Error ? err.message : 'Failed to load Gmail settings')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadGmailStatus()
  }, [loadGmailStatus])

  const handleConnectGmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setGmailError(null)
    setGmailSuccess(null)
    if (!gmailEmail.trim() || !appPassword.trim()) {
      setGmailError('Please enter both your Gmail address and 16-character App Password.')
      return
    }

    setIsSavingGmail(true)
    try {
      const res = await saveGmailCredentials(gmailEmail.trim(), appPassword.trim())
      setGmailStatus({
        is_configured: true,
        gmail_email: res.gmail_email,
      })
      setGmailSuccess('Gmail connected successfully via secure SMTP!')
      setAppPassword('')
    } catch (err) {
      setGmailError(err instanceof Error ? err.message : 'Failed to connect Gmail')
    } finally {
      setIsSavingGmail(false)
    }
  }

  const confirmDisconnectGmail = async () => {
    setIsSavingGmail(true)
    setGmailError(null)
    setGmailSuccess(null)
    try {
      await deleteGmailCredentials()
      setGmailStatus({ is_configured: false, gmail_email: null })
      setGmailSuccess('Gmail disconnected. Orders will now be sent via LocalPRO Hub.')
    } catch (err) {
      setGmailError(err instanceof Error ? err.message : 'Failed to disconnect Gmail')
    } finally {
      setIsSavingGmail(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[#101010] p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 pb-3">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-[var(--color-gold)]" />
          <h4 className="text-sm font-semibold text-white">Gmail Order Dispatch</h4>
        </div>

        {/* Info Icon with Popover / Modal Guidance */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTooltip((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-gold)] hover:underline"
          >
            <Info className="size-3.5" />
            <span>How this works</span>
          </button>
        </div>
      </div>

      {/* Interactive Info / Tooltip Box */}
      {showTooltip && (
        <div className="rounded-lg border border-[var(--color-gold)]/30 bg-[#17150e] p-3.5 text-xs text-zinc-300 space-y-2.5 relative">
          <button
            type="button"
            onClick={() => setShowTooltip(false)}
            className="absolute top-2 right-2 text-zinc-400 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
          <p className="font-semibold text-white">
            This is completely optional &mdash; skip it and LocalPRO Hub will send vendor emails
            on your behalf automatically.
          </p>
          <p className="leading-relaxed">
            <strong className="text-white">Why connect Gmail?</strong>
            <br />
            Connecting an App Password allows order emails to be sent directly from your own
            Google address, so vendor replies land straight in your inbox and the sent email
            appears in your Gmail Sent folder.
          </p>
          <div className="leading-relaxed space-y-1">
            <strong className="text-white">How to create an App Password in 1 minute:</strong>
            <ol className="list-decimal pl-4 space-y-0.5 text-zinc-300">
              <li>
                Go to your <strong className="text-white">Google Account &gt; Security</strong>.
              </li>
              <li>
                Under <em>How you sign in to Google</em>, select{' '}
                <strong className="text-white">2-Step Verification &gt; App Passwords</strong>.
              </li>
              <li>
                Name it <em>&ldquo;LocalPRO Hub&rdquo;</em> and copy the generated 16-letter code.
              </li>
            </ol>
          </div>
          <p className="text-[11px] text-[var(--color-gold)]/90 border-t border-[var(--color-gold)]/20 pt-2 flex items-start gap-1.5">
            <Lock className="size-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>Security Guarantee</strong>: Your App Password is encrypted at rest using
              AES-256 before being stored. It is never logged, never returned in API responses,
              and is used solely to dispatch vendor order emails you explicitly trigger.
            </span>
          </p>
        </div>
      )}

      {gmailError && <p className="text-xs text-red-300">{gmailError}</p>}
      {gmailSuccess && <p className="text-xs text-emerald-300">{gmailSuccess}</p>}

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-xs text-[var(--color-text-secondary)]">
          <Loader2 className="mr-2 size-4 animate-spin text-[var(--color-gold)]" />
          Checking Gmail status...
        </div>
      ) : gmailStatus.is_configured ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs">
            <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-300 text-sm">Gmail Connected</p>
              <p className="text-zinc-400 mt-0.5">
                Orders will be sent directly from{' '}
                <strong className="text-white">{gmailStatus.gmail_email}</strong>.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSavingGmail}
              onClick={() => setShowDisconnectConfirm(true)}
              className="h-8 text-xs text-red-300 border-red-500/30 hover:bg-red-500/10"
            >
              {isSavingGmail ? 'Disconnecting...' : 'Disconnect Gmail'}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleConnectGmail} className="space-y-3 text-xs">
          <p className="text-zinc-400 text-[11px]">
            Enter your Gmail address and 16-letter App Password to send vendor orders directly
            from your mailbox.
          </p>

          <div>
            <Label className="text-xs text-zinc-300">Gmail Address</Label>
            <Input
              value={gmailEmail}
              onChange={(e) => setGmailEmail(e.target.value)}
              placeholder="yourname@gmail.com"
              type="email"
              required
              className={`mt-1 ${fieldClass}`}
            />
          </div>

          <div>
            <Label className="text-xs text-zinc-300">Google App Password (16 letters)</Label>
            <Input
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="abcd efgh ijkl mnop"
              type="password"
              required
              className={`mt-1 ${fieldClass}`}
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
              <Lock className="size-3" /> Encrypted at rest
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={isSavingGmail || !gmailEmail.trim() || !appPassword.trim()}
              className="h-8 bg-[var(--color-gold)] text-xs font-semibold text-black hover:bg-[#dcc487]"
            >
              {isSavingGmail ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                'Connect & Test'
              )}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={showDisconnectConfirm}
        onOpenChange={setShowDisconnectConfirm}
        title="Disconnect Gmail?"
        description="Disconnect your Gmail App Password? Order emails will be sent via LocalPRO Hub instead of your personal Gmail account."
        confirmLabel="Disconnect Gmail"
        variant="destructive"
        isLoading={isSavingGmail}
        onConfirm={confirmDisconnectGmail}
      />
    </div>
  )
}

export function ExternalVendorsSection() {
  return (
    <div className="space-y-6">
      <PhotographerVendorsSection />
      <GmailDispatchSection />
    </div>
  )
}
