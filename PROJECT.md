# Service Mobility Dashboard

A dispatcher-facing web app that shows the day's field-service stops on a map,
grouped by vehicle, with optimized driving routes. Built for a service
operation whose task data lives in SAP and is mirrored into Supabase.

## What it does

- Dispatchers sign in and see all service tasks scheduled for a given day.
- Tasks are grouped by vehicle (`vehicle_id`) and plotted on a Mapbox map, each
  vehicle getting a distinct color, dash pattern, and numbered stop markers.
- For each vehicle with 2+ routable stops, the app calls the Mapbox
  Optimization API to compute stop order, driving distance, and duration.
- A sidebar lists every vehicle as a legend row with its stop list; clicking a
  stop pans/zooms the map to it and opens a tooltip with contact/address
  details.
- A date picker lets dispatchers page through other days; the date lives in
  the URL (`?date=YYYY-MM-DD`) so a specific day's view is shareable.
- Fully bilingual (English / Hebrew) with RTL layout support, switchable via
  a language toggle stored in a cookie.

## Tech stack

- **Next.js 16** (App Router, Server Components + Server Actions)
- **React 19**, **TypeScript**, **Tailwind CSS 4**
- **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`) for auth and Postgres
- **Mapbox GL JS** via `react-map-gl`, plus the Mapbox Optimization API v1
- **react-hot-toast** for non-blocking error notifications

## Architecture

- `src/app/page.tsx` — server component: reads `?date=`, fetches that day's
  tasks via a Server Action, renders the header/date picker and hands data to
  the client map.
- `src/components/MapDashboard.tsx` — the client-side dashboard: groups tasks
  by vehicle, requests route optimization, manages map/legend/tooltip state.
- `src/lib/routes.ts` — vehicle grouping, color/dash palette (colorblind-aware,
  validated against the basemap), distance/duration formatting.
- `src/lib/mapbox-optimization.ts` — thin client for the Mapbox Optimization
  API (called from the browser, since the token is public and URL-restricted).
- `src/hooks/useOptimizedRoutes.ts` — fetches/caches optimized routes per
  vehicle, keyed by the request set so filtering/hiding never re-bills Mapbox.
- `src/actions/tasks.ts` — read-only Server Action (`getDailyTasks`) querying
  `service_tasks`; re-checks auth itself rather than trusting the proxy.
- `src/actions/auth.ts` — sign-in/sign-out Server Actions, with open-redirect
  protection on the post-login destination.
- `src/proxy.ts` — Next.js 16's renamed `middleware` file. Refreshes the
  Supabase session cookies and redirects unauthenticated visitors to `/login`.
- `src/lib/i18n.ts` — typed EN/HE dictionary and language/direction helpers,
  framework-agnostic so it works in server and client code alike.

## Data model

`public.service_tasks` (Supabase/Postgres) is a **one-way, read-only mirror**
of task data synced from SAP — see `src/types/schema.ts`. Write access is
revoked at the database level (`supabase/migrations/0003_readonly_service_tasks.sql`),
so the app only ever selects from it. Key columns: `vehicle_id`, `lat`/`lng`,
`address`, `time_window`, `installer_name`, `customer_name`/`customer_phone`,
`status` (`PENDING` / `COMPLETED` / `FAILED`), `scheduled_date`.

## Notable design decisions

- **Read-only by contract, not just convention** — enforced with a DB
  migration, not just omitted UI.
- **Route optimization runs client-side** so filtering/hiding vehicles never
  costs a server round trip or re-bills the Mapbox API.
- **Graceful degradation** — a vehicle whose route fails to optimize still
  shows all its stops as plain markers; the failure is a toast, not a crash.
- **12-coordinate cap** (Mapbox Optimization API v1 limit) — vehicles with
  more stops split into an optimized leg plus overflow markers.
- **Colorblind-aware palette** — six vehicle colors validated for contrast
  under color-vision deficiency, backed by dash patterns and numbered markers
  so no encoding relies on color alone; a 7th+ vehicle falls back to neutral
  grey.

## Running locally

```bash
npm run dev
```

Requires `.env.local` with Supabase credentials and
`NEXT_PUBLIC_MAPBOX_TOKEN` (a public, URL-restricted Mapbox token).
