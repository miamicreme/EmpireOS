import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { jsonOk, jsonError, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createAdminClient } from '@/lib/auth/credentials';
import { verifyAuthentication } from '@/lib/auth/webauthn';
import { establishOwnerSession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  response: AuthenticationResponseJSON;
}

export async function POST(request: Request) {
  try {
    const admin = createAdminClient();
    const body = (await readJson(request)) as Body;
    if (!body?.response) {
      return jsonError(appError('validation', 'Missing authentication response.'));
    }

    const result = await verifyAuthentication(admin, body.response);
    if (!result.ok) {
      return jsonError(appError('unauthorized', 'Passkey verification failed.'));
    }

    await establishOwnerSession(admin);
    return jsonOk({ verified: true });
  } catch (e) {
    return jsonError(appError('internal', (e as Error).message));
  }
}
