-- Agent personal milestones (admin-only) + email log + automation templates

-- ---------------------------------------------------------------------------
-- milestone_type enum
-- ---------------------------------------------------------------------------
create type public.milestone_type as enum (
  'agent_birthday',
  'work_anniversary',
  'wedding_anniversary',
  'spouse_birthday',
  'child_birthday',
  'home_purchase_anniversary',
  'license_renewal',
  'custom'
);

-- ---------------------------------------------------------------------------
-- agent_milestones
-- ---------------------------------------------------------------------------
create table public.agent_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  milestone_type public.milestone_type not null,
  event_date date not null,
  person_name text,
  custom_label text,
  send_lead_days int not null default 0 check (send_lead_days >= 0 and send_lead_days <= 365),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agent_milestones_user_id_idx on public.agent_milestones (user_id);
create index agent_milestones_event_date_idx on public.agent_milestones (event_date);

create unique index agent_milestones_unique_idx on public.agent_milestones (
  user_id,
  milestone_type,
  event_date,
  coalesce(person_name, '')
);

-- ---------------------------------------------------------------------------
-- milestone_email_log (dedup n8n daily sends)
-- ---------------------------------------------------------------------------
create table public.milestone_email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  milestone_id uuid not null references public.agent_milestones (id) on delete cascade,
  sent_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (milestone_id, sent_on)
);

create index milestone_email_log_sent_on_idx on public.milestone_email_log (sent_on);

-- ---------------------------------------------------------------------------
-- automation_email_templates (per milestone_type email drafts)
-- ---------------------------------------------------------------------------
create table public.automation_email_templates (
  id uuid primary key default gen_random_uuid(),
  milestone_type public.milestone_type not null unique,
  subject_template text not null,
  html_body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger agent_milestones_updated_at
before update on public.agent_milestones
for each row execute function public.set_updated_at();

create trigger automation_email_templates_updated_at
before update on public.automation_email_templates
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — admin only
-- ---------------------------------------------------------------------------
alter table public.agent_milestones enable row level security;
alter table public.milestone_email_log enable row level security;
alter table public.automation_email_templates enable row level security;

create policy "agent_milestones_admin"
on public.agent_milestones for all
using (public.is_admin());

create policy "milestone_email_log_admin"
on public.milestone_email_log for all
using (public.is_admin());

create policy "automation_email_templates_admin"
on public.automation_email_templates for all
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Default email templates (n8n can also use these via Supabase REST)
-- ---------------------------------------------------------------------------
insert into public.automation_email_templates (milestone_type, subject_template, html_body) values
(
  'agent_birthday',
  'Happy Birthday, {{agent_name}}! 🎂',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#1a1a1a;color:#fff;padding:32px;border-top:4px solid #CFB87C;"><h1 style="color:#CFB87C;margin:0 0 16px;">Happy Birthday!</h1><p>Dear {{agent_name}},</p><p>The whole LocalPRO Realty family wishes you a wonderful birthday. Thank you for everything you do for our clients and community.</p><p style="color:#888;font-size:12px;margin-top:32px;">LocalPRO Hub · Local Pro Realty</p></div>'
),
(
  'work_anniversary',
  'Congratulations on your {{years}}-year anniversary, {{agent_name}}!',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#1a1a1a;color:#fff;padding:32px;border-top:4px solid #CFB87C;"><h1 style="color:#CFB87C;margin:0 0 16px;">Work Anniversary</h1><p>Dear {{agent_name}},</p><p>Today marks <strong>{{years}} years</strong> with LocalPRO Realty. Your dedication and professionalism make a real difference — thank you.</p><p style="color:#888;font-size:12px;margin-top:32px;">LocalPRO Hub · Local Pro Realty</p></div>'
),
(
  'wedding_anniversary',
  'Happy Anniversary, {{agent_name}}!',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#1a1a1a;color:#fff;padding:32px;border-top:4px solid #CFB87C;"><h1 style="color:#CFB87C;margin:0 0 16px;">Happy Anniversary</h1><p>Dear {{agent_name}},</p><p>Wishing you and your partner a beautiful wedding anniversary filled with joy.</p><p style="color:#888;font-size:12px;margin-top:32px;">LocalPRO Hub · Local Pro Realty</p></div>'
),
(
  'spouse_birthday',
  'A birthday wish for {{person_name}} — from LocalPRO Realty',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#1a1a1a;color:#fff;padding:32px;border-top:4px solid #CFB87C;"><h1 style="color:#CFB87C;margin:0 0 16px;">Birthday Wishes</h1><p>Dear {{agent_name}},</p><p>Please pass along our warmest birthday wishes to <strong>{{person_name}}</strong> from everyone at LocalPRO Realty.</p><p style="color:#888;font-size:12px;margin-top:32px;">LocalPRO Hub · Local Pro Realty</p></div>'
),
(
  'child_birthday',
  'Happy Birthday to {{person_name}}! 🎈',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#1a1a1a;color:#fff;padding:32px;border-top:4px solid #CFB87C;"><h1 style="color:#CFB87C;margin:0 0 16px;">Happy Birthday, {{person_name}}!</h1><p>Dear {{agent_name}},</p><p>Wishing <strong>{{person_name}}</strong> a fantastic birthday full of fun and celebration!</p><p style="color:#888;font-size:12px;margin-top:32px;">LocalPRO Hub · Local Pro Realty</p></div>'
),
(
  'home_purchase_anniversary',
  '{{years}} years since {{custom_label}} — {{agent_name}}',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#1a1a1a;color:#fff;padding:32px;border-top:4px solid #CFB87C;"><h1 style="color:#CFB87C;margin:0 0 16px;">Home Anniversary</h1><p>Dear {{agent_name}},</p><p>It has been <strong>{{years}} years</strong> since <strong>{{custom_label}}</strong>. We hope that home has brought you many wonderful memories.</p><p style="color:#888;font-size:12px;margin-top:32px;">LocalPRO Hub · Local Pro Realty</p></div>'
),
(
  'license_renewal',
  'License renewal reminder — {{agent_name}}',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#1a1a1a;color:#fff;padding:32px;border-top:4px solid #CFB87C;"><h1 style="color:#CFB87C;margin:0 0 16px;">License Renewal Reminder</h1><p>Dear {{agent_name}},</p><p>This is a friendly reminder about your upcoming license renewal date. Please ensure your TREC license stays current.</p><p style="color:#888;font-size:12px;margin-top:32px;">LocalPRO Hub · Local Pro Realty</p></div>'
),
(
  'custom',
  '{{custom_label}} — {{agent_name}}',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#1a1a1a;color:#fff;padding:32px;border-top:4px solid #CFB87C;"><h1 style="color:#CFB87C;margin:0 0 16px;">{{custom_label}}</h1><p>Dear {{agent_name}},</p><p>We are thinking of you on this special day — <strong>{{custom_label}}</strong>.</p><p style="color:#888;font-size:12px;margin-top:32px;">LocalPRO Hub · Local Pro Realty</p></div>'
);

-- ---------------------------------------------------------------------------
-- RPC: upcoming milestones for n8n (service role / SQL editor)
-- Matches event_date month-day to target_date + send_lead_days offset
-- ---------------------------------------------------------------------------
create or replace function public.get_milestones_due_on(target_date date default current_date)
returns table (
  milestone_id uuid,
  user_id uuid,
  agent_email text,
  agent_name text,
  milestone_type public.milestone_type,
  event_date date,
  person_name text,
  custom_label text,
  years_elapsed int,
  subject_template text,
  html_body text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id as milestone_id,
    m.user_id,
    u.email as agent_email,
    coalesce(u.full_name, u.email) as agent_name,
    m.milestone_type,
    m.event_date,
    m.person_name,
    m.custom_label,
    extract(year from age(target_date, m.event_date))::int as years_elapsed,
    t.subject_template,
    t.html_body
  from public.agent_milestones m
  join public.users u on u.id = m.user_id
  join public.automation_email_templates t on t.milestone_type = m.milestone_type and t.is_active = true
  where u.status = 'active'
    and u.role = 'agent'
    and to_char(m.event_date, 'MM-DD') = to_char(target_date + m.send_lead_days, 'MM-DD')
    and not exists (
      select 1 from public.milestone_email_log l
      where l.milestone_id = m.id
        and l.sent_on = target_date
    );
$$;
