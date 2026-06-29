import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { getCurrentWeeklyReview, upsertWeeklyReview } from '@/spine/reviews/review.service';
import type { CreateWeeklyReviewInput } from '@/spine/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);
  return jsonResult(await getCurrentWeeklyReview(supabase, auth.data));
}

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as CreateWeeklyReviewInput;
  return jsonResult(await upsertWeeklyReview(supabase, auth.data, body), 201);
}
