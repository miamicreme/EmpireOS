/**
 * Session refresh helper for Next.js middleware. Keeps the Supabase auth
 * cookie fresh on navigation. Wire up via a root `middleware.ts` when auth UI
 * is added (frontend phase) — included now so the backend is auth-ready.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Not configured yet → no session, but never 500 the app.
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return { response, user: null };
  }

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refreshes the session if needed. Do not run logic between client creation
  // and this call (Supabase SSR requirement).
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { response, user };
  } catch {
    return { response, user: null };
  }
}
