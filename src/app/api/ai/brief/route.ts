import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult, readJson } from '@/lib/api';
import { generateDailyBrief, getBrief } from '@/spine/ai/daily-brief.service';
import { generateBriefInputSchema } from '@/spine/ai/ai.schemas';

export const dynamic = 'force-dynamic';

/** GET today's brief (daily by default; pass ?type=weekly for the weekly one). */
export async function GET(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const url = new URL(request.url);
  const briefType = url.searchParams.get('type') === 'weekly' ? 'weekly' : 'daily';
  return jsonResult(await getBrief(supabase, auth.data, { briefType }));
}

/** POST generates (and by default persists) a fresh brief. */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const parsed = generateBriefInputSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError({ code: 'validation', message: 'Invalid brief input.' });
  }

  const result = await generateDailyBrief(supabase, auth.data, {
    briefType: parsed.data.briefType,
    persist: parsed.data.persist,
  });
  if (!result.ok) return jsonResult(result);

  return jsonOk({ brief: result.data.brief, saved: result.data.saved }, 201);
}
