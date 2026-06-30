import { timingSafeEqual } from 'node:crypto';
import { getOwnerRecoveryCode } from '@/lib/env';
import { createAdminClient, wipeAllCredentials } from '@/lib/auth/credentials';
import { jsonOk, jsonError, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Constant-time string compare that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Break-glass recovery for a locked-out owner: when the device holding the
 * passkey is lost or wiped, the stored credential can no longer be satisfied,
 * leaving the account "claimed" but unusable. Proving knowledge of the
 * server-set OWNER_RECOVERY_CODE clears the passkeys so the owner can register
 * a fresh device. Disabled entirely when no recovery code is configured.
 */
export async function POST(request: Request) {
  const configured = getOwnerRecoveryCode();
  if (!configured) {
    return jsonError(
      appError('forbidden', 'Recovery is disabled. Set OWNER_RECOVERY_CODE on the server to enable it.'),
    );
  }

  const body = (await readJson(request)) as { code?: string };
  const code = body.code?.trim();
  if (!code || !safeEqual(code, configured)) {
    return jsonError(appError('unauthorized', 'Incorrect recovery code.'));
  }

  const removed = await wipeAllCredentials(createAdminClient());
  return jsonOk({ reset: true, removed });
}
