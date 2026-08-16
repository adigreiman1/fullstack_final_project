import type { ServiceTask } from '@/types/schema';

/**
 * Hard limit of the Mapbox Optimization API v1: 12 coordinates per request
 * (source + destination included). A vehicle with more stops than this is split
 * — the first 12 are optimised, the rest stay on the map as plain markers.
 */
export const MAX_OPTIMIZATION_COORDINATES = 12;

/**
 * Categorical palette, one slot per vehicle, assigned in fixed order and never
 * cycled. Validated against the light-v11 land surface (#f8f4f0) for all pairs
 * — every route is on screen at once, so adjacent-pair validation is not enough:
 *   worst normal-vision ΔE 15.6, worst CVD ΔE 6.9 (deutan, aqua↔red).
 * A CVD ΔE in the 6–8 band is only legal with a second, non-colour encoding, so
 * every route also carries a distinct dash pattern, numbered stop markers and a
 * labelled legend row (see VEHICLE_DASH_ARRAYS).
 */
export const VEHICLE_COLORS = [
  '#2a78d6', // blue
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
] as const;

/**
 * Past six vehicles no ordering of the palette clears the separation floors, so
 * the 7th+ vehicle takes neutral grey and leans entirely on its dash pattern,
 * stop numbers and legend label. Fleet sizes above six want facets, not hues.
 */
export const OVERFLOW_VEHICLE_COLOR = '#898781';

/**
 * Secondary encoding for the palette's CVD warn band. Values are multiples of
 * the line width, per the Mapbox `line-dasharray` spec. `undefined` = solid.
 */
export const VEHICLE_DASH_ARRAYS: (readonly number[] | undefined)[] = [
  undefined,
  [2, 1.25],
  [4, 1.5],
  [1, 1.25],
  [6, 2],
  [3, 1, 1, 1],
];

/** Chrome tokens shared by the map, legend and tooltip. */
export const MAP_SURFACE = '#f8f4f0';
export const MAP_STYLE_URL = 'mapbox://styles/mapbox/light-v11';

export interface VehicleGroup {
  vehicleId: string;
  /** Stable palette slot: index into the sorted list of all vehicles for the day. */
  colorIndex: number;
  color: string;
  dashArray: readonly number[] | undefined;
  /** Every task for this vehicle, in the order the server returned them. */
  tasks: ServiceTask[];
  /** The first MAX_OPTIMIZATION_COORDINATES routable tasks — what gets optimised. */
  routableTasks: ServiceTask[];
  /** Routable tasks past the 12-coordinate limit: markers only, no route leg. */
  overflowTasks: ServiceTask[];
  /** Tasks with missing or out-of-range coordinates; excluded from the map. */
  invalidTasks: ServiceTask[];
}

/** Guards against a null/NaN/swapped lat-lng pair reaching the Optimization API. */
export function hasValidCoordinates(task: ServiceTask): boolean {
  return (
    Number.isFinite(task.lat) &&
    Number.isFinite(task.lng) &&
    Math.abs(task.lat) <= 90 &&
    Math.abs(task.lng) <= 180
  );
}

/**
 * Groups the day's tasks by vehicle_id.
 *
 * Runs on the client (inside a useMemo in MapDashboard) rather than in the
 * Server Action, because the dashboard re-groups as the dispatcher filters
 * vehicles and we do not want a round trip for that. Colour slots are assigned
 * from the full task list, so hiding a vehicle never repaints the survivors.
 */
export function groupTasksByVehicle(tasks: ServiceTask[]): VehicleGroup[] {
  const byVehicle = new Map<string, ServiceTask[]>();

  for (const task of tasks) {
    const bucket = byVehicle.get(task.vehicle_id);
    if (bucket) {
      bucket.push(task);
    } else {
      byVehicle.set(task.vehicle_id, [task]);
    }
  }

  // Sorted so a vehicle keeps its colour between renders and page loads; the
  // server's ORDER BY already sorts rows, this only pins the group order.
  const vehicleIds = [...byVehicle.keys()].sort((a, b) => a.localeCompare(b));

  return vehicleIds.map((vehicleId, colorIndex) => {
    const vehicleTasks = byVehicle.get(vehicleId) ?? [];
    const routable = vehicleTasks.filter(hasValidCoordinates);

    return {
      vehicleId,
      colorIndex,
      color: VEHICLE_COLORS[colorIndex] ?? OVERFLOW_VEHICLE_COLOR,
      dashArray: VEHICLE_DASH_ARRAYS[colorIndex % VEHICLE_DASH_ARRAYS.length],
      tasks: vehicleTasks,
      routableTasks: routable.slice(0, MAX_OPTIMIZATION_COORDINATES),
      overflowTasks: routable.slice(MAX_OPTIMIZATION_COORDINATES),
      invalidTasks: vehicleTasks.filter((task) => !hasValidCoordinates(task)),
    };
  });
}

/** `lng,lat;lng,lat` — the path segment the Optimization API expects. */
export function toCoordinateParam(tasks: ServiceTask[]): string {
  // 6 decimals ≈ 0.1 m, past which we would only be busting the request cache.
  return tasks.map((task) => `${task.lng.toFixed(6)},${task.lat.toFixed(6)}`).join(';');
}

export type Bounds = [[number, number], [number, number]];

/** [[west, south], [east, north]] over every task with usable coordinates. */
export function boundsOf(tasks: ServiceTask[]): Bounds | null {
  const usable = tasks.filter(hasValidCoordinates);
  if (usable.length === 0) return null;

  let west = usable[0].lng;
  let east = usable[0].lng;
  let south = usable[0].lat;
  let north = usable[0].lat;

  for (const task of usable) {
    west = Math.min(west, task.lng);
    east = Math.max(east, task.lng);
    south = Math.min(south, task.lat);
    north = Math.max(north, task.lat);
  }

  return [
    [west, south],
    [east, north],
  ];
}

/**
 * Unit suffixes come from the dictionary rather than being hard-coded, so a
 * Hebrew route summary reads 'ק״מ' and 'דק׳'. The numbers themselves stay in
 * Western digits, which is what Israeli dispatchers use.
 */
export interface UnitLabels {
  km: string;
  m: string;
  min: string;
  hour: string;
}

export function formatDistance(meters: number, units: UnitLabels): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} ${units.km}`
    : `${Math.round(meters)} ${units.m}`;
}

export function formatDuration(seconds: number, units: UnitLabels): string {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} ${units.min}`;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours} ${units.hour} ${String(totalMinutes % 60).padStart(2, '0')} ${units.min}`;
}
