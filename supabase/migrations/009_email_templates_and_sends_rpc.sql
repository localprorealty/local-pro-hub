-- Richer email templates + sends log RPC for Admin UI (does NOT send any emails)
-- Safe to run: only UPDATEs template HTML and CREATEs SQL functions for the dashboard.

-- ---------------------------------------------------------------------------
-- get_milestones_due_on — add p_force for admin manual run (skip dedup)
-- ---------------------------------------------------------------------------
create or replace function public.get_milestones_due_on(
  target_date date default current_date,
  p_force boolean default false
)
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
    and (
      p_force
      or not exists (
        select 1 from public.milestone_email_log l
        where l.milestone_id = m.id
          and l.sent_on = target_date
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- Today's sent milestone emails (admin dashboard + n8n summary)
-- ---------------------------------------------------------------------------
create or replace function public.get_milestone_sends_for_date(
  target_date date default current_date
)
returns table (
  log_id uuid,
  sent_on date,
  sent_at timestamptz,
  agent_name text,
  agent_email text,
  milestone_type public.milestone_type,
  person_name text,
  custom_label text,
  event_date date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id as log_id,
    l.sent_on,
    l.created_at as sent_at,
    coalesce(u.full_name, u.email) as agent_name,
    u.email as agent_email,
    m.milestone_type,
    m.person_name,
    m.custom_label,
    m.event_date
  from public.milestone_email_log l
  join public.agent_milestones m on m.id = l.milestone_id
  join public.users u on u.id = l.user_id
  where l.sent_on = target_date
  order by l.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Richer default HTML templates
-- ---------------------------------------------------------------------------
update public.automation_email_templates set
  subject_template = 'Happy Birthday, {{agent_name}}! 🎂',
  html_body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fff8f6;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f6;"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(180,60,60,0.12);"><tr><td style="background:linear-gradient(90deg,#fecaca 0%,#fde68a 50%,#fecaca 100%);padding:14px;text-align:center;font-size:22px;letter-spacing:4px;">🎈 🎂 🎁</td></tr><tr><td style="padding:40px 36px 24px;text-align:center;font-family:Georgia,''Times New Roman'',serif;"><p style="margin:0 0 8px;font-size:14px;letter-spacing:6px;color:#92400e;font-weight:bold;">HAPPY</p><h1 style="margin:0 0 20px;font-size:42px;font-weight:normal;color:#7c2d12;font-style:italic;line-height:1.1;">Birthday</h1><p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#57534e;font-family:Arial,sans-serif;">Wishing you a day filled with love, surprises, and the realization of all your dreams.</p></td></tr><tr><td style="padding:0 36px 32px;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#44403c;"><p style="margin:0 0 16px;">Dear <strong>{{agent_name}}</strong>,</p><p style="margin:0 0 16px;">The whole <strong>LocalPRO Realty</strong> family is celebrating you today. Thank you for everything you do for our clients, your colleagues, and our community.</p><p style="margin:0;">With warm wishes,<br><span style="color:#b45309;">LocalPRO Hub · Local Pro Realty</span></p></td></tr><tr><td style="background:#fef2f2;padding:20px;text-align:center;font-size:28px;">🎂 🎈 🎉</td></tr></table></td></tr></table></body></html>'
where milestone_type = 'agent_birthday';

update public.automation_email_templates set
  subject_template = 'Congratulations on your {{years}}-year anniversary, {{agent_name}}!',
  html_body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1a1a1a;border-radius:8px;border-top:4px solid #CFB87C;"><tr><td style="padding:40px 36px;font-family:Arial,sans-serif;color:#ffffff;"><p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;color:#CFB87C;text-transform:uppercase;">Work Anniversary</p><h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:28px;color:#CFB87C;font-weight:normal;">{{years}} Years of Excellence</h1><p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#e5e5e5;">Dear <strong>{{agent_name}}</strong>,</p><p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#d4d4d4;">Today marks <strong style="color:#CFB87C;">{{years}} years</strong> with LocalPRO Realty. Your dedication, professionalism, and commitment to our clients make a lasting difference.</p><p style="margin:0;font-size:12px;color:#888;margin-top:32px;">LocalPRO Hub · Local Pro Realty</p></td></tr></table></td></tr></table></body></html>'
where milestone_type = 'work_anniversary';

update public.automation_email_templates set
  subject_template = 'Happy Birthday to {{person_name}}! 🎈',
  html_body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fff8f6;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f6;"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(59,130,246,0.1);"><tr><td style="background:linear-gradient(90deg,#bfdbfe,#fde68a,#fbcfe8);padding:14px;text-align:center;font-size:22px;">🎈 🧁 🎁</td></tr><tr><td style="padding:36px;font-family:Arial,sans-serif;text-align:center;"><h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:32px;color:#1e40af;font-style:italic;">Happy Birthday, {{person_name}}!</h1><p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#57534e;">Dear {{agent_name}}, we hope <strong>{{person_name}}</strong> has the most wonderful birthday — full of joy, laughter, and sweet surprises!</p><p style="margin:0;font-size:13px;color:#b45309;">With love from LocalPRO Realty 🎉</p></td></tr></table></td></tr></table></body></html>'
where milestone_type = 'child_birthday';

update public.automation_email_templates set
  subject_template = 'Happy Anniversary, {{agent_name}}! 💛',
  html_body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fffbeb;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #fde68a;"><tr><td style="padding:40px 36px;font-family:Arial,sans-serif;"><h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:28px;color:#b45309;">Happy Anniversary</h1><p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#44403c;">Dear <strong>{{agent_name}}</strong>,</p><p style="margin:0;font-size:15px;line-height:1.7;color:#57534e;">Wishing you and your partner a beautiful wedding anniversary filled with love, laughter, and cherished memories.</p><p style="margin:24px 0 0;font-size:12px;color:#a8a29e;">LocalPRO Hub · Local Pro Realty</p></td></tr></table></td></tr></table></body></html>'
where milestone_type = 'wedding_anniversary';

update public.automation_email_templates set
  subject_template = 'Birthday wishes for {{person_name}} — from LocalPRO',
  html_body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#faf5ff;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;"><tr><td style="padding:40px 36px;font-family:Arial,sans-serif;"><h1 style="margin:0 0 16px;font-size:24px;color:#7c3aed;">🎂 Birthday Wishes</h1><p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#44403c;">Dear <strong>{{agent_name}}</strong>,</p><p style="margin:0;font-size:15px;line-height:1.7;color:#57534e;">Please pass along our warmest birthday wishes to <strong>{{person_name}}</strong> from everyone at LocalPRO Realty.</p></td></tr></table></td></tr></table></body></html>'
where milestone_type = 'spouse_birthday';

update public.automation_email_templates set
  subject_template = '{{years}} years since {{custom_label}}',
  html_body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1a1a1a;border-top:4px solid #CFB87C;"><tr><td style="padding:40px 36px;font-family:Arial,sans-serif;color:#fff;"><h1 style="margin:0 0 16px;color:#CFB87C;font-family:Georgia,serif;">Home Anniversary</h1><p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#e5e5e5;">Dear <strong>{{agent_name}}</strong>,</p><p style="margin:0;font-size:15px;line-height:1.7;color:#d4d4d4;">It has been <strong style="color:#CFB87C;">{{years}} years</strong> since <strong>{{custom_label}}</strong>. We hope that home continues to bring you wonderful memories.</p></td></tr></table></td></tr></table></body></html>'
where milestone_type = 'home_purchase_anniversary';

update public.automation_email_templates set
  subject_template = 'License renewal reminder — {{agent_name}}',
  html_body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-left:4px solid #64748b;"><tr><td style="padding:40px 36px;font-family:Arial,sans-serif;"><h1 style="margin:0 0 16px;font-size:22px;color:#334155;">License Renewal Reminder</h1><p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#44403c;">Dear <strong>{{agent_name}}</strong>,</p><p style="margin:0;font-size:15px;line-height:1.7;color:#57534e;">This is a friendly reminder to keep your TREC license current. Please complete your renewal before the deadline.</p></td></tr></table></td></tr></table></body></html>'
where milestone_type = 'license_renewal';

update public.automation_email_templates set
  subject_template = '{{custom_label}} — thinking of you, {{agent_name}}',
  html_body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1a1a1a;border-top:4px solid #CFB87C;"><tr><td style="padding:40px 36px;font-family:Arial,sans-serif;color:#fff;"><h1 style="margin:0 0 16px;color:#CFB87C;">{{custom_label}}</h1><p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#e5e5e5;">Dear <strong>{{agent_name}}</strong>,</p><p style="margin:0;font-size:15px;line-height:1.7;color:#d4d4d4;">We are thinking of you on this special day — <strong>{{custom_label}}</strong>.</p></td></tr></table></td></tr></table></body></html>'
where milestone_type = 'custom';
