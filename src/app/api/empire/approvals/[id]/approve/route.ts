import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';
import { approveToolApproval } from '@/spine/tools/approval.service';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

export async function POST(_request: Request, { params }: Params) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const result = await approveToolApproval(supabase, auth.data, params.id);
  return result.ok ? jsonResult(result) : jsonError(result.error);
}
