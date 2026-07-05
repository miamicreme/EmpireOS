import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Refreshes the Supabase session on every request and gates the app behind
 * passkey auth. API routes self-protect with JSON 401s. The enrollment page is
 * intentionally reachable before login because the one-time token is verified
 * by the enrollment API before any passkey can be registered.
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api');
  const isLogin = pathname === '/login';
  const isPasskeyEnrollment = pathname.startsWith('/passkeys/enroll/');

  if (user && isLogin) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!user && !isApi && !isLogin && !isPasskeyEnrollment) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
