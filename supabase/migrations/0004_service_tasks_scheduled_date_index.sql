-- Composite index to fix slow reads on service_tasks as the table scales.
--
-- Two query shapes drive this:
--   * getDailyTasks(): `eq(scheduled_date, X) order by vehicle_id, time_window`
--   * getRecommendations(): `gte/lte(scheduled_date, range)` over a 4-day window
-- Both filter on scheduled_date first, so it leads the index. vehicle_id and
-- time_window are appended so getDailyTasks' ORDER BY is satisfied directly
-- from the index (ASC NULLS LAST is Postgres' default index order, matching
-- `.order('time_window', { ascending: true, nullsFirst: false })` exactly) —
-- no separate sort step needed.
--
-- Safe to re-run: `if not exists` makes it idempotent.

create index if not exists service_tasks_scheduled_date_vehicle_id_time_window_idx
  on public.service_tasks (scheduled_date, vehicle_id, time_window);
