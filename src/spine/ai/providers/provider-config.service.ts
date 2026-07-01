/**
 * AI Provider configuration service.
 *
 * Owns the user's configured LLM providers (max 5). NON-secret metadata lives in
 * ai_providers (client-readable under RLS). The encrypted API key lives in
 * ai_provider_secrets, which has RLS enabled with NO policies — so it is only
 * reachable through the service-role admin client (bypasses RLS). The cipher
 * therefore never reaches the browser, even via a direct Supabase query.
 *
 * `resolveUserCredential` is the server-only path the AI layer uses to obtain a
 * usable provider + decrypted key.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError, type AppError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { aiKeys } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
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
const SECRETS = 'ai_provider_secrets';

/** Non-secret metadata row (client-readable under RLS). */
interface ProviderRow {
  id: string;
  user_id: string;
  label: string;
  provider: AIProviderKind;
  model: string;
  api_key_hint: string | null;
  has_own_key: boolean;
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
  const hasOwnKey = Boolean(row.has_own_key);
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

/**
 * Server-only secret writer (upsert one provider's encrypted key). Returns an
 * AppError if the write failed so callers don't report a saved key that isn't.
 */
async function writeSecret(
  admin: SupabaseClient | undefined,
  userId: string,
  providerId: string,
  plaintext: string,
): Promise<AppError | null> {
  // Acquiring the service-role client and encrypting both throw when the server
  // is missing SUPABASE_SERVICE_ROLE_KEY / a valid AI_PROVIDER_ENCRYPTION_KEY.
  // Convert that into a clear error instead of an opaque 500 so the UI can say
  // what's actually wrong.
  let client: SupabaseClient;
  let cipher: string;
  try {
    client = admin ?? createAdminClient();
    cipher = encryptSecret(plaintext);
  } catch (e) {
    return appError(
      'internal',
      `Key storage isn't configured on the server (${(e as Error).message}). ` +
        'Set SUPABASE_SERVICE_ROLE_KEY (and optionally AI_PROVIDER_ENCRYPTION_KEY), then redeploy.',
    );
  }

  const { error } = await client
    .from(SECRETS)
    .upsert(
      { provider_id: providerId, user_id: userId, api_key_cipher: cipher },
      { onConflict: 'provider_id' },
    );
  return error ? appError('db_error', `Failed to store provider key: ${error.message}`) : null;
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
  admin?: SupabaseClient,
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
    api_key_hint: v.apiKey ? secretHint(v.apiKey) : null,
    has_own_key: Boolean(v.apiKey),
    is_default: makeDefault,
    enabled: v.enabled,
    rank: count,
  };

  const { data, error } = await supabase.from(TABLE).insert(row).select('*').single();
  if (error) return err(appError('db_error', error.message));

  const created = data as ProviderRow;
  if (v.apiKey) {
    const secretErr = await writeSecret(admin, userId, created.id, v.apiKey);
    if (secretErr) {
      // Roll back so we never leave a provider flagged has_own_key with no secret.
      await supabase.from(TABLE).delete().eq('id', created.id).eq('user_id', userId);
      return err(secretErr);
    }
  }
  return ok(toPublic(created));
}

export async function updateProvider(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateProviderInput,
  admin?: SupabaseClient,
): Promise<AppResult<ProviderConfig>> {
  const parsed = updateProviderSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid provider update.', parsed.error.format()));
  }
  const v = parsed.data;

  if (v.isDefault === true) await clearDefault(supabase, userId);

  // Persist the secret BEFORE flipping has_own_key, so a failed write can't
  // leave the metadata claiming a key that isn't stored.
  if (v.apiKey !== undefined) {
    const { data: existing } = await supabase
      .from(TABLE)
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!existing) return err(appError('not_found', 'Provider not found.'));

    const secretErr = await writeSecret(admin, userId, id, v.apiKey);
    if (secretErr) return err(secretErr);
  }

  const patch: Record<string, unknown> = {};
  if (v.label !== undefined) patch.label = v.label;
  if (v.model !== undefined) patch.model = v.model;
  if (v.enabled !== undefined) patch.enabled = v.enabled;
  if (v.isDefault !== undefined) patch.is_default = v.isDefault;
  if (v.rank !== undefined) patch.rank = v.rank;
  if (v.apiKey !== undefined) {
    patch.api_key_hint = secretHint(v.apiKey);
    patch.has_own_key = true;
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

  // The secret row is removed by the ON DELETE CASCADE on provider_id.
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

/**
 * Fetch a user's decrypted keys by provider_id (server-only, via admin). A read
 * failure is propagated as an AppError — converting it to an empty map would
 * make every stored key look absent and silently mislead resolution.
 */
async function fetchSecrets(
  admin: SupabaseClient,
  userId: string,
): Promise<{ map: Map<string, string>; error: AppError | null }> {
  const { data, error } = await admin
    .from(SECRETS)
    .select('provider_id, api_key_cipher')
    .eq('user_id', userId);
  if (error) {
    return { map: new Map(), error: appError('db_error', `Failed to read provider keys: ${error.message}`) };
  }
  const map = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ provider_id: string; api_key_cipher: string }>) {
    try {
      map.set(row.provider_id, decryptSecret(row.api_key_cipher));
    } catch {
      // Skip undecryptable rows (key rotation / tamper) — falls back to env.
    }
  }
  return { map, error: null };
}

/** Build a credential for a provider row, given its decrypted own-key (if any). */
function toCredential(row: ProviderRow, ownKey: string | undefined): AICredential | null {
  const apiKey = row.has_own_key ? ownKey : aiKeys[row.provider];
  if (!apiKey) return null;
  return { provider: row.provider, apiKey, model: row.model };
}

/**
 * Server-only: resolve the credential the AI layer should use for this user.
 * Prefers the enabled default, then the highest-ranked enabled provider with a
 * usable key. Returns null to fall back to env-based provider selection.
 *
 * `admin` is injectable for tests; in production it lazily uses the service-role
 * client, and only when a stored key actually needs decrypting.
 */
export async function resolveUserCredential(
  supabase: SupabaseClient,
  userId: string,
  admin?: SupabaseClient,
): Promise<AICredential | null> {
  const chain = await resolveUserCredentials(supabase, userId, admin);
  return chain[0] ?? null;
}

/**
 * Server-only: resolve ALL usable credentials for this user, ordered
 * default-first then by rank. The AI runner walks this list as a failover
 * chain — if the default provider is rate-limited or erroring (e.g. an
 * exhausted OpenAI quota), the next enabled provider with a usable key is
 * tried, which is the whole point of configuring multiple LLMs. Returns [] to
 * fall back to env-based provider selection.
 */
export async function resolveUserCredentials(
  supabase: SupabaseClient,
  userId: string,
  admin?: SupabaseClient,
): Promise<AICredential[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
    .order('is_default', { ascending: false })
    .order('rank', { ascending: true })
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  const rows = data as ProviderRow[];
  if (rows.length === 0) return [];

  // Only reach for the admin client / secrets when a stored key is needed.
  const needsSecret = rows.some((r) => r.has_own_key);
  let secrets = new Map<string, string>();
  if (needsSecret) {
    const res = await fetchSecrets(admin ?? createAdminClient(), userId);
    // Surface a real read failure rather than silently falling back to env keys
    // (which would route AI calls to the wrong provider).
    if (res.error) throw res.error;
    secrets = res.map;
  }

  const creds: AICredential[] = [];
  for (const row of rows) {
    const cred = toCredential(row, secrets.get(row.id));
    if (cred) creds.push(cred);
  }
  return creds;
}

/** Resolve the credential for one specific provider config (used by the test route). */
export async function resolveCredentialForId(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  admin?: SupabaseClient,
): Promise<AppResult<AICredential>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Provider not found.'));
  const row = data as ProviderRow;

  let ownKey: string | undefined;
  if (row.has_own_key) {
    const secrets = await fetchSecrets(admin ?? createAdminClient(), userId);
    if (secrets.error) return err(secrets.error);
    ownKey = secrets.map.get(row.id);
  }
  const cred = toCredential(row, ownKey);
  if (!cred) {
    return err(
      appError('invalid_state', 'No usable API key for this provider (add a key or set the env var).'),
    );
  }
  return ok(cred);
}
