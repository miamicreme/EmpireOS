import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonOk, jsonError } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createAdminClient, listCredentials } from '@/lib/auth/credentials';
import { createEnrollmentToken } from '@/lib/auth/passkey-enrollment';
import { getWebAuthnConfig } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = createClient();
    const auth = await requireUserId(supabase);
    if (!auth.ok) return jsonError(auth.error);

    const admin = createAdminClient();
    const creds = await listCredentials(admin, auth.data);
    const h = headers();
    const labelHint = creds.length > 0 ? `Pair ${creds.length + 1}` : 'Pair iPhone / iPad';
    const created = await createEnrollmentToken(admin, auth.data, {
      labelHint,
      createdUserAgent: h.get('user-agent'),
      createdIp: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
    });

    const { origin } = getWebAuthnConfig();
    return jsonOk({
      enrollmentUrl: created.enrollmentUrl,
      qrPayload: created.qrPayload,
      labelHint: created.labelHint,
      expiresAt: created.expiresAt,
      nextUrl: new URL('/today', origin).toString(),
    });
  } catch (e) {
    return jsonError(appError('internal', (e as Error).message));
  }
}
