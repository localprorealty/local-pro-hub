-- Allow admin-managed "marketing" role and provide a safe bootstrap helper.

alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('agent', 'admin', 'photographer', 'marketing'));

-- Normalize existing active users that were approved without an assigned role.
update public.users
set role = 'agent'
where status = 'active' and role is null;

-- Optional one-time bootstrap helper:
-- Replace with your real admin email and run this ONCE in SQL editor.
-- update public.users
-- set role = 'admin', status = 'active', approved_at = now()
-- where email = 'you@localprorealty.com';
