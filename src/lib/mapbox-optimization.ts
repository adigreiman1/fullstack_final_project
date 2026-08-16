/**
 * Thin client for the Mapbox Optimization API v1.
 *
 * Called from the browser: the token is NEXT_PUBLIC_ and URL-restricted in the
 * Mapbox account, and routing from the client keeps re-optimisation (filtering,
 * re-ordering) off the server. Move this behind a Route Handler if the token ever
 * needs to become secret.
 *
 * Docs: https://docs.mapbox.com/api/navigation/optimization/
 */

/** Minimal GeoJSON shapes — @types/geojson is not installed in this project. */
export interface LineStringGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface LineStringFeature {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: LineStringGeometry;
}

const OPTIMIZATION_ENDPOINT = 'https://api.mapbox.com/optimized-trips/v1/mapbox/driving';

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export interface OptimizedTrip {
  geometry: LineStringGeometry;
  /**
   * Position of each *input* coordinate in the optimised trip, same order and
   * length as the coordinates passed in. `waypointIndexes[2] === 0` means the
   * third task supplied is the first stop to drive to.
   */
  waypointIndexes: number[];
  distanceMeters: number;
  durationSeconds: number;
}

/** Only the fields we read, so a shape change fails loudly here and not deep in the UI. */
interface OptimizationResponse {
  code?: string;
  message?: string;
  trips?: { geometry?: LineStringGeometry; distance?: number; duration?: number }[];
  waypoints?: { waypoint_index?: number }[];
}

export function buildOptimizationUrl(coordinates: string): string {
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    // GeoJSON (not the default polyline) so the geometry drops straight into a
    // <Source type="geojson">, and full overview so the line follows real roads.
    geometries: 'geojson',
    overview: 'full',
    // A service round is a one-way run: start at the first stop, end at the last.
    // roundtrip=false is only accepted together with source and destination.
    roundtrip: 'false',
    source: 'first',
    destination: 'last',
    steps: 'false',
  });

  return `${OPTIMIZATION_ENDPOINT}/${coordinates}?${params.toString()}`;
}

/** Thrown for both transport and API-level ('NoRoute', 'InvalidInput', …) failures. */
export class OptimizationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'OptimizationError';
    this.code = code;
  }
}

/**
 * Optimises the stop order for one vehicle.
 *
 * @param coordinates `lng,lat;lng,lat…`, at most MAX_OPTIMIZATION_COORDINATES pairs.
 * @throws OptimizationError on anything that is not a usable trip. AbortError is
 *   re-thrown untouched so callers can tell cancellation from failure.
 */
export async function fetchOptimizedTrip(
  coordinates: string,
  signal?: AbortSignal,
): Promise<OptimizedTrip> {
  if (!MAPBOX_TOKEN) {
    throw new OptimizationError(
      'Missing NEXT_PUBLIC_MAPBOX_TOKEN — add it to .env.local and restart the dev server.',
      'NoToken',
    );
  }

  const response = await fetch(buildOptimizationUrl(coordinates), { signal });

  // 422 carries a JSON body with the real reason ('NoRoute', 'InvalidInput'),
  // so parse before deciding, and only fall back to the status text.
  let payload: OptimizationResponse | null = null;
  try {
    payload = (await response.json()) as OptimizationResponse;
  } catch {
    payload = null;
  }

  if (!payload) {
    throw new OptimizationError(
      `Mapbox returned ${response.status} ${response.statusText || 'with an unreadable body'}.`,
      'BadResponse',
    );
  }

  if (payload.code !== 'Ok') {
    throw new OptimizationError(
      payload.message ?? `Mapbox could not optimise this route (${payload.code ?? response.status}).`,
      payload.code ?? String(response.status),
    );
  }

  const trip = payload.trips?.[0];
  const geometry = trip?.geometry;

  if (!geometry || geometry.type !== 'LineString' || geometry.coordinates.length < 2) {
    throw new OptimizationError('Mapbox returned a trip without a drivable geometry.', 'NoGeometry');
  }

  const waypoints = payload.waypoints ?? [];
  const waypointIndexes = waypoints.map((waypoint, index) =>
    typeof waypoint.waypoint_index === 'number' ? waypoint.waypoint_index : index,
  );

  return {
    geometry,
    waypointIndexes,
    distanceMeters: trip?.distance ?? 0,
    durationSeconds: trip?.duration ?? 0,
  };
}

/** Wraps a bare geometry as the Feature a <Source type="geojson"> expects. */
export function toLineFeature(geometry: LineStringGeometry): LineStringFeature {
  return { type: 'Feature', properties: {}, geometry };
}
