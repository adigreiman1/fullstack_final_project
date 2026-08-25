import { signOut } from '@/actions/auth';
import { getDailyTasks } from '@/actions/tasks';
import { DatePicker } from '@/components/DatePicker';
import { MapDashboard } from '@/components/MapDashboard';
import { isIsoDate, todayInServiceTimezone } from '@/lib/utils';
import Image from 'next/image';

export default async function DashboardPage({ searchParams }: PageProps<'/'>) {
  const { date: requestedDate } = await searchParams;

  const today = todayInServiceTimezone();
  const date = isIsoDate(requestedDate) ? requestedDate : today;

  const { tasks, error } = await getDailyTasks(date);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="relative isolate z-50 flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-[#eef4ff] px-6 py-2 shadow-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[url('/chrome-bg.png')] bg-cover bg-center opacity-20 mix-blend-multiply"
        />
        
        {/* צד ימין: לוגו נקי ורגיל */}
        <div className="flex shrink-0 items-center">
          <Image 
            src="/logo2.png" 
            alt="A-Route Logo" 
            width={200} 
            height={66} 
            className="h-12 w-auto object-contain mix-blend-multiply"
            priority 
          />
        </div>

        <DatePicker date={date} today={today} />

        <div className="flex items-center gap-8">
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[#1a2035] transition-colors hover:bg-[#f7f0ff]"
            >
              התנתקות
            </button>
          </form>
        </div>
      </header>

      <MapDashboard tasks={tasks} date={date} loadError={error} />
    </div>
  );
}