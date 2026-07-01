import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { createTransaction, getTransactions } from '@/modules/finances/service';
import type { CreateTransactionInput } from '@/modules/finances/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);
  return jsonResult(await getTransactions(supabase, auth.data));
}

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as CreateTransactionInput;
  return jsonResult(await createTransaction(supabase, auth.data, body), 201);
}
