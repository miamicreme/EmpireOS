/**
 * Service-role Supabase client. SERVER-ONLY — it bypasses RLS, so it must never
 * be imported into client code. Used by the passkey auth flow to manage
 * credentials and mint sessions for the verified owner.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, getServiceRoleKey } from '@/lib/env';

let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(env.supabaseUrl, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
