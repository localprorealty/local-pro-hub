import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Mail, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  fetchGmailCredentialsStatus,
  sendVendorOrderEmail,
  type AgentVendor,
  type GmailCredentialsStatus,
} from '@/lib/vendors'
import { listingSpecsFromForm, type Listing } from '@/lib/listings'

interface VendorOrderEmailModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (method: 'gmail_smtp' | 'resend', recipient: string) => void
  listing: Listing
  vendor: AgentVendor
  agentProfile?: {
    full_name?: string | null
    email?: string | null
    phone?: string | null
  } | null
}

export function VendorOrderEmailModal({
  isOpen,
  onClose,
  onSuccess,
  listing,
  vendor,
  agentProfile,
}: VendorOrderEmailModalProps) {
  const [recipientEmail, setRecipientEmail] = useState(vendor.email || '')
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [markCompleted, setMarkCompleted] = useState(true)
  const [gmailStatus, setGmailStatus] = useState<GmailCredentialsStatus | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // Initialize or re-initialize editable subject & body when opened or vendor/listing changes
  useEffect(() => {
    if (!isOpen) return

    setRecipientEmail(vendor.email || '')
    setSendError(null)

    const defaultSubject = `Photography Order Request — ${listing.address_full || 'New Listing'}`
    setSubject(defaultSubject)

    // Construct sensible default starting template
    const agentName = agentProfile?.full_name || 'Listing Agent'
    const agentPhone = agentProfile?.phone || ''
    const agentEmail = agentProfile?.email || ''

    const specs = listingSpecsFromForm(listing.form_data)
    const specsParts: string[] = []
    if (specs.beds && specs.beds !== '—') specsParts.push(`${specs.beds} Beds`)
    if (specs.baths && specs.baths !== '—') specsParts.push(`${specs.baths} Baths`)
    if (specs.sqft && specs.sqft !== '—') specsParts.push(`${specs.sqft} SqFt`)

    const priceStr = listing.list_price ? `$${listing.list_price.toLocaleString()}` : 'TBD'
    const specsStr = specsParts.length > 0 ? specsParts.join(' | ') : 'Residential Property'

    const defaultBody = [
      `Hi ${vendor.name || 'Team'},`,
      '',
      `I would like to order real estate photography for my upcoming listing:`,
      '',
      `• Property Address: ${listing.address_full || 'Address to follow'}`,
      `• Property Specs: ${specsStr}`,
      `• List Price: ${priceStr}`,
      `• Target Shoot Date: Earliest available / this week`,
      `• Access / Lockbox: Lockbox on front door (combo to follow upon booking confirmation)`,
      '',
      `Special Instructions / Notes:`,
      `Please provide high-resolution interior, exterior, and drone aerial photos if included in package.`,
      '',
      `Please reply with your earliest availability to confirm the shoot time.`,
      '',
      `Thank you,`,
      agentName,
      'LocalPRO Realty',
      agentPhone ? `Phone: ${agentPhone}` : '',
      agentEmail ? `Email: ${agentEmail}` : '',
    ]
      .filter((line) => line !== null && line !== undefined)
      .join('\n')

    setBodyText(defaultBody)
  }, [isOpen, vendor, listing, agentProfile])

  // Check Gmail credential status
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setIsLoadingStatus(true)
    fetchGmailCredentialsStatus()
      .then((status) => {
        if (active) setGmailStatus(status)
      })
      .catch(() => {
        if (active) setGmailStatus({ is_configured: false, gmail_email: null })
      })
      .finally(() => {
        if (active) setIsLoadingStatus(false)
      })
    return () => {
      active = false
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipientEmail.trim()) {
      setSendError('Please enter a recipient email address.')
      return
    }
    if (!subject.trim()) {
      setSendError('Subject cannot be blank.')
      return
    }
    if (!bodyText.trim()) {
      setSendError('Email message cannot be blank.')
      return
    }

    setIsSending(true)
    setSendError(null)

    try {
      const res = await sendVendorOrderEmail(listing.id, {
        vendor_id: vendor.id,
        to_email: recipientEmail.trim(),
        subject: subject.trim(),
        body_text: bodyText,
        mark_completed: markCompleted,
      })

      onSuccess(res.method, res.to_email)
      onClose()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send email.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-sm border border-[var(--color-border)] bg-[#161616] p-4 sm:p-6 shadow-2xl my-4 sm:my-8 max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#CFB87C]/10 text-[#CFB87C]">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-white">
                Send Order Email
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                To: <span className="text-white font-medium">{vendor.name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="rounded-sm p-1 text-[var(--color-text-secondary)] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sender Channel Status Banner */}
        <div className="mt-4 rounded-sm border border-[var(--color-border)] bg-[#111111] p-3 text-xs">
          {isLoadingStatus ? (
            <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking sender connection...
            </div>
          ) : gmailStatus?.is_configured ? (
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Sending directly from your connected Gmail address (
                <strong className="text-white">{gmailStatus.gmail_email}</strong>) via direct SMTP.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span>
                  No Gmail App Password connected. Email will be sent via LocalPRO notification service on your behalf (
                  <strong className="text-white">{agentProfile?.email || 'your profile email'}</strong> set as Reply-To).
                </span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold tracking-wider uppercase text-[var(--color-text-secondary)] mb-1">
              Recipient Email
            </label>
            <input
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="orders@photographer.com"
              className="w-full rounded-sm border border-[var(--color-border)] bg-[#0d0d0d] px-3 py-2 text-sm text-white focus:outline focus:outline-1 focus:outline-[#CFB87C]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wider uppercase text-[var(--color-text-secondary)] mb-1">
              Subject Line <span className="text-[10px] lowercase text-[var(--color-text-secondary)]">(editable)</span>
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-sm border border-[var(--color-border)] bg-[#0d0d0d] px-3 py-2 text-sm text-white focus:outline focus:outline-1 focus:outline-[#CFB87C]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold tracking-wider uppercase text-[var(--color-text-secondary)]">
                Email Message Body <span className="text-[10px] lowercase text-[var(--color-text-secondary)]">(editable)</span>
              </label>
              <span className="text-[11px] text-[#CFB87C]">
                Feel free to add instructions or notes below
              </span>
            </div>
            <textarea
              required
              rows={8}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full rounded-sm border border-[var(--color-border)] bg-[#0d0d0d] p-3 text-xs font-mono leading-relaxed text-white focus:outline focus:outline-1 focus:outline-[#CFB87C] max-h-[260px] sm:max-h-[360px]"
            />
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Whatever you type above is exactly what will be sent to the photographer.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="mark-completed-checkbox"
              checked={markCompleted}
              onChange={(e) => setMarkCompleted(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] bg-[#0d0d0d] text-[#CFB87C] focus:ring-[#CFB87C]"
            />
            <label
              htmlFor="mark-completed-checkbox"
              className="text-xs text-[var(--color-text-secondary)] cursor-pointer"
            >
              Automatically advance listing stage to <strong className="text-white">Shoot Booked</strong> upon sending
            </label>
          </div>

          {sendError && (
            <div className="rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{sendError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <Button
              type="button"
              variant="outline"
              disabled={isSending}
              onClick={onClose}
              className="border-[var(--color-border)] text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSending}
              className="bg-[#CFB87C] font-semibold text-black hover:bg-[#dcc487] flex items-center gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending Email...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Order Email
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
