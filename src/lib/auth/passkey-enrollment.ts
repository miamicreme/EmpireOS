import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getWebAuthnConfig } from '@/lib/env';

export const ENROLLMENT_TOKEN_TTL_SECONDS = 10 * 60;

export interface StoredEnrollmentToken {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  label_hint: string | null;
  created_user_agent: string | null;
  created_ip: string | null;
  consumed_user_agent: string | null;
  consumed_ip: string | null;
}

export interface EnrollmentStatus {
  valid: boolean;
  expired: boolean;
  used: boolean;
  labelHint: string | null;
  expiresAt: string | null;
}

export function hashEnrollmentToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function createRawEnrollmentToken(): string {
  return randomBytes(32).toString('base64url');
}

export function enrollmentUrl(token: string): string {
  const { origin } = getWebAuthnConfig();
  return new URL(`/passkeys/enroll/${token}`, origin).toString();
}

export async function createEnrollmentToken(
  admin: SupabaseClient,
  userId: string,
  meta: {
    labelHint: string | null;
    createdUserAgent: string | null;
    createdIp: string | null;
    expiresInSeconds?: number;
  },
): Promise<{ rawToken: string; enrollmentUrl: string; qrPayload: string; expiresAt: string; labelHint: string | null }> {
  const rawToken = createRawEnrollmentToken();
  const expiresAt = new Date(Date.now() + (meta.expiresInSeconds ?? ENROLLMENT_TOKEN_TTL_SECONDS) * 1000).toISOString();
  const token_hash = hashEnrollmentToken(rawToken);
  const { error } = await admin.from('passkey_enrollment_tokens').insert({
    user_id: userId,
    token_hash,
    expires_at: expiresAt,
    label_hint: meta.labelHint,
    created_user_agent: meta.createdUserAgent,
    created_ip: meta.createdIp,
  });
  if (error) throw new Error(`createEnrollmentToken failed: ${error.message}`);

  const url = enrollmentUrl(rawToken);
  return {
    rawToken,
    enrollmentUrl: url,
    qrPayload: url,
    expiresAt,
    labelHint: meta.labelHint,
  };
}

async function fetchTokenByRaw(admin: SupabaseClient, rawToken: string): Promise<StoredEnrollmentToken | null> {
  const token_hash = hashEnrollmentToken(rawToken);
  const { data, error } = await admin
    .from('passkey_enrollment_tokens')
    .select('*')
    .eq('token_hash', token_hash)
    .maybeSingle();
  if (error) throw new Error(`fetchTokenByRaw failed: ${error.message}`);
  return (data as StoredEnrollmentToken | null) ?? null;
}

export async function getEnrollmentStatus(
  admin: SupabaseClient,
  rawToken: string,
): Promise<EnrollmentStatus> {
  const token = await fetchTokenByRaw(admin, rawToken);
  if (!token) {
    return { valid: false, expired: false, used: false, labelHint: null, expiresAt: null };
  }

  const expired = new Date(token.expires_at).getTime() <= Date.now();
  const used = Boolean(token.used_at);
  return {
    valid: !expired && !used,
    expired,
    used,
    labelHint: token.label_hint,
    expiresAt: token.expires_at,
  };
}

export async function getValidEnrollmentToken(
  admin: SupabaseClient,
  rawToken: string,
): Promise<StoredEnrollmentToken> {
  const token = await fetchTokenByRaw(admin, rawToken);
  if (!token) throw new Error('Enrollment link not found.');
  if (token.used_at) throw new Error('This enrollment link has already been used.');
  if (new Date(token.expires_at).getTime() <= Date.now()) throw new Error('This enrollment link expired.');
  return token;
}

export async function markEnrollmentTokenUsed(
  admin: SupabaseClient,
  tokenId: string,
  meta: { consumedUserAgent: string | null; consumedIp: string | null },
): Promise<void> {
  const { error } = await admin
    .from('passkey_enrollment_tokens')
    .update({
      used_at: new Date().toISOString(),
      consumed_user_agent: meta.consumedUserAgent,
      consumed_ip: meta.consumedIp,
    })
    .eq('id', tokenId);
  if (error) throw new Error(`markEnrollmentTokenUsed failed: ${error.message}`);
}
