'use client';

import { Popup } from 'react-map-gl/mapbox';

import type { ServiceTask } from '@/types/schema';

interface DetailRow {
  label: string;
  value: string;
  /** Forces LTR for values that are read left-to-right regardless of UI language. */
  dir?: 'ltr';
}

interface TaskTooltipProps {
  task: ServiceTask;
  /** The vehicle's palette slot, used for the identity dot only — never for text. */
  color: string;
  /** 1-based position in the optimised run, or null if the route is not optimised. */
  stopNumber: number | null;
  /** True while the vehicle's optimisation is still in flight. */
  pendingOptimization: boolean;
  onClose: () => void;
}

/**
 * Read-only detail for one stop, titled by the installer handling it.
 *
 * The task's `status` is deliberately not rendered. Tasks are mirrored one-way
 * from SAP, so showing a state this dashboard cannot change — or any control that
 * looks like it could — would misrepresent what the tool does.
 */
export function TaskTooltip({
  task,
  color,
  stopNumber,
  pendingOptimization,
  onClose,
}: TaskTooltipProps) {
  // Order matches the spec: plate, contact, phone, address, window, note.
  const detailRows: DetailRow[] = [
    // Plate numbers, phone numbers and time windows stay LTR even in the
    // Hebrew layout: they read left-to-right, and inheriting RTL reorders the digits.
    { label: 'מספר רכב', value: task.car_plate ?? '', dir: 'ltr' },
    // service_tasks has no vehicle-type column yet; assumed field name is
    // `vehicle_type` — falls back to a placeholder until SAP mirrors it.
    {
      label: 'סוג רכב',
      value: (task as { vehicle_type?: string }).vehicle_type ?? 'מסחרית',
    },
    { label: 'איש קשר', value: task.customer_name ?? '' },
    { label: 'טלפון', value: task.customer_phone ?? '', dir: 'ltr' },
    { label: 'כתובת', value: task.address },
    { label: 'חלון זמן', value: task.time_window ?? '', dir: 'ltr' },
    { label: 'הערה', value: task.short_note ?? '' },
  ];

  // Every SAP column is nullable in the mirror, so an absent field drops its row
  // rather than rendering a label with nothing after it.
  const rows = detailRows.filter((row) => row.value.trim().length > 0);

  return (
    <Popup
      longitude={task.lng}
      latitude={task.lat}
      anchor="bottom"
      offset={18}
      closeButton={false}
      // Closing on map click is handled by MapDashboard, which also has to clear
      // the pinned task id; letting the Popup close itself desyncs the two.
      closeOnClick={false}
      onClose={onClose}
      maxWidth="288px"
      className="task-tooltip"
    >
      <div className="flex flex-col gap-2 bg-gradient-to-br from-white to-lilac-bg px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full ring-2 ring-white"
            style={{ backgroundColor: color }}
          />
          <span className="text-[13px] leading-snug font-semibold text-deep-blue">
            {task.installer_name?.trim() || 'לא משויך'}
          </span>
          <span className="ms-auto shrink-0 text-[11px] text-[#898781]">
            {stopNumber !== null
              ? `עצירה ${stopNumber}`
              : pendingOptimization
                ? 'מחשב…'
                : 'ללא מסלול'}
          </span>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 border-t border-[#e1e0d9] pt-2 text-[11px]">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-[#898781]">{row.label}:</dt>
              <dd
                dir={row.dir}
                className={`text-deep-blue ${row.dir === 'ltr' ? 'text-start tabular-nums' : ''}`}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Popup>
  );
}
