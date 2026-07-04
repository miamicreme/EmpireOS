/**
 * Schemas + constants for AI provider management.
 */
import { z } from 'zod';

/** Hard cap on configured providers per user. */
export const MAX_PROVIDERS = 5;

export const aiProviderKind = z.enum([
  'requesty',
  'anthropic',
  'openai',
  'google',
  // OpenAI-API-compatible providers with free tiers, used as fallbacks.
  'groq',
  'cerebras',
  'openrouter',
  'mistral',
]);
export type AIProviderKind = z.infer<typeof aiProviderKind>;

/**
 * Suggested models per provider (used to populate the settings dropdowns).
 * The free-tier providers list their genuinely-free default models first.
 */
export const AI_PROVIDER_MODELS: Record<AIProviderKind, string[]> = {
  requesty: [
    process.env.REQUESTY_DEFAULT_MODEL ?? 'requesty-default-model',
    process.env.REQUESTY_FAST_MODEL ?? 'requesty-fast-model',
    process.env.REQUESTY_STANDARD_MODEL ?? 'requesty-standard-model',
    process.env.REQUESTY_DEEP_MODEL ?? 'requesty-deep-model',
    process.env.REQUESTY_VISION_MODEL ?? 'requesty-vision-model',
  ],
  anthropic: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o4-mini'],
  // Flash models are on Google's free tier; Pro is NOT (free quota is 0).
  google: ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.5-pro'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-20b'],
  cerebras: ['llama-3.3-70b', 'llama3.1-8b', 'qwen-3-32b'],
  openrouter: [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'deepseek/deepseek-chat-v3.1:free',
  ],
  mistral: ['mistral-small-latest', 'open-mistral-nemo', 'open-mixtral-8x7b'],
};

export const createProviderSchema = z.object({
  label: z.string().min(1).max(60),
  provider: aiProviderKind,
  model: z.string().min(1).max(120),
  // Optional: when omitted, the server uses the env key for this provider.
  apiKey: z.string().min(8).max(400).optional(),
  isDefault: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export const updateProviderSchema = z
  .object({
    label: z.string().min(1).max(60),
    model: z.string().min(1).max(120),
    apiKey: z.string().min(8).max(400),
    isDefault: z.boolean(),
    enabled: z.boolean(),
    rank: z.number().int().min(0).max(100),
  })
  .partial();

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
