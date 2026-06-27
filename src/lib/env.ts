/**
 * Centralized, validated environment access.
 *
 * Public (client-safe) vars are validated eagerly. Server-only secrets are
 * accessed lazily so the client bundle never requires them. AI provider keys
 * are optional — the decision engine runs in stub mode when absent.
 */
import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const publicEnv = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!publicEnv.success) {
  // Surface a clear message at boot rather than a cryptic runtime failure.
  console.warn(
    '[env] Missing/invalid public Supabase env vars. Copy .env.example to .env.local.',
  );
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;

/** Server-only: throws if the service role key is requested but missing. */
export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set (server-only).');
  }
  return key;
}

/** Optional AI provider keys. Absence means the engine stays in stub mode. */
export const aiKeys = {
  openai: process.env.OPENAI_API_KEY ?? null,
  anthropic: process.env.ANTHROPIC_API_KEY ?? null,
  google: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? null,
} as const;

export function hasAnyAiProvider(): boolean {
  return Boolean(aiKeys.openai || aiKeys.anthropic || aiKeys.google);
}
