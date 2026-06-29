import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonOk, jsonError } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createAdminClient, listCredentials } from '@/lib/auth/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** List the owner's registered passkeys (public metadata only — no keys). */
export async function GET() {
  try {
    const supabase = createClient();
    const auth = await requireUserId(supabase);
    if (!auth.ok) return jsonError(auth.error);

    const admin = createAdminClient();
    const creds = await listCredentials(admin, auth.data);
    return jsonOk(
      creds.map((c) => ({
        id: c.id,
        label: c.label,
        device_type: c.device_type,
        backed_up: c.backed_up,
        created_at: c.created_at,
        last_used_at: c.last_used_at,
      })),
    );
  } catch (e) {
    return jsonError(appError('internal', (e as Error).message));
  }
}
