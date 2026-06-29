import { jsonOk } from '@/lib/api';
import { clearSession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  await clearSession();
  return jsonOk({ ok: true });
}
