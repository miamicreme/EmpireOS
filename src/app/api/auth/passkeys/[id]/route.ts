import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonOk, jsonError } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createAdminClient, deleteCredential, listCredentials } from '@/lib/auth/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Remove a recovery passkey. Refuses to delete the last one (lockout guard). */
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const auth = await requireUserId(supabase);
    if (!auth.ok) return jsonError(auth.error);

    const admin = createAdminClient();
    const creds = await listCredentials(admin, auth.data);
    if (creds.length <= 1) {
      return jsonError(
        appError('validation', 'Cannot remove your only passkey — register another first.'),
      );
    }

    await deleteCredential(admin, auth.data, params.id);
    return jsonOk({ deleted: true });
  } catch (e) {
    return jsonError(appError('internal', (e as Error).message));
  }
}
