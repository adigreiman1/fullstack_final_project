-- Adds 'FAILED' to the service_tasks status set.
--
-- Run this BEFORE using the "Failed" action in the dashboard: without it Postgres
-- rejects the update with a check-constraint violation. Paste into the Supabase
-- SQL editor, or `supabase db push` if the project is linked to the CLI.
--
-- Safe to re-run: both statements are idempotent.

alter table public.service_tasks
  drop constraint if exists service_tasks_status_check;

alter table public.service_tasks
  add constraint service_tasks_status_check
  check (status in ('PENDING', 'COMPLETED', 'FAILED'));

-- If the original constraint was created with a non-default name, the DROP above
-- is a no-op and the ADD fails with "constraint already exists" on the old name.
-- Find and drop it first with:
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.service_tasks'::regclass and contype = 'c';

-- Dispatchers mark tasks from the browser, so an UPDATE policy has to exist for
-- authenticated users. Without it the write is silently filtered by RLS and
-- updateTaskStatus() reports "0 rows updated".
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'service_tasks'
      and cmd = 'UPDATE'
  ) then
    create policy "authenticated users can update service tasks"
      on public.service_tasks
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
