import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { createDealFromRawInput } from '@/modules/deal-intel/service';
import type { CreateDealIntelDealInput } from '@/modules/deal-intel/schemas';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { const supabase = createClient(); const auth = await requireUserId(supabase); if (!auth.ok) return jsonError(auth.error); const body = (await readJson(request)) as CreateDealIntelDealInput; return jsonResult(await createDealFromRawInput(supabase, auth.data, body), 201); }
