-- Sample agent milestones for test@localprorealty.com
-- Run after 008_agent_milestones.sql and test user exists.

do $$
declare
  agent_id uuid;
begin
  select id into agent_id from public.users where email = 'test@localprorealty.com';

  if agent_id is null then
    raise notice 'Skipping agent_milestones seed — test@localprorealty.com not found.';
    return;
  end if;

  delete from public.agent_milestones where user_id = agent_id;

  insert into public.agent_milestones (user_id, milestone_type, event_date, person_name, notes)
  values
    (agent_id, 'agent_birthday', '2000-06-10', null, 'Adarsh birthday milestone');
end;
$$;
