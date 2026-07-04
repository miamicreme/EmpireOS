import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { headers } from 'next/headers';
import { jsonOk, jsonError, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createAdminClient } from '@/lib/auth/credentials';
import { verifyRegistration } from '@/lib/auth/webauthn';
import { establishOwnerSession } from '@/lib/auth/session';
import { getValidEnrollmentToken, markEnrollmentTokenUsed } from '@/lib/auth/passkey-enrollment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  response: RegistrationResponseJSON;
  label?: string | null;
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const admin = createAdminClient();
    const token = await getValidEnrollmentToken(admin, params.token);
    const body = (await readJson(request)) as Body;
    if (!body?.response) {
      return jsonError(appError('validation', 'Missing registration response.'));
    }

    const verified = await verifyRegistration(admin, token.user_id, body.response, body.label ?? token.label_hint ?? null);
    if (!verified) {
      return jsonError(appError('validation', 'Passkey registration could not be verified.'));
    }

    const h = headers();
    await markEnrollmentTokenUsed(admin, token.id, {
      consumedUserAgent: h.get('user-agent'),
      consumedIp: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
    });
    await establishOwnerSession(admin);
    return jsonOk({ verified: true, nextUrl: '/today' });
  } catch (e) {
    return jsonError(appError('internal', (e as Error).message));
  }
}
