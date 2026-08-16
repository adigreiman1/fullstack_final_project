-- Close the write path into service_tasks.
--
-- The table is a one-way mirror of SAP: changes made here would be silently
-- overwritten by the next sync and would never reach SAP, so the dashboard is
-- strictly read-only. This reverses the UPDATE policy added by
-- 0002_task_status_failed.sql and revokes write privileges outright.
--
-- Safe to re-run, and safe if 0002 was never applied.

-- 1. Drop every UPDATE policy on the table, whatever it ended up being called.
--    Named policies are dropped by name, so a loop is the only way to be sure a
--    hand-created one does not survive.
do $$
declare
  policy_name text;
begin
  for policy_name in
    select polname
    from pg_policies
    where schemaname = 'public' and tablename = 'service_tasks' and cmd = 'UPDATE'
  loop
    execute format('drop policy %I on public.service_tasks', policy_name);
  end loop;
end $$;

-- 2. Revoke the privileges themselves. RLS policies only filter rows for roles
--    that already hold the privilege — revoking is what actually closes the door,
--    and it holds even if someone adds a permissive policy later.
revoke insert, update, delete, truncate on public.service_tasks from anon, authenticated;

-- The sync job must connect as the service_role (or another owner-level role),
-- which bypasses both RLS and these grants. Confirm that before deploying, or the
-- next SAP sync fails.

-- 3. Verify: this should return zero rows.
select polname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'service_tasks' and cmd <> 'SELECT';

-- And this should show only SELECT for anon/authenticated.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'service_tasks'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;
