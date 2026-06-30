import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { saveMemoryItem } from '@/spine/ai/agent/memory-gate.service';
import { saveMemorySchema } from '@/spine/ai/agent/agent.schemas';

export const dynamic = 'force-dynamic';

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
