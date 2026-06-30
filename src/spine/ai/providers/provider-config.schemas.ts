/**
 * Schemas + constants for AI provider management.
 */
import { z } from 'zod';

/** Hard cap on configured providers per user. */
export const MAX_PROVIDERS = 5;

export const aiProviderKind = z.enum(['anthropic', 'openai', 'google']);
export type AIProviderKind = z.infer<typeof aiProviderKind>;

/** Suggested models per provider (used to populate the settings dropdowns). */
export const AI_PROVIDER_MODELS: Record<AIProviderKind, string[]> = {
  anthropic: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o4-mini'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-flash'],
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
