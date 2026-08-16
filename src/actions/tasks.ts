'use server';

import { createServerSupabase } from '@/lib/supabase-server';
import { todayInServiceTimezone } from '@/lib/utils';
import type { ServiceTask } from '@/types/schema';

/*
 * Read-only by design. service_tasks is a one-way mirror of SAP, so this module
 * exposes queries and nothing else — a Server Action is a live HTTP endpoint, so
 * an unused mutation here would still be a reachable write path into the mirror.
 * Writes are also revoked at the database in
 * supabase/migrations/0003_readonly_service_tasks.sql.
 */

/**
 * Returned instead of throwing so the dashboard can render markers-only or an
 * empty state with a message, rather than blowing up the whole route.
 */
export interface DailyTasksResult {
  tasks: ServiceTask[];
  /** Human-readable failure reason, or null on success. */
  error: string | null;
  /** The date actually queried, 'YYYY-MM-DD'. */
  date: string;
}

/**
 * Fetches the service tasks scheduled for a given day (defaults to today).
 *
 * Auth is re-checked here rather than trusted from proxy.ts. Server Actions are
 * POSTs to whatever route they are used from, so a matcher change or moving this
 * action to another route can silently drop proxy coverage — the Next.js docs
 * explicitly recommend verifying auth inside each Server Function.
 */
export async function getDailyTasks(date?: string): Promise<DailyTasksResult> {
  const targetDate = date ?? todayInServiceTimezone();
  const supabase = await createServerSupabase();

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) {
    return { tasks: [], error: 'Not authenticated.', date: targetDate };
  }

  const { data, error } = await supabase
    .from('service_tasks')
    .select('*')
    .eq('scheduled_date', targetDate)
    // Stable ordering keeps vehicle grouping and route colours deterministic
    // between renders; without it Postgres may return rows in any order.
    .order('vehicle_id', { ascending: true })
    .order('time_window', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('[getDailyTasks] Supabase query failed:', error.message);
    return { tasks: [], error: 'Could not load today’s tasks.', date: targetDate };
  }

  return { tasks: data ?? [], error: null, date: targetDate };
}
