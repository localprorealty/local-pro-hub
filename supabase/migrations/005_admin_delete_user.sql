-- Admin can permanently delete a user (auth + profile via cascade).
-- Deleting public.users alone leaves auth.users and blocks re-signup with same email.

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete users.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;

  if not exists (select 1 from public.users where id = target_user_id) then
    raise exception 'User not found.';
  end if;

  -- Removes auth.users row; public.users cascades via FK on public.users.id → auth.users
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
