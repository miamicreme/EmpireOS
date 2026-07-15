import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import {
  continueEmpireRun,
  continueEmpireRunSchema,
} from '@/spine/empire/empire.service';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

/** POST /api/empire/runs/[id]/continue — execute one approved pending operation. */
export async function POST(request: Request, { params }: Params) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = await readJson(request);
  const parsed = continueEmpireRunSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError({
      code: 'validation',
      message: 'Invalid Empire continuation.',
      details: parsed.error.format(),
    });
  }

  const result = await continueEmpireRun(supabase, auth.data, params.id, parsed.data);
  return result.ok ? jsonResult(result) : jsonError(result.error);
}
