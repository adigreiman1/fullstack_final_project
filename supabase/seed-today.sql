-- Dev fixture helper: move the seeded tasks onto "today".
--
-- The dashboard shows one day at a time (scheduled_date = today in the fleet's
-- timezone), and the seed rows carry the date they were inserted. The morning
-- after seeding, the map is legitimately empty. Re-run this whenever that happens.
--
-- Safe to re-run, and a no-op once the rows are already on today.

-- 1. What is actually in the table, by day. Run this first.
select scheduled_date, count(*) as tasks, count(distinct vehicle_id) as vehicles
from public.service_tasks
group by scheduled_date
order by scheduled_date;

-- 2. Move whichever day is the latest onto today.
--
-- 'Asia/Jerusalem' — NOT current_date. current_date is UTC, so between midnight
-- and 03:00 local it is still yesterday, which would move the rows to a date the
-- app is not asking for. This has to match SERVICE_TIMEZONE in src/lib/utils.ts.
update public.service_tasks
set scheduled_date = (now() at time zone 'Asia/Jerusalem')::date
where scheduled_date = (select max(scheduled_date) from public.service_tasks);

-- 3. Confirm.
select scheduled_date, count(*) as tasks
from public.service_tasks
group by scheduled_date
order by scheduled_date;
