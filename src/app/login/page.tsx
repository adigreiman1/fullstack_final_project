import { LoginForm } from '@/components/LoginForm';

export const metadata = {
  title: 'Sign in · Service Mobility',
};

export default async function LoginPage(props: PageProps<'/login'>) {
  // searchParams is a Promise in Next.js 16 — synchronous access was removed.
  const { redirectTo } = await props.searchParams;
  const destination = typeof redirectTo === 'string' ? redirectTo : '/';

  return (
    <main className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[url('/chrome-bg.png')] bg-cover bg-center opacity-20 mix-blend-multiply"
      />
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Service Mobility
          </h1>
          <p className="text-sm text-slate-600">
            Sign in to view today’s routes.
          </p>
        </div>

        <LoginForm redirectTo={destination} />
      </div>
    </main>
  );
}
