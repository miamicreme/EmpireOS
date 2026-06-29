import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonOk, jsonError, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createAdminClient, getOrCreateOwnerUserId } from '@/lib/auth/credentials';
import { isAccountClaimed, verifyRegistration } from '@/lib/auth/webauthn';
import { establishOwnerSession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  response: RegistrationResponseJSON;
  label?: string | null;
}

export async function POST(request: Request) {
  try {
    const admin = createAdminClient();
    const claimed = await isAccountClaimed(admin);

    let userId: string;
    if (claimed) {
      const supabase = createClient();
      const auth = await requireUserId(supabase);
      if (!auth.ok) {
        return jsonError(appError('unauthorized', 'Sign in to register another passkey.'));
      }
      userId = auth.data;
    } else {
      userId = await getOrCreateOwnerUserId(admin);
    }

    const body = (await readJson(request)) as Body;
    if (!body?.response) {
      return jsonError(appError('validation', 'Missing registration response.'));
    }

    const verified = await verifyRegistration(admin, userId, body.response, body.label ?? null);
    if (!verified) {
      return jsonError(appError('validation', 'Passkey registration could not be verified.'));
    }

    // Bootstrap: log the owner in immediately after their first passkey.
    if (!claimed) {
      await establishOwnerSession(admin);
    }
    return jsonOk({ verified: true });
  } catch (e) {
    return jsonError(appError('internal', (e as Error).message));
  }
}
