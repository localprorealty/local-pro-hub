import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, Play, RefreshCw } from 'lucide-react'

import { EmailTemplatePreviewDialog } from '@/components/admin/EmailTemplatePreviewDialog'
import { AdminShell } from '@/components/admin/AdminShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fetchAutomationTemplates,
  fetchMilestoneSendsToday,
  milestoneTypeLabel,
  patchAutomationTemplate,
  runMilestoneAutomation,
  type AutomationEmailTemplate,
  type MilestoneSendLogRow,
  type MilestoneType,
} from '@/lib/milestones'

const fieldClass =
  'rounded-sm border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)]'

function formatSentAt(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return value
  }
}

function AdminAutomationsContent() {
  const [templates, setTemplates] = useState<AutomationEmailTemplate[]>([])
  const [sendsToday, setSendsToday] = useState<MilestoneSendLogRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [savingType, setSavingType] = useState<MilestoneType | null>(null)
  const [previewType, setPreviewType] = useState<MilestoneType | null>(null)
  const [drafts, setDrafts] = useState<
    Record<string, { subject_template: string; html_body: string }>
  >({})

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [rows, sends] = await Promise.all([
        fetchAutomationTemplates(),
        fetchMilestoneSendsToday(),
      ])
      setTemplates(rows)
      setSendsToday(sends)
      const nextDrafts: Record<string, { subject_template: string; html_body: string }> = {}
      for (const row of rows) {
        nextDrafts[row.milestone_type] = {
          subject_template: row.subject_template,
          html_body: row.html_body,
        }
      }
      setDrafts(nextDrafts)
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : 'Failed to load automations.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleToggle = async (template: AutomationEmailTemplate) => {
    setSavingType(template.milestone_type)
    setError(null)
    setSuccess(null)
    try {
      const updated = await patchAutomationTemplate(template.milestone_type, {
        is_active: !template.is_active,
      })
      setTemplates((prev) =>
        prev.map((row) => (row.milestone_type === updated.milestone_type ? updated : row)),
      )
      setSuccess(`${milestoneTypeLabel(template.milestone_type)} ${updated.is_active ? 'enabled' : 'disabled'}.`)
    } catch (toggleErr) {
      setError(toggleErr instanceof Error ? toggleErr.message : 'Update failed.')
    } finally {
      setSavingType(null)
    }
  }

  const handleSaveDraft = async (milestoneType: MilestoneType) => {
    const draft = drafts[milestoneType]
    if (!draft) return

    setSavingType(milestoneType)
    setError(null)
    setSuccess(null)
    try {
      const updated = await patchAutomationTemplate(milestoneType, {
        subject_template: draft.subject_template.trim(),
        html_body: draft.html_body.trim(),
      })
      setTemplates((prev) =>
        prev.map((row) => (row.milestone_type === updated.milestone_type ? updated : row)),
      )
      setSuccess(`${milestoneTypeLabel(milestoneType)} template saved.`)
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Save failed.')
    } finally {
      setSavingType(null)
    }
  }

  const handleRunNow = async () => {
    setIsRunning(true)
    setError(null)
    setSuccess(null)
    try {
      await runMilestoneAutomation(true)
      setSuccess('Milestone automation triggered. Refresh in a few seconds for today’s log.')
      window.setTimeout(() => void loadAll(), 4000)
    } catch (runErr) {
      setError(runErr instanceof Error ? runErr.message : 'Run failed.')
    } finally {
      setIsRunning(false)
    }
  }


  const previewDraft = previewType ? drafts[previewType] : null

  return (
    <AdminShell title="Automations" eyebrow="Email templates">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="mb-6 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          Milestone emails run daily at 8am via n8n, or use <strong>Run now</strong> to trigger
          manually. Preview templates with sample data before saving.
        </p>

        <section className="mb-8 flex flex-wrap items-center gap-3 border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <Button
            type="button"
            disabled={isRunning}
            onClick={() => void handleRunNow()}
            className="h-10 rounded-sm bg-[var(--color-gold)] px-4 font-semibold text-[var(--color-black)]"
          >
            <Play className="mr-2 size-4" aria-hidden />
            {isRunning ? 'Triggering...' : 'Run milestone emails now'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => void loadAll()}
            className="h-10 rounded-sm border-[var(--color-border)] text-[var(--color-white)]"
          >
            <RefreshCw className="mr-2 size-4" aria-hidden />
            Refresh log
          </Button>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Requires workflow <strong>Active</strong> in n8n and{' '}
            <code className="text-[var(--color-gold)]">N8N_MILESTONE_WEBHOOK_URL</code> = production
            URL (<code>/webhook/</code> not <code>/webhook-test/</code>)
          </p>
        </section>

        <section className="mb-8 border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-white)]">
            Sent today
          </h2>
          <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
            Logged sends from milestone automations. View only in the app — no admin
            summary email.
          </p>
          {isLoading ? (
            <p className="text-xs text-[var(--color-text-secondary)]">Loading...</p>
          ) : sendsToday.length === 0 ? (
            <p className="text-xs text-[var(--color-text-secondary)]">No milestone emails sent today yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                    <th className="py-2 pr-4 font-medium">Agent</th>
                    <th className="py-2 pr-4 font-medium">Milestone</th>
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Sent at</th>
                    <th className="py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {sendsToday.map((row) => (
                    <tr key={row.log_id} className="border-b border-[var(--color-border)]/50">
                      <td className="py-2 pr-4 text-[var(--color-white)]">{row.agent_name}</td>
                      <td className="py-2 pr-4">{milestoneTypeLabel(row.milestone_type)}</td>
                      <td className="py-2 pr-4">{row.agent_email}</td>
                      <td className="py-2 pr-4">{formatSentAt(row.sent_at)}</td>
                      <td className="py-2 text-[var(--color-text-secondary)]">
                        {row.person_name ? `For ${row.person_name}` : row.custom_label ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
        {success ? <p className="mb-4 text-sm text-emerald-300">{success}</p> : null}

        {isLoading ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading templates...</p>
        ) : (
          <div className="space-y-6">
            {templates.map((template) => {
              const draft = drafts[template.milestone_type]
              return (
                <section
                  key={template.id}
                  className="border-l-2 border-[var(--color-gold)] bg-[var(--color-surface-2)] p-5"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-white)]">
                        {milestoneTypeLabel(template.milestone_type)}
                      </h2>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {template.is_active ? 'Active' : 'Disabled'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPreviewType(template.milestone_type)}
                        className="h-9 rounded-sm border-[var(--color-border)] text-[var(--color-white)]"
                      >
                        <Eye className="mr-1 size-4" aria-hidden />
                        Preview
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={savingType === template.milestone_type}
                        onClick={() => void handleToggle(template)}
                        className="h-9 rounded-sm border-[var(--color-border)] text-[var(--color-white)]"
                      >
                        {template.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>

                  {draft ? (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs uppercase text-[var(--color-text-secondary)]">
                          Subject
                        </Label>
                        <Input
                          value={draft.subject_template}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [template.milestone_type]: {
                                ...prev[template.milestone_type]!,
                                subject_template: e.target.value,
                              },
                            }))
                          }
                          className={`mt-1 h-10 ${fieldClass}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs uppercase text-[var(--color-text-secondary)]">
                          HTML body
                        </Label>
                        <textarea
                          value={draft.html_body}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [template.milestone_type]: {
                                ...prev[template.milestone_type]!,
                                html_body: e.target.value,
                              },
                            }))
                          }
                          rows={8}
                          className={`mt-1 w-full p-3 font-mono text-xs ${fieldClass}`}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={savingType === template.milestone_type}
                          onClick={() => void handleSaveDraft(template.milestone_type)}
                          className="h-9 rounded-sm bg-[var(--color-gold)] px-4 font-semibold text-[var(--color-black)]"
                        >
                          {savingType === template.milestone_type ? 'Saving...' : 'Save template'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPreviewType(template.milestone_type)}
                          className="h-9 rounded-sm border-[var(--color-border)] text-[var(--color-white)]"
                        >
                          <Eye className="mr-1 size-4" aria-hidden />
                          Preview
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        )}

        {previewType && previewDraft ? (
          <EmailTemplatePreviewDialog
            open={Boolean(previewType)}
            onOpenChange={(open) => !open && setPreviewType(null)}
            title={milestoneTypeLabel(previewType)}
            subjectTemplate={previewDraft.subject_template}
            htmlBody={previewDraft.html_body}
          />
        ) : null}
      </motion.div>
    </AdminShell>
  )
}

export default function AdminAutomationsPage() {
  return (
    <ErrorBoundary title="Automations">
      <AdminAutomationsContent />
    </ErrorBoundary>
  )
}
