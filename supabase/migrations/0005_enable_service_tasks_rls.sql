-- Enable Row Level Security on service_tasks.
alter table public.service_tasks
enable row level security;

-- Anonymous users should not be able to read operational data.
revoke select
on public.service_tasks
from anon;

-- Authenticated users are allowed to read service tasks.
grant select
on public.service_tasks
to authenticated;

-- Remove any existing SELECT policies so the final policy is explicit.
do $$
declare
  policy_name text;
begin
  for policy_name in
    select polname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_tasks'
      and cmd = 'SELECT'
  loop
    execute format(
      'drop policy %I on public.service_tasks',
      policy_name
    );
  end loop;
end $$;

-- Only authenticated users may read rows from service_tasks.
create policy "authenticated users can read service tasks"
on public.service_tasks
for select
to authenticated
using (true);