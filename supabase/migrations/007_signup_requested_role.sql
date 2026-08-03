-- Persist requested access role from signup metadata (pending until admin approves)

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text;
begin
  requested := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'requested_role'), ''),
    'agent'
  );

  if requested not in ('agent', 'admin', 'photographer', 'marketing') then
    requested := 'agent';
  end if;

  insert into public.users (
    id,
    email,
    full_name,
    phone,
    mls_id,
    license_number,
    photographer_tier,
    role,
    status
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'phone',
    nullif(trim(new.raw_user_meta_data ->> 'mls_id'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'license_number'), ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'photographer_tier'), ''),
      'standard'
    ),
    requested,
    'pending'
  );
  return new;
end;
$$;
