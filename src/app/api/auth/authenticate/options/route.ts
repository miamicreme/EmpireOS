import { jsonOk, jsonError } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createAdminClient, getOrCreateOwnerUserId } from '@/lib/auth/credentials';
import { isAccountClaimed, buildAuthenticationOptions } from '@/lib/auth/webauthn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Begin passkey login. */
export async function POST() {
  try {
    const admin = createAdminClient();
    if (!(await isAccountClaimed(admin))) {
      return jsonError(appError('not_found', 'No passkey registered yet. Set one up first.'));
    }
    const ownerId = await getOrCreateOwnerUserId(admin);
    const options = await buildAuthenticationOptions(admin, ownerId);
    return jsonOk(options);
  } catch (e) {
    return jsonError(appError('internal', (e as Error).message));
  }
}
