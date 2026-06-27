/**
 * Browser Supabase client (anon key). Safe for client components.
 */
import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';

export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
