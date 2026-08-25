import { LoginForm } from '@/components/LoginForm';
import Image from 'next/image';

export const metadata = {
  title: 'Sign in · A-Route',
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
        
        {/* אזור הלוגו והכותרת */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Image 
            src="/logo.png" 
            alt="A-Route Logo" 
            width={140} 
            height={140} 
            className="object-contain"
            priority 
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1a2035]">
              A-Route
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              התחברי כדי לצפות במסלולי היום
            </p>
          </div>
        </div>

        <LoginForm redirectTo={destination} />
      </div>
    </main>
  );
}