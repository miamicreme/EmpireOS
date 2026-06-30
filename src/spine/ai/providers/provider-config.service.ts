/**
 * AI Provider configuration service.
 *
 * Owns the user's configured LLM providers (max 5). API keys are encrypted at
 * rest and NEVER returned to the client — every read maps the DB row to a
 * secret-free public shape. `resolveUserCredential` is the server-only path the
 * AI layer uses to obtain a usable provider + decrypted key.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { aiKeys } from '@/lib/env';
import { encryptSecret, decryptSecret, secretHint } from '@/lib/crypto';
import type { AICredential } from '../provider';
import {
  MAX_PROVIDERS,
  createProviderSchema,
  updateProviderSchema,
  type AIProviderKind,
  type CreateProviderInput,
  type UpdateProviderInput,
} from './provider-config.schemas';

const TABLE = 'ai_providers';

/** DB row shape (includes the secret cipher — never leaves the server). */
interface ProviderRow {
  id: string;
  user_id: string;
  label: string;
  provider: AIProviderKind;
  model: string;
  api_key_cipher: string | null;
  api_key_hint: string | null;
  is_default: boolean;
  enabled: boolean;
  rank: number;
  created_at: string;
  updated_at: string;
}

/** Public, secret-free shape returned by the API. */
export interface ProviderConfig {
  id: string;
  label: string;
  provider: AIProviderKind;
  model: string;
  apiKeyHint: string | null;
  hasOwnKey: boolean;
  usesEnvKey: boolean;
  isDefault: boolean;
  enabled: boolean;
  rank: number;
  createdAt: string;
}

function toPublic(row: ProviderRow): ProviderConfig {
  const hasOwnKey = Boolean(row.api_key_cipher);
  return {
    id: row.id,
    label: row.label,
    provider: row.provider,
    model: row.model,
    apiKeyHint: row.api_key_hint,
    hasOwnKey,
    // When no own key is stored, the provider falls back to an env key (if any).
    usesEnvKey: !hasOwnKey && Boolean(aiKeys[row.provider]),
    isDefault: row.is_default,
    enabled: row.enabled,
    rank: row.rank,
    createdAt: row.created_at,
  };
}

export async function listProviders(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<ProviderConfig[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('rank', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []).map((r) => toPublic(r as ProviderRow)));
}

async function countProviders(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

async function clearDefault(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase
    .from(TABLE)
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true);
}

export async function createProvider(
  supabase: SupabaseClient,
  userId: string,
  input: CreateProviderInput,
): Promise<AppResult<ProviderConfig>> {
  const parsed = createProviderSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid provider input.', parsed.error.format()));
  }
  const v = parsed.data;

  const count = await countProviders(supabase, userId);
  if (count >= MAX_PROVIDERS) {
    return err(
      appError('conflict', `You can configure at most ${MAX_PROVIDERS} AI providers.`),
    );
  }

  // First provider becomes default automatically.
  const makeDefault = v.isDefault || count === 0;
  if (makeDefault) await clearDefault(supabase, userId);

  const row = {
    user_id: userId,
    label: v.label,
    provider: v.provider,
    model: v.model,
    api_key_cipher: v.apiKey ? encryptSecret(v.apiKey) : null,
    api_key_hint: v.apiKey ? secretHint(v.apiKey) : null,
    is_default: makeDefault,
    enabled: v.enabled,
    rank: count,
  };

  const { data, error } = await supabase.from(TABLE).insert(row).select('*').single();
  if (error) return err(appError('db_error', error.message));
  return ok(toPublic(data as ProviderRow));
}

export async function updateProvider(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateProviderInput,
): Promise<AppResult<ProviderConfig>> {
  const parsed = updateProviderSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid provider update.', parsed.error.format()));
  }
  const v = parsed.data;

  if (v.isDefault === true) await clearDefault(supabase, userId);

  const patch: Record<string, unknown> = {};
  if (v.label !== undefined) patch.label = v.label;
  if (v.model !== undefined) patch.model = v.model;
  if (v.enabled !== undefined) patch.enabled = v.enabled;
  if (v.isDefault !== undefined) patch.is_default = v.isDefault;
  if (v.rank !== undefined) patch.rank = v.rank;
  if (v.apiKey !== undefined) {
    patch.api_key_cipher = encryptSecret(v.apiKey);
    patch.api_key_hint = secretHint(v.apiKey);
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Provider not found.'));
  return ok(toPublic(data as ProviderRow));
}

export async function setDefaultProvider(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<ProviderConfig>> {
  await clearDefault(supabase, userId);
  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_default: true, enabled: true })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Provider not found.'));
  return ok(toPublic(data as ProviderRow));
}

export async function deleteProvider(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<{ id: string }>> {
  const { data: removed } = await supabase
    .from(TABLE)
    .select('is_default')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('user_id', userId);
  if (error) return err(appError('db_error', error.message));

  // If we removed the default, promote the next enabled provider.
  if (removed && (removed as { is_default: boolean }).is_default) {
    const { data: next } = await supabase
      .from(TABLE)
      .select('id')
      .eq('user_id', userId)
      .eq('enabled', true)
      .order('rank', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase.from(TABLE).update({ is_default: true }).eq('id', (next as { id: string }).id);
    }
  }

  return ok({ id });
}

/** Resolve a row to a usable credential (own key, else env key). */
function rowToCredential(row: ProviderRow): AICredential | null {
  let apiKey: string | null = null;
  if (row.api_key_cipher) {
    try {
      apiKey = decryptSecret(row.api_key_cipher);
    } catch {
      apiKey = null;
    }
  } else {
    apiKey = aiKeys[row.provider];
  }
  if (!apiKey) return null;
  return { provider: row.provider, apiKey, model: row.model };
}

/**
 * Server-only: resolve the credential the AI layer should use for this user.
 * Prefers the enabled default, then the highest-ranked enabled provider with a
 * usable key. Returns null to fall back to env-based provider selection.
 */
export async function resolveUserCredential(
  supabase: SupabaseClient,
  userId: string,
): Promise<AICredential | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
    .order('is_default', { ascending: false })
    .order('rank', { ascending: true })
    .order('created_at', { ascending: true });

  if (error || !data) return null;
  for (const row of data as ProviderRow[]) {
    const cred = rowToCredential(row);
    if (cred) return cred;
  }
  return null;
}

/** Resolve the credential for one specific provider config (used by the test route). */
export async function resolveCredentialForId(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<AICredential>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Provider not found.'));
  const cred = rowToCredential(data as ProviderRow);
  if (!cred) {
    return err(
      appError('invalid_state', 'No usable API key for this provider (add a key or set the env var).'),
    );
  }
  return ok(cred);
}
