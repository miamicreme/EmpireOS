import { randomUUID } from 'crypto';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import { createToolApproval } from '@/spine/tools/approval.service';
import { getTool } from '@/spine/tools/tool-registry';

export const dynamic = 'force-dynamic';

const schema = z.object({
  toolId: z.string().min(1).max(120),
  input: z.unknown(),
  summary: z.string().trim().min(1).max(500),
  exactEffect: z.string().trim().min(1).max(2000),
  traceId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(appError('validation', 'Invalid approval request.', parsed.error.format()));

  const tool = getTool(parsed.data.toolId);
  if (!tool) return jsonError(appError('tool_not_found', 'Requested tool is not registered.'));

  const validInput = tool.inputSchema.safeParse(parsed.data.input);
  if (!validInput.success) {
    return jsonError(appError('validation', 'Approval input does not match the tool contract.', validInput.error.format()));
  }

  const result = await createToolApproval(
    supabase,
    auth.data,
    parsed.data.traceId ?? randomUUID(),
    tool,
    validInput.data,
    parsed.data.summary,
    parsed.data.exactEffect,
    parsed.data.runId,
  );
  return result.ok ? jsonResult(result) : jsonError(result.error);
}
