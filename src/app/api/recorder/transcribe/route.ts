import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { ok } from '@/lib/result';
import { executeTool } from '@/spine/tools/tool-executor';

export const dynamic = 'force-dynamic';

interface Body {
  id?: string;
}

/** POST /api/recorder/transcribe — governed recorder.transcribe tool execution. */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as Body;
  if (!body.id) return jsonError(appError('validation', 'id is required.'));

  const traceId = request.headers.get('x-trace-id') ?? randomUUID();
  const result = await executeTool(
    'recorder.transcribe',
    {
      userId: auth.data,
      supabase,
      traceId,
    },
    { recordingId: body.id },
  );

  if (!result.ok) return jsonError(result.error);
  return jsonResult(ok(result.data));
}
