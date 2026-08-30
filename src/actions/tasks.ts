'use server';

import { createServerSupabase } from '@/lib/supabase-server';
import { hasValidCoordinates } from '@/lib/routes';
import { addDays, todayInServiceTimezone } from '@/lib/utils';
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
    return {
      tasks: [],
      error: 'Not authenticated.',
      date: targetDate,
    };
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

    return {
      tasks: [],
      error: 'Could not load today’s tasks.',
      date: targetDate,
    };
  }

  return {
    tasks: data ?? [],
    error: null,
    date: targetDate,
  };
}

export interface Recommendation {
  task: ServiceTask;
  distanceKm: number;
}

const RECOMMENDATION_RADIUS_KM = 20;
const RECOMMENDATION_WINDOW_DAYS = 4;

/**
 * Validates a geographical coordinate pair received from the client.
 *
 * Client input must not be trusted even if the UI normally provides values
 * returned by the address-search service. Server Actions can be invoked
 * independently of the UI, so coordinates are validated again on the server.
 */
function areValidCoordinates(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Great-circle distance in km. */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

/**
 * Candidate vans/installers for a new task near (lat, lng).
 *
 * The 4-day window is always relative to the real current date — `new Date()` —
 * never the day selected in the dashboard, so a recommendation made while
 * browsing a past or future date still looks at tasks starting tomorrow.
 */
export async function getRecommendations(
  lat: number,
  lng: number,
): Promise<Recommendation[]> {
  /*
   * Validate client-controlled input before authentication, database access,
   * or geographical calculations.
   */
  if (!areValidCoordinates(lat, lng)) {
    console.warn(
      '[getRecommendations] Invalid coordinates received:',
      { lat, lng },
    );

    return [];
  }

  const today = todayInServiceTimezone(new Date());
  const startDate = addDays(today, 1);
  const endDate = addDays(today, RECOMMENDATION_WINDOW_DAYS);

  const supabase = await createServerSupabase();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    return [];
  }

  const { data, error } = await supabase
    .from('service_tasks')
    .select('*')
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate);

  if (error || !data) {
    console.error(
      '[getRecommendations] Supabase query failed:',
      error?.message,
    );

    return [];
  }

  const withinRadius = data
    // Database records are validated independently from the client input.
    .filter(hasValidCoordinates)
    .map((task) => ({
      task,
      distanceKm: haversineKm(
        lat,
        lng,
        task.lat,
        task.lng,
      ),
    }))
    .filter(
      (entry) =>
        entry.distanceKm <= RECOMMENDATION_RADIUS_KM,
    );

  // Same van, same date, both within radius:
  // only the closer stop is a useful slot.
  const closestPerVehicleDate =
    new Map<string, Recommendation>();

  for (const entry of withinRadius) {
    const key =
      `${entry.task.vehicle_id}|${entry.task.scheduled_date}`;

    const existing =
      closestPerVehicleDate.get(key);

    if (
      !existing ||
      entry.distanceKm < existing.distanceKm
    ) {
      closestPerVehicleDate.set(key, entry);
    }
  }

  return [...closestPerVehicleDate.values()].sort(
    (a, b) => a.distanceKm - b.distanceKm,
  );
}