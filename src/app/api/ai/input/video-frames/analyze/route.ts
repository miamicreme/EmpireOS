import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { universalInputAnalyzeSchema } from '@/spine/ai/agent/agent.schemas';
import { analyzeUniversalInput } from '@/spine/ai/agent/universal-input.service';

export const dynamic = 'force-dynamic';

/** POST /api/ai/input/video-frames/analyze — analyze up to 10 sampled frames. */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const parsed = universalInputAnalyzeSchema.safeParse({
    ...(await readJson(request) as Record<string, unknown>),
    inputType: 'video_frames',
  });
  if (!parsed.success) {
    return jsonError({ code: 'validation', message: 'Invalid video frame payload.' });
  }

  return jsonResult(await analyzeUniversalInput(supabase, auth.data, parsed.data), 201);
}
