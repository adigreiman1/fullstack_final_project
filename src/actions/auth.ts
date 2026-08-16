'use server';

import { redirect } from 'next/navigation';

import { createServerSupabase } from '@/lib/supabase-server';

/** Shape consumed by useActionState in the login form. */
export interface AuthFormState {
  error: string | null;
}

/**
 * Only allow same-origin relative paths as a post-login destination.
 * Without this check, /login?redirectTo=https://evil.example becomes an
 * open redirect that phishes users straight after a real login.
 */
function safeRedirectTo(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const destination = safeRedirectTo(formData.get('redirectTo'));

  if (!email || !password) {
    return { error: 'Email and password are both required.' };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately generic: distinguishing "no such user" from "wrong password"
    // lets an attacker enumerate valid dispatcher accounts.
    return { error: 'Invalid email or password.' };
  }

  // redirect() throws a control-flow signal, so it must sit outside any try/catch
  // or the framework will treat the redirect as a caught error.
  redirect(destination);
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}
