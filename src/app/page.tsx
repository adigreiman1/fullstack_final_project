import { signOut } from '@/actions/auth';
import { getDailyTasks } from '@/actions/tasks';
import { DatePicker } from '@/components/DatePicker';
import { LanguageToggle } from '@/components/LanguageToggle';
import { MapDashboard } from '@/components/MapDashboard';
import { getDictionary } from '@/lib/i18n';
import { getLanguage } from '@/lib/language-server';
import { isIsoDate, todayInServiceTimezone } from '@/lib/utils';

/**
 * Server Component: fetches the requested day's tasks and hands them to the
 * client map. Grouping by vehicle and the Optimization API call both live
 * client-side in MapDashboard, so filtering never costs a round trip.
 *
 * The selected day comes from `?date=`, which makes this route dynamic — each day
 * is a fresh render rather than client-side refetching, and the URL is shareable.
 */
export default async function DashboardPage({ searchParams }: PageProps<'/'>) {
  const { date: requestedDate } = await searchParams;

  // The dictionary is plain data, so the shell's strings are translated on the
  // server — no client component needed just to render a heading.
  const language = await getLanguage();
  const t = getDictionary(language);

  const today = todayInServiceTimezone();
  // A hand-edited or stale ?date= must not reach the query as a Postgres date
  // literal, so anything that is not a real calendar date falls back to today.
  const date = isIsoDate(requestedDate) ? requestedDate : today;

  const { tasks, error } = await getDailyTasks(date);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="relative isolate z-50 flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-sky-50 px-6 py-3 shadow-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[url('/chrome-bg.png')] bg-cover bg-center opacity-20 mix-blend-multiply"
        />
        <h1 className="text-xl font-bold tracking-tight text-indigo-900">{t.header.title}</h1>

        <DatePicker date={date} today={today} />

        <div className="flex items-center gap-2">
          <LanguageToggle />

          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              {t.header.signOut}
            </button>
          </form>
        </div>
      </header>

      <MapDashboard tasks={tasks} date={date} loadError={error} />
    </div>
  );
}
