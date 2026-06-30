import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
import { appError } from '@/lib/errors';
import {
  listProviders,
  createProvider,
} from '@/spine/ai/providers/provider-config.service';
import type { CreateProviderInput } from '@/spine/ai/providers/provider-config.schemas';

export const dynamic = 'force-dynamic';

/** GET the user's configured AI providers (secret-free). */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  return jsonResult(await listProviders(supabase, auth.data));
}

/** POST add a provider (max 5; API key encrypted server-side, never returned). */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const body = (await readJson(request)) as CreateProviderInput;
  try {
    return jsonResult(await createProvider(supabase, auth.data, body), 201);
  } catch (e) {
    // Never leak an opaque 500 — surface a usable message to the settings UI.
    return jsonError(appError('internal', `Could not save provider: ${(e as Error).message}`));
  }
}
