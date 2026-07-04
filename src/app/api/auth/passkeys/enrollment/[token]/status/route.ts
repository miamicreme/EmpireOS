import { jsonOk, jsonError } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createAdminClient } from '@/lib/auth/credentials';
import { getEnrollmentStatus } from '@/lib/auth/passkey-enrollment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { token: string } }) {
  try {
    const status = await getEnrollmentStatus(createAdminClient(), params.token);
    return jsonOk(status);
  } catch (e) {
    return jsonError(appError('internal', (e as Error).message));
  }
}
