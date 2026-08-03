-- Fix admin delete when profile was removed manually but auth.users still exists.

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  deleted_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete users.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;

  delete from auth.users where id = target_user_id;
  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    raise exception 'Auth user not found. They may already be deleted.';
  end if;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- One-time cleanup helper (run in SQL Editor when email is stuck):
-- delete from auth.users where email = 'test3@localprorealty.com';
