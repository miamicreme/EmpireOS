import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Keep authentication, cookies, and passkeys on one host. WebAuthn credentials
 * are bound to their relying-party domain, so serving the same app from both a
 * Render hostname and a custom hostname creates misleading login failures.
 */
function canonicalRedirect(request: NextRequest): NextResponse | null {
  const configuredOrigin = process.env.WEBAUTHN_ORIGIN?.trim();
  if (!configuredOrigin) return null;

  try {
    const canonical = new URL(configuredOrigin);
    const currentHost = request.nextUrl.hostname;

    // Local development must remain usable even when production env values are
    // present in a developer shell.
    if (currentHost === 'localhost' || currentHost === '127.0.0.1') return null;
    if (currentHost === canonical.hostname) return null;

    const target = request.nextUrl.clone();
    target.protocol = canonical.protocol;
    target.host = canonical.host;
    return NextResponse.redirect(target, 308);
  } catch {
    // Environment validation elsewhere will surface a malformed origin. Do not
    // create a redirect loop here.
    return null;
  }
}

/**
 * Refreshes the Supabase session on every request and gates the app behind
 * passkey auth. API routes self-protect with JSON 401s. The enrollment page is
 * intentionally reachable before login because the one-time token is verified
 * by the enrollment API before any passkey can be registered.
 */
export async function middleware(request: NextRequest) {
  const redirect = canonicalRedirect(request);
  if (redirect) return redirect;

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
