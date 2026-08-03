-- =============================================================================
-- Mock listings for LocalPRO Hub — test agents only
-- =============================================================================
-- Users required (already signed up in Supabase Auth):
--   test@localprorealty.com   — agent (5 listings)
--   test2@localprorealty.com  — agent (5 listings)
--   admin@localprorealty.com  — admin (no listings; sees all via pipeline)
--
-- Run in Supabase SQL Editor (service role / SQL editor bypasses RLS).
-- Safe to re-run: removes prior mock rows for these two agents, then re-inserts.
-- =============================================================================

do $$
declare
  agent1_id uuid;
  agent2_id uuid;
begin
  select id into agent1_id from public.users where email = 'test@localprorealty.com';
  select id into agent2_id from public.users where email = 'test2@localprorealty.com';

  if agent1_id is null then
    raise exception 'Missing user test@localprorealty.com — sign up and approve first.';
  end if;
  if agent2_id is null then
    raise exception 'Missing user test2@localprorealty.com — sign up and approve first.';
  end if;

  -- Optional MLS IDs for NTREIS form agent field
  update public.users
  set
    mls_id = coalesce(mls_id, 'TESTAGENT01'),
    full_name = coalesce(full_name, 'Test Agent One'),
    role = coalesce(role, 'agent'),
    status = 'active'
  where id = agent1_id;

  update public.users
  set
    mls_id = coalesce(mls_id, 'TESTAGENT02'),
    full_name = coalesce(full_name, 'Test Agent Two'),
    role = coalesce(role, 'agent'),
    status = 'active'
  where id = agent2_id;

  update public.users
  set
    role = coalesce(role, 'admin'),
    status = 'active',
    full_name = coalesce(full_name, 'Admin User')
  where email = 'admin@localprorealty.com';

  -- Clear existing listings for test agents (keeps admin / other data intact)
  delete from public.listings
  where agent_id in (agent1_id, agent2_id);

  -- ---------------------------------------------------------------------------
  -- test@localprorealty.com — 5 listings
  -- ---------------------------------------------------------------------------

  -- 1) Draft — brand new (type picked, nothing filled yet)
  insert into public.listings (
    id, agent_id, listing_type, stage, address_full, form_data, description_generated
  ) values (
    '11111111-1111-4111-8111-111111111101',
    agent1_id,
    'listing',
    'draft',
    null,
    '{}'::jsonb,
    null
  );

  -- 2) Draft — address saved, form in progress (Voice Fill / manual edit)
  insert into public.listings (
    id, agent_id, listing_type, stage, address_full, mls_number, list_price,
    form_data, description_generated, go_live_date
  ) values (
    '11111111-1111-4111-8111-111111111102',
    agent1_id,
    'listing',
    'draft',
    '4521 Mockingbird Ln, Dallas, TX, 75205',
    null,
    875000,
    jsonb_build_object(
      'street_number', '4521',
      'street_name', 'Mockingbird',
      'street_type', 'Ln',
      'city', 'Dallas',
      'state', 'TX',
      'zip_code', '75205',
      'county', 'Dallas',
      'subdivision', 'Highland Park Estates',
      'address_step_complete', true,
      'property_sub_type', 'Single Family Residence',
      'listing_agreement_type', 'Exclusive Right to Sell',
      'transaction_type', 'Sale',
      'list_price', 875000,
      'bedrooms', 4,
      'bathrooms', 3,
      'sqft', 3200,
      'year_built', 1987,
      'property_attached_yn', 'No',
      'pool_yn', 'Yes',
      'garage_yn', 'Yes'
    ),
    null,
    (current_date + interval '45 days')::date
  );

  -- 3) Docs pending — NTREIS form complete (finished Section 22)
  insert into public.listings (
    id, agent_id, listing_type, stage, address_full, mls_number, list_price,
    form_data, description_generated, go_live_date
  ) values (
    '11111111-1111-4111-8111-111111111103',
    agent1_id,
    'listing',
    'docs_pending',
    '8920 Preston Rd, Plano, TX, 75024',
    null,
    549900,
    jsonb_build_object(
      'street_number', '8920',
      'street_name', 'Preston',
      'street_type', 'Rd',
      'city', 'Plano',
      'state', 'TX',
      'zip_code', '75024',
      'county', 'Collin',
      'address_step_complete', true,
      'property_sub_type', 'Single Family Residence',
      'listing_agreement_type', 'Exclusive Right to Sell',
      'transaction_type', 'Sale',
      'list_price', 549900,
      'bedrooms', 3,
      'bathrooms', 2,
      'sqft', 2100,
      'year_built', 2004,
      'property_description', 'Updated kitchen, open floor plan, great schools.',
      'showing_instructions', 'Call listing agent before showing. Alarm code in office.',
      'allow_internet_display', 'Yes',
      'allow_avm', 'Yes',
      'agent_id', 'TESTAGENT01'
    ),
    'Light-filled Plano home with recent updates and a private backyard. Ideal for families seeking top-rated schools.',
    (current_date + interval '30 days')::date
  );

  -- 4) Docs signed — ready to book photography
  insert into public.listings (
    id, agent_id, listing_type, stage, address_full, mls_number, list_price,
    form_data, description_generated, go_live_date
  ) values (
    '11111111-1111-4111-8111-111111111104',
    agent1_id,
    'listing',
    'docs_signed',
    '1200 Main St #1402, Dallas, TX, 75202',
    'DFW2401987',
    425000,
    jsonb_build_object(
      'street_number', '1200',
      'street_name', 'Main',
      'street_type', 'St',
      'unit_number', '1402',
      'city', 'Dallas',
      'state', 'TX',
      'zip_code', '75202',
      'county', 'Dallas',
      'address_step_complete', true,
      'property_sub_type', 'Condominium',
      'list_price', 425000,
      'bedrooms', 2,
      'bathrooms', 2,
      'sqft', 1180,
      'floor_location', '14',
      'complex_name', 'Main Street Tower',
      'agent_id', 'TESTAGENT01'
    ),
    'Downtown high-rise condo with skyline views and walkable amenities.',
    (current_date + interval '21 days')::date
  );

  -- 5) Shoot booked — marketing prep next
  insert into public.listings (
    id, agent_id, listing_type, stage, address_full, mls_number, list_price,
    form_data, description_generated, go_live_date
  ) values (
    '11111111-1111-4111-8111-111111111105',
    agent1_id,
    'listing',
    'shoot_booked',
    '3301 Knox St, Dallas, TX, 75205',
    'DFW2402104',
    1250000,
    jsonb_build_object(
      'street_number', '3301',
      'street_name', 'Knox',
      'street_type', 'St',
      'city', 'Dallas',
      'state', 'TX',
      'zip_code', '75205',
      'county', 'Dallas',
      'address_step_complete', true,
      'property_sub_type', 'Townhouse',
      'list_price', 1250000,
      'bedrooms', 3,
      'bathrooms', 3,
      'sqft', 2450,
      'agent_id', 'TESTAGENT01'
    ),
    'Knox Henderson townhouse steps from dining and shopping.',
    (current_date + interval '14 days')::date
  );

  -- ---------------------------------------------------------------------------
  -- test2@localprorealty.com — 5 listings
  -- ---------------------------------------------------------------------------

  -- 1) Draft — address step in progress (has address fields, form not started)
  insert into public.listings (
    id, agent_id, listing_type, stage, address_full, form_data
  ) values (
    '22222222-2222-4222-8222-222222222201',
    agent2_id,
    'lease',
    'draft',
    '2100 N Field St, Dallas, TX, 75201',
    jsonb_build_object(
      'street_number', '2100',
      'street_direction', 'N',
      'street_name', 'Field',
      'street_type', 'St',
      'city', 'Dallas',
      'state', 'TX',
      'zip_code', '75201',
      'county', 'Dallas'
    )
  );

  -- 2) Draft — form in edit (buyer rep, partial fields)
  insert into public.listings (
    id, agent_id, listing_type, stage, address_full, list_price, form_data
  ) values (
    '22222222-2222-4222-8222-222222222202',
    agent2_id,
    'buyer',
    'draft',
    '1500 Marilla St, Dallas, TX, 75201',
    null,
    jsonb_build_object(
      'street_number', '1500',
      'street_name', 'Marilla',
      'street_type', 'St',
      'city', 'Dallas',
      'state', 'TX',
      'zip_code', '75201',
      'county', 'Dallas',
      'address_step_complete', true,
      'transaction_type', 'Sale',
      'property_sub_type', 'Single Family Residence',
      'listing_agreement_type', 'Buyer Representation',
      'buyer_name', 'Jordan & Alex Rivera',
      'agent_id', 'TESTAGENT02'
    )
  );

  -- 3) Docs pending
  insert into public.listings (
    id, agent_id, listing_type, stage, address_full, list_price,
    form_data, description_generated, go_live_date
  ) values (
    '22222222-2222-4222-8222-222222222203',
    agent2_id,
    'listing',
    'docs_pending',
    '5600 W Lovers Ln, Dallas, TX, 75209',
    725000,
    jsonb_build_object(
      'street_number', '5600',
      'street_direction', 'W',
      'street_name', 'Lovers',
      'street_type', 'Ln',
      'city', 'Dallas',
      'state', 'TX',
      'zip_code', '75209',
      'county', 'Dallas',
      'address_step_complete', true,
      'property_sub_type', 'Single Family Residence',
      'list_price', 725000,
      'bedrooms', 4,
      'bathrooms', 3,
      'sqft', 2800,
      'pool_yn', 'No',
      'agent_id', 'TESTAGENT02'
    ),
    'Charming Lovers Lane traditional with mature trees and updated HVAC.',
    (current_date + interval '28 days')::date
  );

  -- 4) Marketing
  insert into public.listings (
    id, agent_id, listing_type, stage, address_full, mls_number, list_price,
    form_data, description_generated, go_live_date
  ) values (
    '22222222-2222-4222-8222-222222222204',
    agent2_id,
    'listing',
    'marketing',
    '9400 N Central Expy, Dallas, TX, 75231',
    'DFW2401888',
    389000,
    jsonb_build_object(
      'street_number', '9400',
      'street_direction', 'N',
      'street_name', 'Central',
      'street_type', 'Expy',
      'city', 'Dallas',
      'state', 'TX',
      'zip_code', '75231',
      'county', 'Dallas',
      'address_step_complete', true,
      'list_price', 389000,
      'bedrooms', 2,
      'bathrooms', 2,
      'sqft', 1050,
      'agent_id', 'TESTAGENT02'
    ),
    'Low-maintenance condo near medical district — perfect for professionals.',
    (current_date + interval '7 days')::date
  );

  -- 5) Closed — shows under Archived tab
  insert into public.listings (
    id, agent_id, listing_type, stage, address_full, mls_number, list_price,
    form_data, description_generated, go_live_date, went_live_at
  ) values (
    '22222222-2222-4222-8222-222222222205',
    agent2_id,
    'listing',
    'closed',
    '4111 Swiss Ave, Dallas, TX, 75204',
    'DFW2300441',
    515000,
    jsonb_build_object(
      'street_number', '4111',
      'street_name', 'Swiss',
      'street_type', 'Ave',
      'city', 'Dallas',
      'state', 'TX',
      'zip_code', '75204',
      'county', 'Dallas',
      'address_step_complete', true,
      'list_price', 515000,
      'bedrooms', 3,
      'bathrooms', 2,
      'sqft', 1850,
      'agent_id', 'TESTAGENT02'
    ),
    'Sold — East Dallas bungalow with designer finishes.',
    (current_date - interval '60 days')::date,
    (now() - interval '45 days')
  );

  raise notice 'Seeded 10 mock listings for test@ and test2@localprorealty.com';
end $$;

-- Quick verification
select
  u.email,
  l.stage,
  l.listing_type,
  l.address_full,
  l.list_price
from public.listings l
join public.users u on u.id = l.agent_id
where u.email in ('test@localprorealty.com', 'test2@localprorealty.com')
order by u.email, l.stage, l.address_full;
