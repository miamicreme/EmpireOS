import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import {
  continueJarvisRun,
  continueJarvisRunSchema,
} from '@/spine/jarvis/jarvis.service';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

/** POST /api/jarvis/runs/[id]/continue — execute one approved pending operation. */
export async function POST(request: Request, { params }: Params) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = await readJson(request);
  const parsed = continueJarvisRunSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError({
      code: 'validation',
      message: 'Invalid Jarvis continuation.',
      details: parsed.error.format(),
    });
  }

  const result = await continueJarvisRun(supabase, auth.data, params.id, parsed.data);
  return result.ok ? jsonResult(result) : jsonError(result.error);
}
