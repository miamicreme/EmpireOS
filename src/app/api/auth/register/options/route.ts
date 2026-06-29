import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonOk, jsonError } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createAdminClient, getOrCreateOwnerUserId } from '@/lib/auth/credentials';
import { isAccountClaimed, buildRegistrationOptions } from '@/lib/auth/webauthn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Begin passkey registration.
 * - First passkey ever → claims the owner account (bootstrap).
 * - Subsequent passkeys → require an authenticated session (recovery devices).
 */
export async function POST() {
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

    const options = await buildRegistrationOptions(admin, userId);
    return jsonOk(options);
  } catch (e) {
    return jsonError(appError('internal', (e as Error).message));
  }
}
