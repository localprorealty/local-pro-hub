-- Prevent an admin from demoting or suspending their own account.

create or replace function public.prevent_admin_self_demotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and new.id = auth.uid() then
    if new.role is distinct from 'admin' then
      raise exception 'You cannot change your own admin role.';
    end if;

    if new.status = 'suspended' then
      raise exception 'You cannot suspend your own admin account.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_admin_self_demotion_trigger on public.users;

create trigger prevent_admin_self_demotion_trigger
before update on public.users
for each row execute function public.prevent_admin_self_demotion();
