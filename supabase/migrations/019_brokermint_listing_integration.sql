-- Add brokermint_transaction_id to listings table
alter table public.listings add column if not exists brokermint_transaction_id text;

-- Create listing_type_checklist_mapping settings table
create table if not exists public.listing_type_checklist_mapping (
  id bigint generated always as identity primary key,
  listing_type text not null unique,
  checklist_template_id bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.listing_type_checklist_mapping enable row level security;

-- Policies
create policy "Anyone can read mappings" on public.listing_type_checklist_mapping
  for select using (true);

create policy "Admins can manage mappings" on public.listing_type_checklist_mapping
  for all using (
    exists (
      select 1 from public.users u 
      where u.id = auth.uid() 
      and u.role = 'admin' 
      and u.status = 'active'
    )
  );

-- Seed default mappings
insert into public.listing_type_checklist_mapping (listing_type, checklist_template_id)
values 
  ('listing', 3301356),
  ('buyer', 3301357),
  ('lease', 3317147)
on conflict (listing_type) do update
set checklist_template_id = excluded.checklist_template_id;
