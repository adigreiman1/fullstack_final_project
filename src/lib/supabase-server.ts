import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase';
import type { Database } from '@/types/schema';

/**
 * Kept separate from lib/supabase.ts on purpose.
 *
 * This module imports `next/headers`, which is server-only. If it lived in the
 * same file as the browser client, any Client Component importing that file
 * would pull `next/headers` into the client bundle and fail to compile.
 * The `server-only` import above turns that mistake into a clear build error.
 */

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Must be created per request — never hoist this into a module-level constant,
 * or one user's session will leak into another's request.
 *
 * In Next.js 16 `cookies()` is async-only (synchronous access was removed in v16),
 * hence the await.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Components cannot write cookies. Supabase calls setAll after a
        // token refresh; in a Server Component render that throws, and the write
        // is correctly handled by proxy.ts instead. Swallowing it here is the
        // documented pattern — it is not hiding a real error.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — proxy.ts owns the refresh write.
        }
      },
    },
  });
}
