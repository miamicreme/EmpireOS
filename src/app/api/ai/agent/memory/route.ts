import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { saveMemoryItem } from '@/spine/ai/agent/memory-gate.service';
import { listMemoryItems } from '@/spine/ai/agent/agent-repository.service';
import { saveMemorySchema } from '@/spine/ai/agent/agent.schemas';

export const dynamic = 'force-dynamic';

/** GET list durable memory (secret-free, owner scoped by RLS + auth). */
export async function GET(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const status = new URL(request.url).searchParams.get('status') ?? 'active';
  return jsonResult(await listMemoryItems(supabase, auth.data, status));
}

/** POST save durable memory (the "Save memory" control). Refuses secrets. */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const parsed = saveMemorySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError({ code: 'validation', message: 'Invalid memory input.' });
  }

  return jsonResult(await saveMemoryItem(supabase, auth.data, parsed.data), 201);
}
