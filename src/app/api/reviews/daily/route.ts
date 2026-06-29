import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { getDailyReview, upsertDailyReview } from '@/spine/reviews/review.service';
import type { CreateDailyReviewInput } from '@/spine/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') ?? undefined;
  return jsonResult(await getDailyReview(supabase, auth.data, date));
}

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as CreateDailyReviewInput;
  return jsonResult(await upsertDailyReview(supabase, auth.data, body), 201);
}
