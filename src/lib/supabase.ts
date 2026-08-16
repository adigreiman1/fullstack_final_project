import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types/schema';

/**
 * Shared Supabase config.
 *
 * Both values are NEXT_PUBLIC_ by design: the anon key is meant to be public and
 * is only safe because Row Level Security is enabled on every table. Read
 * failures that look like "no rows" are almost always an RLS policy, not a bug here.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Add it to .env.local and restart the dev server ` +
        `(Next.js only reads .env.local at startup).`,
    );
  }
  return value;
}

export const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

/**
 * Supabase client for Client Components.
 *
 * `createBrowserClient` is a singleton by default, so calling this on every
 * render is cheap — it returns the same instance and reads auth from cookies
 * written by proxy.ts / the auth Server Actions.
 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
