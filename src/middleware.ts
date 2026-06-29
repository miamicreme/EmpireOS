import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Refreshes the Supabase session on every request and gates the app behind
 * passkey auth: unauthenticated page navigations are redirected to /login.
 * API routes pass through (they self-protect via requireUserId and return JSON
 * 401s rather than redirects).
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api');
  const isLogin = pathname === '/login';

  // Signed-in users hitting /login go straight to the dashboard.
  if (user && isLogin) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Unauthenticated page navigations → login. APIs and the login page pass through.
  if (!user && !isApi && !isLogin) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     * Auth cookies must be refreshed on every server-rendered request.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
