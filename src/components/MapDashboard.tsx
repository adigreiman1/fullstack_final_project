'use client';

import 'mapbox-gl/dist/mapbox-gl.css';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Map, Marker, NavigationControl, type MapRef } from 'react-map-gl/mapbox';

import { getRecommendations, type Recommendation } from '@/actions/tasks';
import { AddressSearch } from '@/components/AddressSearch';
import { RouteLayer } from '@/components/RouteLayer';
import { TaskTooltip } from '@/components/TaskTooltip';
import { useOptimizedRoutes, type OptimizationRequest } from '@/hooks/useOptimizedRoutes';
import { MAPBOX_TOKEN } from '@/lib/mapbox-optimization';
import {
  boundsOf,
  formatDistance,
  groupTasksByVehicle,
  hasValidCoordinates,
  MAP_STYLE_URL,
  MAX_OPTIMIZATION_COORDINATES,
  toCoordinateParam,
  type VehicleGroup,
} from '@/lib/routes';
import { formatFullDate } from '@/lib/utils';
import type { ServiceTask } from '@/types/schema';

interface MapDashboardProps {
  tasks: ServiceTask[];
  /** The day being shown, 'YYYY-MM-DD'. */
  date: string;
  /** Failure from getDailyTasks(), rendered above the map. */
  loadError: string | null;
}

/** Used only until the first fitBounds; overwritten as soon as the map loads. */
const FALLBACK_VIEW = { longitude: 34.7818, latitude: 32.0853, zoom: 10 };

/** Selection and filter state, scoped to the day it was made on. */
interface DayView {
  date: string;
  hiddenVehicles: ReadonlySet<string>;
  focusedVehicle: string | null;
  hoveredTaskId: string | null;
  pinnedTaskId: string | null;
}

function emptyDayView(date: string): DayView {
  return {
    date,
    hiddenVehicles: new Set(),
    focusedVehicle: null,
    hoveredTaskId: null,
    pinnedTaskId: null,
  };
}

function stopsLabel(count: number): string {
  return count === 1 ? 'עצירה אחת' : `${count} עצירות`;
}

function vehiclesLabel(count: number): string {
  return count === 1 ? 'רכב אחד' : `${count} רכבים`;
}

export function MapDashboard({ tasks, date, loadError }: MapDashboardProps) {
  const mapRef = useRef<MapRef | null>(null);

  /**
   * Selection state is *derived* against the current date rather than reset by an
   * effect when the date changes. Flipping to another day therefore starts clean —
   * a hidden VAN-2 on Tuesday must not hide Wednesday's VAN-2 — with no cascading
   * render, and without keying this component by date, which would remount the Map
   * and pay a full style reload on every flip.
   */
  const [storedView, setStoredView] = useState<DayView>(() => emptyDayView(date));
  const view = storedView.date === date ? storedView : emptyDayView(date);

  const updateView = useCallback(
    (patch: (current: DayView) => Partial<Omit<DayView, 'date'>>) => {
      setStoredView((previous) => {
        const base = previous.date === date ? previous : emptyDayView(date);
        return { ...base, ...patch(base) };
      });
    },
    [date],
  );

  /**
   * Grouping runs here rather than in the Server Action: the dispatcher filters
   * vehicles constantly and none of that should cost a round trip.
   */
  const groups = useMemo(() => groupTasksByVehicle(tasks), [tasks]);

  /**
   * The Optimization API call sits behind this useMemo. useMemo is synchronous
   * and must stay side-effect free, so what is memoised is the *request set* —
   * one entry per vehicle, coordinates already capped at the API's 12-coordinate
   * limit. useOptimizedRoutes fetches only when this array's identity changes, so
   * hovering a marker or hiding a vehicle never re-bills Mapbox.
   */
  const optimizationRequests = useMemo<OptimizationRequest[]>(
    () =>
      groups
        // Two coordinates is the minimum for a trip; a single-stop vehicle just
        // gets a marker.
        .filter((group) => group.routableTasks.length >= 2)
        .map((group) => ({
          vehicleId: group.vehicleId,
          coordinates: toCoordinateParam(group.routableTasks),
          taskIds: group.routableTasks.map((task) => task.id),
        })),
    [groups],
  );

  const routes = useOptimizedRoutes(optimizationRequests);

  /**
   * Toast fallback for Optimization API failures.
   *
   * A failed vehicle still has all of its stops on the map — only the drawn line
   * is missing — so this is a notification, not an error state. The ref makes it
   * fire once per vehicle rather than on every re-render, and the stable toast id
   * stops a second vehicle failing from stacking a duplicate. Keyed by date as
   * well, so the same vehicle failing on another day still gets reported.
   */
  const notifiedRouteErrors = useRef(new Set<string>());

  useEffect(() => {
    for (const [vehicleId, route] of Object.entries(routes)) {
      if (route.status !== 'error') continue;

      const key = `${date}|${vehicleId}`;
      if (notifiedRouteErrors.current.has(key)) continue;

      notifiedRouteErrors.current.add(key);
      toast.error(`לא ניתן לחשב מסלול עבור ${vehicleId} — מוצגות עצירות בלבד.`, {
        id: `route-error-${key}`,
        duration: 6000,
      });
    }
  }, [routes, date]);

  /** The data-layer failure from getDailyTasks() is worth a toast as well as the inline note. */
  useEffect(() => {
    if (!loadError) return;
    toast.error(loadError, { id: 'daily-tasks-error' });
  }, [loadError]);

  const visibleGroups = useMemo(
    () => groups.filter((group) => !view.hiddenVehicles.has(group.vehicleId)),
    [groups, view.hiddenVehicles],
  );

  const bounds = useMemo(() => boundsOf(tasks), [tasks]);

  const initialViewState = useMemo(() => {
    if (!bounds) return FALLBACK_VIEW;
    const [[west, south], [east, north]] = bounds;
    return { longitude: (west + east) / 2, latitude: (south + north) / 2, zoom: 10 };
    // Read once, on mount — fitBounds below takes over from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [draftLocation, setDraftLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const router = useRouter();

  const clearDraftLocation = useCallback(() => {
    setDraftLocation(null);
    setRecommendations([]);
  }, []);

  /**
   * The target date of an in-flight recommendation pick. Consumed once that
   * date's tasks actually land — the generic "fit the whole day" effect below
   * would otherwise snap the view back out to an overview right after the deep
   * zoom plays. A ref rather than state: clearing it must not itself trigger a
   * re-render, or that render would re-run the whole-day effect with the flag
   * already gone and instantly cancel the flyTo that just started.
   */
  const pendingFocusDateRef = useRef<string | null>(null);

  // The recommendations list stays open and the map pin stays put after a pick —
  // dispatchers compare several dates by trial and error before committing.
  const selectRecommendation = useCallback(
    (recommendation: Recommendation) => {
      pendingFocusDateRef.current = recommendation.task.scheduled_date;
      router.push(`/?date=${recommendation.task.scheduled_date}`);
    },
    [router],
  );

  /** Always relative to the real current date, not `date` — see getRecommendations(). */
  useEffect(() => {
    if (!draftLocation) {
      setRecommendations([]);
      return;
    }

    let cancelled = false;
    setRecommendationsLoading(true);

    getRecommendations(draftLocation.lat, draftLocation.lng).then((result) => {
      if (cancelled) return;
      setRecommendations(result);
      setRecommendationsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [draftLocation]);

  useEffect(() => {
    // A recommendation pick is about to fly deep into the pin below once its
    // date's tasks land — fitting the whole day's bounds first would just be a
    // flash that the flyTo immediately overrides.
    if (!mapLoaded || !bounds || pendingFocusDateRef.current === date) return;
    mapRef.current?.fitBounds(bounds, { padding: 72, maxZoom: 14, duration: 0 });
  }, [mapLoaded, bounds, date]);

  useEffect(() => {
    if (!mapLoaded || !draftLocation) return;
    mapRef.current?.flyTo({
      center: [draftLocation.lng, draftLocation.lat],
      zoom: Math.max(mapRef.current.getZoom(), 14),
      duration: 800,
    });
  }, [mapLoaded, draftLocation]);

  // Fires once the picked recommendation's date has actually loaded: drives a
  // deep, focused zoom straight into the searched pin, rather than a wide shot
  // that also frames the vehicle's other stops — at fleet scale a bounding box
  // spanning a whole route reduces the zoom to something barely legible.
  useEffect(() => {
    if (!mapLoaded || pendingFocusDateRef.current !== date) return;
    pendingFocusDateRef.current = null;

    if (draftLocation) {
      mapRef.current?.flyTo({
        center: [draftLocation.lng, draftLocation.lat],
        zoom: 16,
        duration: 900,
      });
    }
  }, [mapLoaded, date, draftLocation]);

  /**
   * Basemap labels are set to Hebrew once the map loads.
   *
   * mapbox-gl v3 has setLanguage built in — it swaps every symbol layer's
   * text-field to the matching `name_xx` field — so the old mapbox-gl-language
   * plugin is not needed. Guarded by mapLoaded because the style's layers do not
   * exist before then, and wrapped because a style without a localised field for
   * the requested language throws rather than falling back.
   */
  useEffect(() => {
    if (!mapLoaded) return;

    const map = mapRef.current?.getMap();
    if (!map) return;

    try {
      map.setLanguage('he');
    } catch (error) {
      // Not worth a toast: the map is fully usable, just labelled in the
      // style's default language.
      console.warn('[MapDashboard] Could not localise basemap labels:', error);
    }
  }, [mapLoaded]);

  const toggleVehicle = useCallback(
    (vehicleId: string) => {
      updateView((current) => {
        const next = new Set(current.hiddenVehicles);
        if (!next.delete(vehicleId)) next.add(vehicleId);
        return { hiddenVehicles: next };
      });
    },
    [updateView],
  );

  const pinTask = useCallback(
    (taskId: string | null) => updateView(() => ({ pinnedTaskId: taskId })),
    [updateView],
  );

  const hoverTask = useCallback(
    (taskId: string | null) => updateView(() => ({ hoveredTaskId: taskId })),
    [updateView],
  );

  const focusVehicle = useCallback(
    (vehicleId: string | null) => updateView(() => ({ focusedVehicle: vehicleId })),
    [updateView],
  );

  const focusTask = useCallback(
    (task: ServiceTask) => {
      pinTask(task.id);
      mapRef.current?.flyTo({
        center: [task.lng, task.lat],
        zoom: Math.max(mapRef.current.getZoom(), 13),
        duration: 600,
      });
    },
    [pinTask],
  );

  const activeTaskId = view.pinnedTaskId ?? view.hoveredTaskId;
  const activeTask = useMemo(
    () =>
      activeTaskId
        ? (visibleGroups
            .flatMap((group) => group.tasks)
            .find((task) => task.id === activeTaskId) ?? null)
        : null,
    [activeTaskId, visibleGroups],
  );
  const activeGroup = activeTask
    ? (groups.find((group) => group.vehicleId === activeTask.vehicle_id) ?? null)
    : null;

  const totalStops = tasks.length;
  const vehicleCount = groups.length;

  if (!MAPBOX_TOKEN) {
    return (
      <main className="flex flex-1 items-center justify-center px-8 py-10">
        <p role="alert" className="max-w-md rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          חסר NEXT_PUBLIC_MAPBOX_TOKEN. יש להוסיף אותו לקובץ ‎.env.local ולהפעיל מחדש את שרת הפיתוח — ‏Next.js קורא קובצי סביבה רק בעת העלייה.
        </p>
      </main>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* border-e / ms-* rather than border-r / ml-*: logical properties flip
          with dir="rtl" on their own, physical ones do not. */}
      <aside className="relative isolate flex w-[336px] shrink-0 flex-col gap-4 overflow-y-auto border-e border-[#e1e0d9] bg-sky-50 px-5 py-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[url('/chrome-bg.png')] bg-cover bg-center opacity-20 mix-blend-multiply"
        />
        <AddressSearch onSelect={setDraftLocation} draftLocation={draftLocation} />

        <div className="flex flex-col gap-1">
          <h2 className="text-[13px] font-semibold tracking-wide text-indigo-900 uppercase">
            מסלולים
          </h2>
          <p className="text-xs text-[#52514e] tabular-nums">
            {date} · {stopsLabel(totalStops)} · {vehiclesLabel(vehicleCount)}
          </p>
        </div>

        {loadError ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {loadError}
          </p>
        ) : null}

        {groups.length === 0 && !loadError ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {`אין משימות מתוזמנות לתאריך ${date}. אפשר לדפדף בעזרת החיצים או לוח השנה בכותרת.`}
          </p>
        ) : null}

        {draftLocation ? (
          <div className="flex items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm">
            <span className="truncate text-xs font-medium text-slate-800">
              {draftLocation.address}
            </span>
            <button
              type="button"
              onClick={clearDraftLocation}
              className="shrink-0 text-[11px] text-[#898781] underline"
            >
              נקה חיפוש
            </button>
          </div>
        ) : null}

        {draftLocation ? (
          <div className="flex flex-col gap-2 rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-800">המלצות רכבים</h3>

            {recommendationsLoading ? (
              <p className="text-[11px] text-[#898781]">טוען המלצות…</p>
            ) : recommendations.length === 0 ? (
              <p className="text-[11px] text-[#52514e]">
                לא נמצאו רכבים ברדיוס 20 ק״מ ב-4 הימים הקרובים
              </p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                {recommendations.map((rec) => (
                  <li key={rec.task.id}>
                    <button
                      type="button"
                      onClick={() => selectRecommendation(rec)}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-start text-[11px] transition-colors hover:bg-slate-100"
                    >
                      <div className="flex items-center justify-between tabular-nums">
                        <span>{formatFullDate(rec.task.scheduled_date)}</span>
                        <span>{rec.distanceKm.toFixed(1)} ק״מ</span>
                      </div>
                      <div className="font-bold text-indigo-900">
                        {rec.task.installer_name ?? 'לא משויך'}
                      </div>
                      <div className="text-[#52514e]">{rec.task.time_window ?? '—'}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {/* Legend and stop table in one: identity is never carried by colour
            alone, and this doubles as the visible-label relief the low-contrast
            palette slots require. */}
        <ul className="flex flex-col gap-2">
          {groups.map((group) => (
            <VehicleLegendRow
              key={group.vehicleId}
              group={group}
              route={routes[group.vehicleId]}
              hidden={view.hiddenVehicles.has(group.vehicleId)}
              focused={view.focusedVehicle === group.vehicleId}
              activeTaskId={activeTaskId}
              onToggle={() => toggleVehicle(group.vehicleId)}
              onFocus={() => focusVehicle(group.vehicleId)}
              onBlur={() => focusVehicle(null)}
              onSelectTask={focusTask}
            />
          ))}
        </ul>
      </aside>

      <div className="relative flex-1">
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={initialViewState}
          mapStyle={MAP_STYLE_URL}
          // Strict Mode mounts twice in dev; without this the map is torn down
          // and rebuilt, which costs a style load and a visible flash.
          reuseMaps
          style={{ position: 'absolute', inset: 0 }}
          onLoad={() => setMapLoaded(true)}
          onClick={() => pinTask(null)}
        >
          <NavigationControl position="top-right" showCompass={false} />

          {visibleGroups.map((group) => (
            <RouteLayer
              key={group.vehicleId}
              vehicleId={group.vehicleId}
              geometry={routes[group.vehicleId]?.geometry ?? null}
              color={group.color}
              dashArray={group.dashArray}
              visible
              dimmed={view.focusedVehicle !== null && view.focusedVehicle !== group.vehicleId}
            />
          ))}

          {visibleGroups.flatMap((group) => {
            const route = routes[group.vehicleId];
            const dimmed = view.focusedVehicle !== null && view.focusedVehicle !== group.vehicleId;

            return group.tasks.filter(hasValidCoordinates).map((task, index) => (
              <Marker
                key={task.id}
                longitude={task.lng}
                latitude={task.lat}
                anchor="center"
                onClick={(event) => {
                  event.originalEvent.stopPropagation();
                  pinTask(task.id);
                }}
              >
                <StopMarker
                  task={task}
                  color={group.color}
                  label={route?.stopNumbers[task.id] ?? index + 1}
                  provisional={route?.status !== 'ready'}
                  dimmed={dimmed}
                  active={activeTaskId === task.id}
                  onHoverStart={() => hoverTask(task.id)}
                  onHoverEnd={() => hoverTask(null)}
                />
              </Marker>
            ));
          })}

          {draftLocation ? (
            <Marker longitude={draftLocation.lng} latitude={draftLocation.lat} anchor="bottom">
              <div
                className="relative flex h-8 w-8 items-center justify-center"
                title={draftLocation.address}
              >
                <span className="absolute bottom-0 h-3 w-3 animate-ping rounded-full bg-pink-500 opacity-60" />
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="relative h-8 w-8 text-pink-500 drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)]"
                >
                  <path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 7 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
                </svg>
              </div>
            </Marker>
          ) : null}

          {activeTask && activeGroup ? (
            <TaskTooltip
              task={activeTask}
              color={activeGroup.color}
              stopNumber={routes[activeGroup.vehicleId]?.stopNumbers[activeTask.id] ?? null}
              pendingOptimization={routes[activeGroup.vehicleId]?.status === 'loading'}
              onClose={() => pinTask(null)}
            />
          ) : null}
        </Map>
      </div>
    </div>
  );
}

interface StopMarkerProps {
  task: ServiceTask;
  color: string;
  label: number;
  /** The number shown is input order, not an optimised stop number, yet. */
  provisional: boolean;
  dimmed: boolean;
  active: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

/**
 * A numbered pin. The number is the second encoding of route order (colour is
 * the first), and the white ring keeps overlapping stops separable.
 */
function StopMarker({
  task,
  color,
  label,
  provisional,
  dimmed,
  active,
  onHoverStart,
  onHoverEnd,
}: StopMarkerProps) {
  return (
    <button
      type="button"
      // Bigger than the mark itself so the hit target is comfortable at zoom.
      className="relative grid size-7 place-items-center rounded-full text-[11px] font-semibold tabular-nums text-white ring-2 ring-white transition-transform"
      style={{
        backgroundColor: color,
        opacity: dimmed ? 0.35 : 1,
        transform: active ? 'scale(1.25)' : 'scale(1)',
        boxShadow: '0 1px 3px rgba(11,11,11,0.35)',
      }}
      title={provisional ? 'Stop order not optimised yet' : undefined}
      aria-label={`${task.vehicle_id}, stop ${label}, ${task.address}`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
    >
      {/* Route order is the only thing a pin encodes — colour for the vehicle,
          number for the position in its run. */}
      {label}
    </button>
  );
}

interface VehicleLegendRowProps {
  group: VehicleGroup;
  route: ReturnType<typeof useOptimizedRoutes>[string] | undefined;
  hidden: boolean;
  focused: boolean;
  activeTaskId: string | null;
  onToggle: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onSelectTask: (task: ServiceTask) => void;
}

function VehicleLegendRow({
  group,
  route,
  hidden,
  focused,
  activeTaskId,
  onToggle,
  onFocus,
  onBlur,
  onSelectTask,
}: VehicleLegendRowProps) {
  const installerName = group.tasks.find((task) => task.installer_name)?.installer_name ?? group.vehicleId;

  // Ordered stops read top-to-bottom in drive order once optimisation lands.
  const orderedTasks = useMemo(() => {
    if (!route || route.status !== 'ready') return group.tasks;
    return [...group.tasks].sort(
      (a, b) =>
        (route.stopNumbers[a.id] ?? Number.MAX_SAFE_INTEGER) -
        (route.stopNumbers[b.id] ?? Number.MAX_SAFE_INTEGER),
    );
  }, [group.tasks, route]);

  return (
    <li
      className={`rounded-xl border border-slate-300 bg-white shadow-sm transition-shadow ${
        focused ? 'shadow-md' : ''
      } ${hidden ? 'opacity-55' : ''}`}
      onMouseEnter={onFocus}
      onMouseLeave={onBlur}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={!hidden}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start"
      >
        <DashPreview color={group.color} dashArray={group.dashArray} muted={hidden} />
        <span className="flex flex-col">
          <span className="font-mono text-lg font-bold text-indigo-900">{installerName}</span>
          <span className="text-[11px] text-[#52514e] tabular-nums">
            {stopsLabel(group.tasks.length)}
            {route?.status === 'ready' && route.distanceMeters !== null
              ? ` · ${formatDistance(route.distanceMeters)}`
              : ''}
          </span>
        </span>
        <span className="ms-auto text-[10px] font-medium tracking-wide text-[#898781] uppercase">
          {hidden ? 'מוסתר' : 'מוצג'}
        </span>
      </button>

      {route?.status === 'loading' ? (
        <p className="px-3 pb-2 text-[11px] text-[#898781]">מחשב מסלול…</p>
      ) : null}

      {route?.status === 'error' ? (
        // Markers stay on the map; only the drawn route is missing.
        <p className="px-3 pb-2 text-[11px] text-[#d03b3b]">
          המסלול אינו זמין — מוצגות עצירות בלבד.{' '}
          {/* The API's own message stays untranslated on purpose: it is a
              verbatim upstream diagnostic, not UI copy. */}
          <span dir="ltr">{route.error}</span>
        </p>
      ) : null}

      {group.overflowTasks.length > 0 ? (
        <p className="px-3 pb-2 text-[11px] text-[#52514e]">
          {`${stopsLabel(group.overflowTasks.length)} מעבר למגבלת ${MAX_OPTIMIZATION_COORDINATES} הנקודות של Mapbox — מוצגות כסימונים בלבד, ללא מסלול.`}
        </p>
      ) : null}

      {group.invalidTasks.length > 0 ? (
        <p className="px-3 pb-2 text-[11px] text-[#d03b3b]">
          {group.invalidTasks.length === 1
            ? 'לעצירה אחת אין קואורדינטות תקינות.'
            : `ל־${group.invalidTasks.length} עצירות אין קואורדינטות תקינות.`}
        </p>
      ) : null}

      <ol className="flex flex-col border-t border-[#e1e0d9]">
        {orderedTasks.map((task, index) => {
          const stopNumber = route?.stopNumbers[task.id] ?? index + 1;
          const routable = hasValidCoordinates(task);

          return (
            <li key={task.id}>
              {/* The row's only action is navigational: centre the map on this
                  stop. Nothing here writes. */}
              <button
                type="button"
                disabled={!routable}
                onClick={() => onSelectTask(task)}
                className={`flex w-full min-w-0 items-baseline gap-2 px-3 py-1.5 text-start text-[11px] transition-colors hover:bg-[#f9f9f7] disabled:cursor-not-allowed disabled:opacity-60 ${
                  activeTaskId === task.id ? 'bg-[#f0efec]' : ''
                }`}
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white tabular-nums"
                  style={{ backgroundColor: group.color }}
                >
                  {stopNumber}
                </span>
                <span className="min-w-0 flex-1 truncate text-[#0b0b0b]">{task.address}</span>
                {task.time_window ? (
                  <span className="shrink-0 text-[#52514e] tabular-nums">
                    {task.time_window}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </li>
  );
}

/** Legend swatch that shows the route's colour *and* its dash pattern. */
function DashPreview({
  color,
  dashArray,
  muted,
}: {
  color: string;
  dashArray: readonly number[] | undefined;
  muted: boolean;
}) {
  // line-dasharray is in line widths; the route renders at 3.5px, so scale to match.
  const strokeWidth = 3.5;
  const dash = dashArray?.map((value) => value * strokeWidth).join(' ');

  return (
    <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden className="shrink-0">
      <line
        x1="1"
        y1="6"
        x2="25"
        y2="6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dash}
        opacity={muted ? 0.4 : 1}
      />
    </svg>
  );
}
