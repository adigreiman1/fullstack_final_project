'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { useI18n } from '@/components/LanguageProvider';
import {
  addDays,
  addMonths,
  formatFullDate,
  formatMonthYear,
  monthGrid,
  relativeDay,
  weekdayInitials,
} from '@/lib/utils';

interface DatePickerProps {
  /** The selected day, 'YYYY-MM-DD'. Already validated by the page. */
  date: string;
  /** Today in the fleet's timezone, for the "Today" affordances. */
  today: string;
}

/**
 * Header date navigation: ‹ / › for adjacent days plus a calendar dropdown.
 *
 * The selected day lives in the URL (`?date=`), not in component state, so the
 * server re-renders the dashboard for that date, the back button works, and a
 * dispatcher can send someone a link to a specific day. That also means every
 * selection is an RSC navigation — hence the useTransition, which is what drives
 * the pending state instead of a spinner over the map.
 */
export function DatePicker({ date, today }: DatePickerProps) {
  const { t, locale, direction } = useI18n();
  const router = useRouter();
  const [isPending, startNavigation] = useTransition();

  const [open, setOpen] = useState(false);
  /** Doubles as the grid's roving-focus cursor and the visible month's anchor. */
  const [cursor, setCursor] = useState(date);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const goToDate = useCallback(
    (target: string) => {
      setOpen(false);
      startNavigation(() => {
        // Today is the default view, so it gets the bare URL rather than a
        // redundant ?date= that would look stale in the address bar tomorrow.
        router.push(target === today ? '/' : `/?date=${target}`);
      });
    },
    [router, today],
  );

  // The cursor is only meaningful while the popover is open, so it is seeded on
  // open instead of being synced to `date` by an effect. That keeps it correct
  // after a back/forward navigation without a cascading render.
  const togglePopover = useCallback(() => {
    setOpen((previous) => {
      if (!previous) setCursor(date);
      return !previous;
    });
  }, [date]);

  // Close on outside click and on Escape, returning focus to the trigger so
  // keyboard users are not dumped at the top of the document.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Roving tabindex: only the cursor cell is tabbable, so the grid is one tab
  // stop rather than forty-two. Moving the cursor has to move real DOM focus.
  useEffect(() => {
    if (!open) return;
    const cell = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${cursor}"]`);
    cell?.focus();
  }, [open, cursor]);

  const onGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Horizontal keys follow the visual direction: in an RTL grid the previous
      // day sits to the right, so ArrowRight has to move backwards. Vertical keys
      // are unaffected — weeks run top to bottom in both directions.
      const back = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      const forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';

      const moves: Record<string, number> = {
        [back]: -1,
        [forward]: 1,
        ArrowUp: -7,
        ArrowDown: 7,
      };

      const step = moves[event.key];
      if (step !== undefined) {
        event.preventDefault();
        setCursor((current) => addDays(current, step));
        return;
      }

      if (event.key === 'PageUp' || event.key === 'PageDown') {
        event.preventDefault();
        setCursor((current) => addMonths(current, event.key === 'PageUp' ? -1 : 1));
      }
    },
    [direction],
  );

  const relativeKey = relativeDay(date, today);
  const days = monthGrid(cursor);
  const weekdays = weekdayInitials(locale);

  // In RTL the buttons swap sides, so the glyphs have to swap with them or
  // "previous" ends up on the right pointing left.
  const backGlyph = direction === 'rtl' ? '›' : '‹';
  const forwardGlyph = direction === 'rtl' ? '‹' : '›';

  return (
    <div className="flex items-center gap-1">
      <NavButton
        label={t.datePicker.previousDay}
        glyph={backGlyph}
        disabled={isPending}
        onClick={() => goToDate(addDays(date, -1))}
      />

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={togglePopover}
          className="flex min-w-[190px] items-center justify-center gap-2 rounded-md border border-[#e1e0d9] px-3 py-1.5 text-sm font-medium text-[#0b0b0b] transition-colors hover:bg-[#f9f9f7]"
        >
          <span aria-hidden className="text-[#898781]">
            ▤
          </span>
          <span className="tabular-nums">{formatFullDate(date, locale)}</span>
          {relativeKey ? (
            <span className="text-xs text-[#898781]">{t.datePicker[relativeKey]}</span>
          ) : null}
        </button>

        {open ? (
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={t.datePicker.chooseDate}
            className="absolute top-full left-1/2 z-20 mt-2 w-[268px] -translate-x-1/2 rounded-lg border border-[#e1e0d9] bg-white p-3 shadow-[0_10px_30px_rgba(11,11,11,0.14)]"
          >
            <div className="mb-2 flex items-center justify-between">
              <NavButton
                label={t.datePicker.previousMonth}
                glyph={backGlyph}
                onClick={() => setCursor((current) => addMonths(current, -1))}
              />
              <span aria-live="polite" className="text-sm font-medium text-[#0b0b0b]">
                {formatMonthYear(cursor, locale)}
              </span>
              <NavButton
                label={t.datePicker.nextMonth}
                glyph={forwardGlyph}
                onClick={() => setCursor((current) => addMonths(current, 1))}
              />
            </div>

            <div role="grid" ref={gridRef} onKeyDown={onGridKeyDown}>
              <div role="row" className="mb-1 grid grid-cols-7">
                {weekdays.map((weekday) => (
                  <abbr
                    key={weekday.key}
                    role="columnheader"
                    title={weekday.full}
                    aria-label={weekday.full}
                    className="grid h-6 place-items-center text-[10px] font-medium text-[#898781] no-underline"
                  >
                    {weekday.label}
                  </abbr>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-0.5">
                {days.map((day) => {
                  const isSelected = day.date === date;
                  const isToday = day.date === today;

                  return (
                    <div role="row" key={day.date} className="contents">
                      <button
                        role="gridcell"
                        type="button"
                        data-date={day.date}
                        // Only the cursor is tabbable — see the roving-tabindex effect.
                        tabIndex={day.date === cursor ? 0 : -1}
                        aria-selected={isSelected}
                        aria-current={isToday ? 'date' : undefined}
                        aria-label={formatFullDate(day.date, locale)}
                        onClick={() => goToDate(day.date)}
                        className={`mx-auto grid size-8 place-items-center rounded-full text-[12px] tabular-nums transition-colors ${
                          isSelected
                            ? 'bg-[#2a78d6] font-semibold text-white'
                            : day.inCurrentMonth
                              ? 'text-[#0b0b0b] hover:bg-[#f0efec]'
                              : 'text-[#c3c2b7] hover:bg-[#f9f9f7]'
                        } ${isToday && !isSelected ? 'ring-1 ring-[#2a78d6] ring-inset font-semibold' : ''}`}
                      >
                        {Number(day.date.slice(8))}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 flex justify-end border-t border-[#e1e0d9] pt-2">
              <button
                type="button"
                onClick={() => goToDate(today)}
                className="rounded-md px-2 py-1 text-xs font-medium text-[#2a78d6] transition-colors hover:bg-[#f0efec]"
              >
                {t.datePicker.jumpToToday}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <NavButton
        label={t.datePicker.nextDay}
        glyph={forwardGlyph}
        disabled={isPending}
        onClick={() => goToDate(addDays(date, 1))}
      />

      {relativeKey === 'today' ? null : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => goToDate(today)}
          className="ms-1 rounded-md border border-[#e1e0d9] px-2.5 py-1.5 text-xs font-medium text-[#52514e] transition-colors hover:bg-[#f9f9f7] disabled:opacity-60"
        >
          {t.datePicker.today}
        </button>
      )}

      {/* Announced to screen readers, and the only visual cue that a slower day
          is still loading — the map keeps the previous day until the RSC lands. */}
      <span
        role="status"
        aria-live="polite"
        className={`ms-1 text-xs text-[#898781] transition-opacity ${
          isPending ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {t.datePicker.loading}
      </span>
    </div>
  );
}

function NavButton({
  label,
  glyph,
  onClick,
  disabled = false,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md border border-[#e1e0d9] text-base leading-none text-[#52514e] transition-colors hover:bg-[#f9f9f7] disabled:opacity-60"
    >
      <span aria-hidden>{glyph}</span>
    </button>
  );
}
