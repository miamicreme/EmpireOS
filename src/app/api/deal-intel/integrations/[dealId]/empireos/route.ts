import { createClient } from '@/lib/supabase/server'; import { requireUserId } from '@/lib/security'; import { jsonError, jsonResult } from '@/lib/api'; import { getEmpireOSSummary } from '@/modules/deal-intel/service';
export const dynamic = 'force-dynamic';
export async function GET(_: Request, { params }: { params: { dealId: string } }) { const supabase = createClient(); const auth = await requireUserId(supabase); if (!auth.ok) return jsonError(auth.error); return jsonResult(await getEmpireOSSummary(supabase, params.dealId)); }
