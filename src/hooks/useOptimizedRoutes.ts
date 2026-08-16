'use client';

import { useEffect, useRef, useState } from 'react';

import {
  fetchOptimizedTrip,
  OptimizationError,
  type LineStringGeometry,
} from '@/lib/mapbox-optimization';

/**
 * One vehicle's optimisation input. Built inside a useMemo by MapDashboard so
 * the effect below only re-fires when the coordinates themselves change — not on
 * every hover, filter toggle or re-render.
 */
export interface OptimizationRequest {
  vehicleId: string;
  /** `lng,lat;lng,lat…`, already capped at the API's 12-coordinate limit. */
  coordinates: string;
  /** Task ids in the same order as the coordinates, used to map the result back. */
  taskIds: string[];
}

export interface RouteState {
  status: 'loading' | 'ready' | 'error';
  geometry: LineStringGeometry | null;
  /** task id → 1-based position in the optimised run. Empty while loading/on error. */
  stopNumbers: Record<string, number>;
  distanceMeters: number | null;
  durationSeconds: number | null;
  error: string | null;
}

const LOADING: RouteState = {
  status: 'loading',
  geometry: null,
  stopNumbers: {},
  distanceMeters: null,
  durationSeconds: null,
  error: null,
};

/** Identity of a request: same coordinates in the same order → same answer. */
function requestKey(request: OptimizationRequest): string {
  return `${request.vehicleId}|${request.coordinates}`;
}

/**
 * Resolves each vehicle's optimised trip, keyed by vehicle_id.
 *
 * The API call itself cannot live in the useMemo — useMemo is synchronous and
 * must stay side-effect free — so the *inputs* are memoised upstream and this
 * effect performs the fetch, with a per-key cache so a filter toggle or a remount
 * never re-bills the Optimization API for a route we already have.
 */
export function useOptimizedRoutes(
  requests: OptimizationRequest[],
): Record<string, RouteState> {
  const [routes, setRoutes] = useState<Record<string, RouteState>>({});
  const cache = useRef(new Map<string, RouteState>());
  /** One controller per in-flight key, so cancellation can be selective. */
  const inFlight = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const activeKeys = new Set(requests.map(requestKey));

    // Marking a task completed re-renders this hook's caller with a brand-new
    // request array whose coordinates are identical. Aborting everything here
    // would cancel and re-issue optimisations that are still perfectly valid, so
    // only fetches whose key has actually disappeared get cancelled.
    for (const [key, controller] of inFlight.current) {
      if (!activeKeys.has(key)) {
        controller.abort();
        inFlight.current.delete(key);
      }
    }

    // Drop vehicles that are no longer in the day's data, and seed the rest from
    // cache so a cached route paints on the first frame instead of flickering.
    setRoutes(() => {
      const next: Record<string, RouteState> = {};
      for (const request of requests) {
        next[request.vehicleId] = cache.current.get(requestKey(request)) ?? LOADING;
      }
      return next;
    });

    for (const request of requests) {
      const key = requestKey(request);
      if (cache.current.has(key) || inFlight.current.has(key)) continue;

      const controller = new AbortController();
      inFlight.current.set(key, controller);

      // Not awaited in sequence: routes resolve independently so one slow or
      // failing vehicle never holds up the others.
      void (async () => {
        let state: RouteState;

        try {
          const trip = await fetchOptimizedTrip(request.coordinates, controller.signal);

          const stopNumbers: Record<string, number> = {};
          request.taskIds.forEach((taskId, index) => {
            // waypointIndexes is parallel to the input coordinates and 0-based;
            // dispatchers read stops as "1, 2, 3…".
            stopNumbers[taskId] = (trip.waypointIndexes[index] ?? index) + 1;
          });

          state = {
            status: 'ready',
            geometry: trip.geometry,
            stopNumbers,
            distanceMeters: trip.distanceMeters,
            durationSeconds: trip.durationSeconds,
            error: null,
          };
        } catch (error) {
          // An abort means the inputs changed or the component unmounted — not a
          // failure, and writing state here would clobber the newer request.
          if (controller.signal.aborted) {
            inFlight.current.delete(key);
            return;
          }

          state = {
            ...LOADING,
            status: 'error',
            error:
              error instanceof OptimizationError
                ? error.message
                : 'Could not reach the Mapbox Optimization API.',
          };
        }

        inFlight.current.delete(key);

        // Errors are cached too, deliberately: without it a failing vehicle would
        // retry on every render. A page refresh is the retry.
        cache.current.set(key, state);
        if (controller.signal.aborted) return;
        setRoutes((previous) => ({ ...previous, [request.vehicleId]: state }));
      })();
    }
  }, [requests]);

  // Unmount only — a navigation away should not leave requests running. Keyed
  // cancellation for everything else happens in the effect above.
  useEffect(() => {
    const pending = inFlight.current;
    return () => {
      for (const controller of pending.values()) controller.abort();
      pending.clear();
    };
  }, []);

  return routes;
}
