import { jsonOk, jsonError } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createAdminClient, listCredentials } from '@/lib/auth/credentials';
import { buildRegistrationOptions } from '@/lib/auth/webauthn';
import { getValidEnrollmentToken } from '@/lib/auth/passkey-enrollment';
import { headers } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_: Request, { params }: { params: { token: string } }) {
  try {
    const admin = createAdminClient();
    const token = await getValidEnrollmentToken(admin, params.token);
    const creds = await listCredentials(admin, token.user_id);
    const options = await buildRegistrationOptions(admin, token.user_id);
    const h = headers();
    return jsonOk({
      ...options,
      allowExistingCount: creds.length,
      labelHint: token.label_hint,
      createdUserAgent: h.get('user-agent'),
    });
  } catch (e) {
    return jsonError(appError('validation', (e as Error).message));
  }
}
