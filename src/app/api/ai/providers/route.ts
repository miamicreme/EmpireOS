import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult, readJson } from '@/lib/api';
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
  return jsonResult(await createProvider(supabase, auth.data, body), 201);
}
