import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { createCashEntry, getCashEntriesForDate } from '@/modules/cash-engine/service';
import type { CreateCashEntryInput } from '@/spine/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') ?? undefined;
  return jsonResult(await getCashEntriesForDate(supabase, auth.data, date));
}

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as CreateCashEntryInput;
  return jsonResult(await createCashEntry(supabase, auth.data, body), 201);
}
