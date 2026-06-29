import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonOk } from '@/lib/api';
import { createAdminClient } from '@/lib/auth/credentials';
import { isAccountClaimed } from '@/lib/auth/webauthn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Reports auth state for the login UI:
 * - configured: server has the env needed for passkeys
 * - claimed: an owner passkey already exists (login) vs not (first-time setup)
 * - authenticated: the caller already has a valid session
 */
export async function GET() {
  let configured = true;
  let claimed = false;
  try {
    const admin = createAdminClient();
    claimed = await isAccountClaimed(admin);
  } catch {
    configured = false;
  }

  let authenticated = false;
  try {
    const supabase = createClient();
    const auth = await requireUserId(supabase);
    authenticated = auth.ok;
  } catch {
    authenticated = false;
  }

  return jsonOk({ configured, claimed, authenticated });
}
