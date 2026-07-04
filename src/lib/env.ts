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

/**
 * WebAuthn / passkey relying-party configuration.
 *
 * - `rpID` is the effective domain (no scheme/port), e.g. `empire.app` or
 *   `localhost`. Passkeys are bound to it, so it must match the site origin.
 * - `origin` is the full origin the browser reports, e.g. `https://empire.app`.
 *
 * Read server-side with localhost dev defaults.
 */
export function getWebAuthnConfig(): { rpID: string; rpName: string; origin: string } {
  const origin = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000';
  let rpID = process.env.WEBAUTHN_RP_ID;
  if (!rpID) {
    try {
      rpID = new URL(origin).hostname;
    } catch {
      rpID = 'localhost';
    }
  }
  return { rpID, rpName: process.env.WEBAUTHN_RP_NAME ?? 'Empire OS', origin };
}

/** Internal owner identity used to bridge a verified passkey to a Supabase session. */
export function getOwnerEmail(): string {
  return process.env.OWNER_EMAIL ?? 'owner@empire.local';
}

/**
 * Optional break-glass recovery secret. When set, a locked-out owner (e.g. a
 * lost or wiped device whose passkey no longer exists locally) can clear the
 * stored passkeys and re-register on a fresh device by proving knowledge of
 * this code. Absent → recovery is disabled, so there is no open reset path.
 */
export function getOwnerRecoveryCode(): string | null {
  const code = process.env.OWNER_RECOVERY_CODE?.trim();
  return code && code.length > 0 ? code : null;
}

/**
 * Optional AI provider keys. Absence means the engine stays in stub mode.
 * The last four are OpenAI-API-compatible free-tier providers used as fallbacks.
 */
export const aiKeys = {
  requesty: process.env.REQUESTY_API_KEY ?? null,
  openai: process.env.OPENAI_API_KEY ?? null,
  anthropic: process.env.ANTHROPIC_API_KEY ?? null,
  google: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? null,
  groq: process.env.GROQ_API_KEY ?? null,
  cerebras: process.env.CEREBRAS_API_KEY ?? null,
  openrouter: process.env.OPENROUTER_API_KEY ?? null,
  mistral: process.env.MISTRAL_API_KEY ?? null,
} as const;

export function hasAnyAiProvider(): boolean {
  return Object.values(aiKeys).some(Boolean);
}

export const requestyConfig = {
  apiKey: process.env.REQUESTY_API_KEY ?? null,
  baseURL: process.env.REQUESTY_BASE_URL ?? 'https://router.requesty.ai/v1',
  defaultModel: process.env.REQUESTY_DEFAULT_MODEL ?? null,
  fastModel: process.env.REQUESTY_FAST_MODEL ?? null,
  standardModel: process.env.REQUESTY_STANDARD_MODEL ?? null,
  deepModel: process.env.REQUESTY_DEEP_MODEL ?? null,
  visionModel: process.env.REQUESTY_VISION_MODEL ?? null,
} as const;

const requestyModelsConfigured = Boolean(
  requestyConfig.apiKey &&
    requestyConfig.baseURL &&
    (requestyConfig.defaultModel ||
      requestyConfig.fastModel ||
      requestyConfig.standardModel ||
      requestyConfig.deepModel ||
      requestyConfig.visionModel),
);

export function hasRequestyProvider(): boolean {
  return requestyModelsConfigured;
}

/**
 * AI V2 model configuration. Optional — sensible Anthropic defaults are used
 * when unset. These only select model names; provider keys still gate whether
 * a real provider is called (otherwise the engine stays in stub mode).
 */
export const aiConfig = {
  defaultProvider: process.env.AI_DEFAULT_PROVIDER ?? 'anthropic',
  defaultModel: requestyModelsConfigured ? requestyConfig.standardModel ?? requestyConfig.defaultModel ?? 'requesty-standard' : process.env.AI_DEFAULT_MODEL ?? 'claude-sonnet-4-6',
  fastModel: requestyModelsConfigured ? requestyConfig.fastModel ?? requestyConfig.defaultModel ?? 'requesty-fast' : process.env.AI_FAST_MODEL ?? 'claude-haiku-4-5-20251001',
  judgeModel: requestyModelsConfigured ? requestyConfig.deepModel ?? requestyConfig.defaultModel ?? 'requesty-deep' : process.env.AI_JUDGE_MODEL ?? 'claude-sonnet-4-6',
} as const;
