import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase';

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`.
 * The exported function must be named `proxy`, and the runtime is always
 * Node.js (the `edge` runtime is not supported here and `runtime` cannot be set).
 *
 * Two jobs:
 *  1. Refresh the Supabase session and write the rotated auth cookies onto the
 *     response. Without this, tokens silently expire and users get logged out.
 *  2. Gate routes — send unauthenticated visitors to /login.
 */

/** Paths reachable without a session. Everything else requires auth. */
const PUBLIC_PATHS = ['/login'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  // Mutated by setAll below, then copied onto any redirect we return.
  const response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
        // Supabase passes Cache-Control/Expires/Pragma here. These must be
        // applied or a CDN can cache a response carrying Set-Cookie auth
        // tokens and serve one user's session to another.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Must be awaited before the response is generated, otherwise a refresh that
  // completes late cannot write its cookies and every request re-refreshes.
  // getClaims() verifies the JWT signature; getSession() alone is not trustworthy
  // for identity because cookies are user-writable.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);

  const { pathname, search } = request.nextUrl;

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    // Query string included, not just the pathname: a shared link to a specific
    // day (/?date=2026-08-10) opened by a logged-out dispatcher has to survive
    // the login round trip, or they land on today and wonder what went wrong.
    // safeRedirectTo() in actions/auth.ts still holds this to a relative path.
    url.searchParams.set('redirectTo', `${pathname}${search}`);
    return copyCookies(response, NextResponse.redirect(url));
  }

  if (isAuthenticated && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return copyCookies(response, NextResponse.redirect(url));
  }

  return response;
}

/** Carry refreshed auth cookies across a redirect, or the refresh is lost. */
function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and image files. Without this,
     * auth redirects would also intercept CSS, JS and images.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
