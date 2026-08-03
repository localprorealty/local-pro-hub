-- LocalPRO Hub — initial schema
-- Run in Supabase SQL Editor or via: supabase db push

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users (profile extends auth.users)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  full_name text,
  phone text,
  mls_id text,
  license_number text,
  role text check (role in ('agent', 'admin', 'photographer')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  photographer_tier text check (photographer_tier in ('elite', 'standard', 'basic')),
  dotloop_access_token text,
  dotloop_refresh_token text,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.users (id)
);

create index users_email_idx on public.users (email);
create index users_role_idx on public.users (role);
create index users_status_idx on public.users (status);

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.users (id) on delete cascade,
  listing_type text not null check (listing_type in ('listing', 'buyer', 'lease')),
  stage text not null default 'draft' check (
    stage in (
      'draft',
      'docs_pending',
      'docs_signed',
      'shoot_booked',
      'marketing',
      'mls_submitted',
      'live',
      'closed'
    )
  ),
  address_full text,
  mls_number text,
  list_price numeric,
  reso_data jsonb,
  form_data jsonb,
  dotloop_loop_id text,
  go_live_date date,
  went_live_at timestamptz,
  description_generated text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_agent_id_idx on public.listings (agent_id);
create index listings_stage_idx on public.listings (stage);

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  photographer_id uuid references public.users (id) on delete set null,
  shoot_date date,
  shoot_time time,
  status text not null default 'pending' check (
    status in ('pending', 'confirmed', 'completed', 'cancelled')
  ),
  access_notes text,
  agent_notified_at timestamptz,
  photographer_notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index bookings_listing_id_idx on public.bookings (listing_id);
create index bookings_photographer_id_idx on public.bookings (photographer_id);

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete cascade,
  doc_type text not null,
  dotloop_document_id text,
  status text not null default 'draft' check (
    status in ('draft', 'sent', 'viewed', 'signed', 'expired')
  ),
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create index documents_listing_id_idx on public.documents (listing_id);

-- ---------------------------------------------------------------------------
-- marketing_requests
-- ---------------------------------------------------------------------------
create table public.marketing_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete cascade,
  asset_type text not null,
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'done')
  ),
  stripe_payment_id text,
  notified_at timestamptz,
  canva_link text,
  created_at timestamptz not null default now()
);

create index marketing_requests_listing_id_idx on public.marketing_requests (listing_id);

-- ---------------------------------------------------------------------------
-- photographers (extends users)
-- ---------------------------------------------------------------------------
create table public.photographers (
  id uuid primary key references public.users (id) on delete cascade,
  tier text check (tier in ('elite', 'standard', 'basic')),
  blocked_dates jsonb not null default '[]'::jsonb,
  bio text
);

-- ---------------------------------------------------------------------------
-- marketing_team_members
-- ---------------------------------------------------------------------------
create table public.marketing_team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  notification_group text not null check (
    notification_group in ('social', 'print', 'video')
  ),
  active boolean not null default true
);

create index marketing_team_members_user_id_idx on public.marketing_team_members (user_id);

-- ---------------------------------------------------------------------------
-- canva_templates
-- ---------------------------------------------------------------------------
create table public.canva_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  asset_type text not null,
  canva_url text,
  price_cents integer not null default 0,
  active boolean not null default true,
  tags text[] not null default '{}',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
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

create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- auth.users → public.users profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helper: current user role
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.listings enable row level security;
alter table public.bookings enable row level security;
alter table public.documents enable row level security;
alter table public.marketing_requests enable row level security;
alter table public.photographers enable row level security;
alter table public.marketing_team_members enable row level security;
alter table public.canva_templates enable row level security;

-- users
create policy "users_select_own"
on public.users for select
using (auth.uid() = id);

create policy "users_update_own"
on public.users for update
using (auth.uid() = id);

create policy "users_select_admin"
on public.users for select
using (public.is_admin());

create policy "users_update_admin"
on public.users for update
using (public.is_admin());

-- listings
create policy "listings_select_own"
on public.listings for select
using (auth.uid() = agent_id);

create policy "listings_insert_own"
on public.listings for insert
with check (auth.uid() = agent_id);

create policy "listings_update_own"
on public.listings for update
using (auth.uid() = agent_id);

create policy "listings_select_admin"
on public.listings for select
using (public.is_admin());

create policy "listings_update_admin"
on public.listings for update
using (public.is_admin());

-- documents
create policy "documents_via_listing"
on public.documents for all
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and (l.agent_id = auth.uid() or public.is_admin())
  )
);

-- bookings
create policy "bookings_agent_listing"
on public.bookings for select
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and l.agent_id = auth.uid()
  )
  or photographer_id = auth.uid()
  or public.is_admin()
);

create policy "bookings_agent_insert"
on public.bookings for insert
with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and l.agent_id = auth.uid()
  )
);

create policy "bookings_photographer_update"
on public.bookings for update
using (photographer_id = auth.uid() or public.is_admin());

-- marketing_requests
create policy "marketing_requests_via_listing"
on public.marketing_requests for all
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and (l.agent_id = auth.uid() or public.is_admin())
  )
);

-- photographers (read for agents; self for photographer)
create policy "photographers_read_authenticated"
on public.photographers for select
to authenticated
using (true);

create policy "photographers_update_self"
on public.photographers for update
using (auth.uid() = id or public.is_admin());

-- marketing_team_members (admin only)
create policy "marketing_team_admin"
on public.marketing_team_members for all
using (public.is_admin());

-- canva_templates (read active for authenticated; write admin)
create policy "canva_templates_read"
on public.canva_templates for select
to authenticated
using (active = true or public.is_admin());

create policy "canva_templates_admin_write"
on public.canva_templates for all
using (public.is_admin());
