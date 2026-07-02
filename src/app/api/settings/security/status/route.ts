import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { getOwnerRecoveryCode } from '@/lib/env';
import { ok } from '@/lib/result';

export const dynamic = 'force-dynamic';

/** GET /api/settings/security/status — owner-scoped, secret-free security posture. */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const passkeys = await supabase
    .from('webauthn_credentials')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.data);

  return jsonResult(
    ok({
      authenticated: true,
      passkeyCount: passkeys.count ?? 0,
      passkeysConfigured: (passkeys.count ?? 0) > 0,
      recoveryEnabled: Boolean(getOwnerRecoveryCode()),
      secretValuesReturned: false,
    }),
  );
}
