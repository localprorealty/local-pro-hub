-- Extend new-user trigger to persist signup metadata on public.users

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
    new.raw_user_meta_data ->> 'mls_id',
    new.raw_user_meta_data ->> 'license_number',
    new.raw_user_meta_data ->> 'photographer_tier',
    'agent',
    'pending'
  );
  return new;
end;
$$;
