/**
 * Short-lived WebAuthn challenge storage. The challenge generated when issuing
 * registration/authentication options must be echoed back at verification time.
 * We hold it in an httpOnly cookie so the flow stays stateless (no extra table).
 */
import { cookies } from 'next/headers';

const COOKIE = 'eo_webauthn_challenge';
const MAX_AGE = 300; // 5 minutes

export function setChallenge(challenge: string): void {
  cookies().set(COOKIE, challenge, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function getChallenge(): string | null {
  return cookies().get(COOKIE)?.value ?? null;
}

export function clearChallenge(): void {
  cookies().set(COOKIE, '', { path: '/', maxAge: 0 });
}
