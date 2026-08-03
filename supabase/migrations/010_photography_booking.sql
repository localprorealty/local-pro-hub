-- Photography booking — extend bookings status + photographer sync

-- Allow photographer-suggested alternate dates
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check check (
  status in ('pending', 'confirmed', 'completed', 'cancelled', 'alt_suggested')
);

alter table public.bookings
  add column if not exists suggested_alternate jsonb;

-- Ensure photographer profile rows exist for active photographers
insert into public.photographers (id, tier, blocked_dates, bio)
select
  u.id,
  coalesce(u.photographer_tier, 'standard'),
  '[]'::jsonb,
  null
from public.users u
where u.role = 'photographer'
  and u.status = 'active'
on conflict (id) do update
set tier = coalesce(excluded.tier, public.photographers.tier);

-- Agents may update bookings on their own listings (e.g. accept alternate)
drop policy if exists "bookings_agent_update" on public.bookings;
create policy "bookings_agent_update"
on public.bookings for update
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and l.agent_id = auth.uid()
  )
);
