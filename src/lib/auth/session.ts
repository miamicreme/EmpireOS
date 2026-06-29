/**
 * Bridges a verified passkey into a real Supabase session so that RLS
 * (auth.uid()) and every existing foreign key keep working unchanged.
 *
 * Flow: the service role generates a one-time magic-link token for the owner,
 * then the cookie-bound server client consumes it via verifyOtp — which writes
 * the Supabase session cookies onto the response. No password is ever involved.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getOwnerEmail } from '@/lib/env';

export async function establishOwnerSession(admin: SupabaseClient): Promise<void> {
  const email = getOwnerEmail();

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error || !data.properties?.hashed_token) {
    throw new Error(`Failed to generate session token: ${error?.message ?? 'no token'}`);
  }

  const supabase = createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyError) {
    throw new Error(`Failed to establish session: ${verifyError.message}`);
  }
}

/** Clears the current Supabase session cookies. */
export async function clearSession(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
