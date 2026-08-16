/**
 * Mirrors the public.service_tasks table in Supabase.
 * Column names stay snake_case so rows map 1:1 with query results.
 */

/**
 * Mirrors the `status` check constraint on public.service_tasks.
 *
 * 'FAILED' was added in supabase/migrations/0002_task_status_failed.sql — that
 * migration has to be applied before the UI can write it, or Postgres rejects the
 * update with a check-constraint violation (surfaced as a toast, not a crash).
 */
export const TASK_STATUSES = ['PENDING', 'COMPLETED', 'FAILED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * Declared as a type alias, not an interface, on purpose: postgrest-js constrains
 * a table's Row to `Record<string, unknown>`, and only type aliases get an
 * implicit index signature. As an interface it fails that constraint silently —
 * select() goes untyped and update()'s argument narrows to `never`.
 */
export type ServiceTask = {
  id: string;
  address: string;
  lat: number;
  lng: number;
  /** Free-text service window, e.g. "09:00-12:00". Nullable in the DB. */
  time_window: string | null;
  vehicle_id: string;
  /**
   * Synced from SAP. Typed nullable because the mirror can legitimately be
   * missing a field for a task SAP has not fully populated — the UI falls back
   * rather than rendering "null" at a dispatcher.
   */
  installer_name: string | null;
  car_plate: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  /** Fetched but never displayed: the UI is read-only, so it shows no state it cannot change. */
  status: TaskStatus;
  /** Max 5 words, enforced by a DB check constraint. */
  short_note: string | null;
  /** ISO date, 'YYYY-MM-DD'. */
  scheduled_date: string;
  /** ISO 8601 timestamp with timezone. */
  created_at: string;
};

/** Columns you supply on insert; the rest are DB-defaulted. */
export type ServiceTaskInsert = Omit<ServiceTask, 'id' | 'created_at'> &
  Partial<Pick<ServiceTask, 'status' | 'scheduled_date'>>;

export type ServiceTaskUpdate = Partial<Omit<ServiceTask, 'id' | 'created_at'>>;

/**
 * Generic parameter for createServerClient<Database>() / createBrowserClient<Database>()
 * so query results are typed instead of `any`. Regenerate from the live DB with:
 *   npx supabase gen types typescript --project-id <ref> > src/types/supabase.ts
 */
export interface Database {
  public: {
    Tables: {
      service_tasks: {
        Row: ServiceTask;
        Insert: ServiceTaskInsert;
        Update: ServiceTaskUpdate;
        /**
         * Required by postgrest-js's GenericTable constraint. Without it the table
         * silently fails the constraint: select() degrades to untyped and update()
         * narrows its argument to `never`. Empty because service_tasks has no
         * foreign keys — add entries here if that changes.
         */
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/** Type guard for narrowing raw strings from the DB into TaskStatus. */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}
