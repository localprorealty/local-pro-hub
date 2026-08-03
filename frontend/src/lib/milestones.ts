import { api } from '@/lib/api'

export type MilestoneType =
  | 'agent_birthday'
  | 'work_anniversary'
  | 'wedding_anniversary'
  | 'spouse_birthday'
  | 'child_birthday'
  | 'home_purchase_anniversary'
  | 'license_renewal'
  | 'custom'

export type AgentMilestone = {
  id?: string
  user_id?: string
  milestone_type: MilestoneType
  event_date: string
  person_name: string | null
  custom_label: string | null
  send_lead_days: number
  notes: string | null
  created_at?: string
  updated_at?: string
}

export type MilestoneFormRow = {
  clientId: string
  milestone_type: MilestoneType
  event_date: string
  person_name: string
  custom_label: string
  send_lead_days: string
  notes: string
}

export type AutomationEmailTemplate = {
  id: string
  milestone_type: MilestoneType
  subject_template: string
  html_body: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const MILESTONE_TYPE_OPTIONS: { value: MilestoneType; label: string }[] = [
  { value: 'agent_birthday', label: 'Agent birthday' },
  { value: 'work_anniversary', label: 'Work anniversary' },
  { value: 'wedding_anniversary', label: 'Wedding anniversary' },
  { value: 'spouse_birthday', label: 'Spouse birthday' },
  { value: 'child_birthday', label: 'Child birthday' },
  { value: 'home_purchase_anniversary', label: 'Home purchase anniversary' },
  { value: 'license_renewal', label: 'License renewal reminder' },
  { value: 'custom', label: 'Other milestone' },
]

export function milestoneTypeLabel(type: MilestoneType): string {
  return MILESTONE_TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? type
}

export function newMilestoneRow(): MilestoneFormRow {
  return {
    clientId: crypto.randomUUID(),
    milestone_type: 'agent_birthday',
    event_date: '',
    person_name: '',
    custom_label: '',
    send_lead_days: '0',
    notes: '',
  }
}

export function milestoneToFormRow(row: AgentMilestone): MilestoneFormRow {
  return {
    clientId: row.id ?? crypto.randomUUID(),
    milestone_type: row.milestone_type,
    event_date: row.event_date,
    person_name: row.person_name ?? '',
    custom_label: row.custom_label ?? '',
    send_lead_days: String(row.send_lead_days ?? 0),
    notes: row.notes ?? '',
  }
}

export function validateMilestoneRows(rows: MilestoneFormRow[]): string | null {
  for (const row of rows) {
    if (!row.event_date) {
      return 'Each milestone needs a date.'
    }
    if (row.milestone_type === 'custom' && !row.custom_label.trim()) {
      return 'Other milestones need a custom label.'
    }
    if (
      (row.milestone_type === 'child_birthday' ||
        row.milestone_type === 'spouse_birthday') &&
      !row.person_name.trim()
    ) {
      return 'Child and spouse birthdays need a person name.'
    }
    if (
      row.milestone_type === 'home_purchase_anniversary' &&
      !row.custom_label.trim()
    ) {
      return 'Home purchase anniversaries need an address or label.'
    }
    const lead = Number(row.send_lead_days)
    if (!Number.isFinite(lead) || lead < 0 || lead > 365) {
      return 'Send lead days must be between 0 and 365.'
    }
  }
  return null
}

export function formRowsToPayload(rows: MilestoneFormRow[]): Omit<AgentMilestone, 'id'>[] {
  return rows.map((row) => ({
    milestone_type: row.milestone_type,
    event_date: row.event_date,
    person_name: row.person_name.trim() || null,
    custom_label: row.custom_label.trim() || null,
    send_lead_days: Number(row.send_lead_days) || 0,
    notes: row.notes.trim() || null,
  }))
}

export async function fetchUserMilestones(userId: string): Promise<AgentMilestone[]> {
  return api<AgentMilestone[]>(`/admin/users/${userId}/milestones`)
}

export async function replaceUserMilestones(
  userId: string,
  milestones: Omit<AgentMilestone, 'id' | 'user_id' | 'created_at' | 'updated_at'>[],
): Promise<AgentMilestone[]> {
  return api<AgentMilestone[]>(`/admin/users/${userId}/milestones`, {
    method: 'PUT',
    body: { milestones },
  })
}

export async function fetchMilestoneCounts(
  userIds: string[],
): Promise<Record<string, number>> {
  if (userIds.length === 0) return {}
  return api<Record<string, number>>(
    `/admin/milestone-counts?user_ids=${encodeURIComponent(userIds.join(','))}`,
  )
}

export async function fetchAutomationTemplates(): Promise<AutomationEmailTemplate[]> {
  return api<AutomationEmailTemplate[]>('/admin/automation-templates')
}

export async function patchAutomationTemplate(
  milestoneType: MilestoneType,
  patch: Partial<Pick<AutomationEmailTemplate, 'subject_template' | 'html_body' | 'is_active'>>,
): Promise<AutomationEmailTemplate> {
  return api<AutomationEmailTemplate>(`/admin/automation-templates/${milestoneType}`, {
    method: 'PATCH',
    body: patch,
  })
}

export type MilestoneSendLogRow = {
  log_id: string
  sent_on: string
  sent_at: string
  agent_name: string
  agent_email: string
  milestone_type: MilestoneType
  person_name: string | null
  custom_label: string | null
  event_date: string
}

export const PREVIEW_TEMPLATE_VARS: Record<string, string> = {
  agent_name: 'Adarsh Gella',
  person_name: 'Emma',
  custom_label: '123 Richardson St',
  years: '5',
  event_date: '2000-06-10',
  milestone_type: 'agent_birthday',
}

export function renderEmailTemplate(
  template: string,
  vars: Record<string, string> = PREVIEW_TEMPLATE_VARS,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

export async function fetchMilestoneSendsToday(
  onDate?: string,
): Promise<MilestoneSendLogRow[]> {
  const query = onDate ? `?date=${encodeURIComponent(onDate)}` : ''
  return api<MilestoneSendLogRow[]>(`/admin/automations/sends-today${query}`)
}

export async function runMilestoneAutomation(
  force = true,
): Promise<{ ok: boolean; skipped?: boolean; reason?: string; error?: string }> {
  return api('/admin/automations/run-milestones', {
    method: 'POST',
    body: { force },
  })
}
