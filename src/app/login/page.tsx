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
      
      {/* הורדנו את מגבלת הרוחב הכללית כדי לתת ללוגו לגדול חופשי */}
      <div className="flex w-full flex-col items-center gap-10">
        
        {/* אזור הלוגו המוגדל משמעותית */}
        <div className="flex flex-col items-center gap-2 text-center">
          <Image 
            src="/logo2.png" 
            alt="A-Route Logo" 
            width={550} 
            height={180} 
            className="object-contain mix-blend-multiply max-w-full"
            priority 
          />
          <p className="text-base text-slate-600 mt-2">
            התחבר/י כדי לצפות במסלולי היום
          </p>
        </div>

        {/* אזור הטופס - מוגבל ברוחב כדי לשמור על פרופורציות נוחות להקלדה */}
        <div className="w-full max-w-sm">
          <LoginForm redirectTo={destination} />
        </div>
      </div>
    </main>
  );
}