import { createClient } from '@/lib/supabase/server';
import { requireUserId, containsHighRiskSecret } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import {
  deleteMemoryItem,
  updateMemoryItem,
} from '@/spine/ai/agent/agent-repository.service';
import { updateMemorySchema } from '@/spine/ai/agent/agent.schemas';

export const dynamic = 'force-dynamic';

/** PATCH /api/ai/agent/memory/:id — update approved durable memory safely. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const parsed = updateMemorySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError({ code: 'validation', message: 'Invalid memory update.' });
  }

  const text = `${parsed.data.title ?? ''} ${parsed.data.content ?? ''} ${parsed.data.summary ?? ''}`;
  if (containsHighRiskSecret(text)) {
    return jsonError(appError('redaction_blocked', 'Refusing to store memory containing high-risk secrets.'));
  }

  return jsonResult(
    await updateMemoryItem(supabase, auth.data, params.id, {
      memory_type: parsed.data.memoryType,
      title: parsed.data.title,
      content: parsed.data.content,
      summary: parsed.data.summary,
      source: parsed.data.source,
      confidence: parsed.data.confidence,
      status: parsed.data.status,
    }),
  );
}

/** DELETE /api/ai/agent/memory/:id — soft-delete memory. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await deleteMemoryItem(supabase, auth.data, params.id));
}
