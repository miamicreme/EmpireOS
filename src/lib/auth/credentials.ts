/**
 * Credential + owner-identity data access for passkey auth. SERVER-ONLY:
 * everything here uses the service-role admin client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOwnerEmail } from '@/lib/env';

export interface StoredCredential {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
  device_type: string | null;
  backed_up: boolean | null;
  label: string | null;
  last_used_at: string | null;
  created_at: string;
}

const TABLE = 'webauthn_credentials';

/** Resolve the single owner's auth.users id, creating the user on first use. */
export async function getOrCreateOwnerUserId(admin: SupabaseClient): Promise<string> {
  const email = getOwnerEmail();

  const existing = await findUserIdByEmail(admin, email);
  if (existing) return existing;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role: 'owner' },
  });
  if (error || !data.user) {
    // Race: another request created it first. Re-resolve.
    const retry = await findUserIdByEmail(admin, email);
    if (retry) return retry;
    throw new Error(`Failed to provision owner user: ${error?.message ?? 'unknown'}`);
  }
  return data.user.id;
}

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  // Single-owner system: one page is plenty.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return user?.id ?? null;
}

export async function countCredentials(admin: SupabaseClient): Promise<number> {
  const { count, error } = await admin
    .from(TABLE)
    .select('id', { count: 'exact', head: true });
  if (error) throw new Error(`countCredentials failed: ${error.message}`);
  return count ?? 0;
}

export async function listCredentials(
  admin: SupabaseClient,
  userId: string,
): Promise<StoredCredential[]> {
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listCredentials failed: ${error.message}`);
  return (data ?? []) as StoredCredential[];
}

export async function getCredentialById(
  admin: SupabaseClient,
  credentialId: string,
): Promise<StoredCredential | null> {
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('credential_id', credentialId)
    .maybeSingle();
  if (error) throw new Error(`getCredentialById failed: ${error.message}`);
  return (data as StoredCredential | null) ?? null;
}

export async function insertCredential(
  admin: SupabaseClient,
  row: {
    user_id: string;
    credential_id: string;
    public_key: string;
    counter: number;
    transports: string[];
    device_type: string | null;
    backed_up: boolean;
    label: string | null;
  },
): Promise<void> {
  const { error } = await admin.from(TABLE).insert(row);
  if (error) throw new Error(`insertCredential failed: ${error.message}`);
}

export async function updateCredentialCounter(
  admin: SupabaseClient,
  credentialId: string,
  counter: number,
): Promise<void> {
  const { error } = await admin
    .from(TABLE)
    .update({ counter, last_used_at: new Date().toISOString() })
    .eq('credential_id', credentialId);
  if (error) throw new Error(`updateCredentialCounter failed: ${error.message}`);
}

export async function deleteCredential(
  admin: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await admin.from(TABLE).delete().eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`deleteCredential failed: ${error.message}`);
}

export { createAdminClient };
