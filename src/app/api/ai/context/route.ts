import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { appError } from '@/lib/errors';
import { buildEmpireContext } from '@/spine/ai/context/empire-context.service';
import { saveContextSnapshot } from '@/spine/ai/context/context-snapshot.service';

export const dynamic = 'force-dynamic';

/** GET the current user's full (redacted-on-build) EmpireContext. */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  try {
    return jsonResult(await buildEmpireContext(supabase, auth.data));
  } catch (e) {
    return jsonError(appError('internal', `Failed to build context: ${(e as Error).message}`));
  }
}

/** POST builds the context and persists a redacted snapshot. */
export async function POST() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  try {
    const ctx = await buildEmpireContext(supabase, auth.data);
    if (!ctx.ok) return jsonResult(ctx);

    const snapshot = await saveContextSnapshot(supabase, auth.data, ctx.data);
    return jsonResult(snapshot, 201);
  } catch (e) {
    return jsonError(appError('internal', `Failed to build context: ${(e as Error).message}`));
  }
}
