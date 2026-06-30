import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, jsonResult } from '@/lib/api';
import { resolveCredentialForId } from '@/spine/ai/providers/provider-config.service';
import { callAI } from '@/spine/ai/provider';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/providers/:id/test
 *
 * Makes a minimal live call with the configured provider + key to confirm it
 * works. Returns { ok, provider, model, latencyMs } — never the key. Errors are
 * surfaced as a failed test, not a 500, so the UI can show "couldn't connect".
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const cred = await resolveCredentialForId(supabase, auth.data, params.id);
  if (!cred.ok) return jsonResult(cred);

  const started = Date.now();
  try {
    const response = await callAI(
      [{ role: 'user', content: 'Reply with the single word: OK' }],
      { credential: cred.data, model: cred.data.model, maxTokens: 8, temperature: 0 },
    );
    return jsonOk({
      ok: true,
      provider: response.provider,
      model: response.model,
      latencyMs: Date.now() - started,
      sample: response.text.slice(0, 40),
    });
  } catch (error) {
    return jsonOk({
      ok: false,
      provider: cred.data.provider,
      model: cred.data.model,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Provider call failed',
    });
  }
}
