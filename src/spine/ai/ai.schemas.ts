/**
 * Zod schemas for AI V2 inputs and model outputs.
 *
 * Model output schemas are used to validate (and coerce) the JSON the provider
 * returns before it is persisted — the model is untrusted input.
 */
import { z } from 'zod';

export const riskLevel = z.enum(['low', 'medium', 'high']);
export const upsideLevel = z.enum(['low', 'medium', 'high']);
export const briefType = z.enum(['daily', 'weekly']);

const confidence = z.coerce.number().min(0).max(1).catch(0.5);

/** A suggested action proposed by the AI (not yet a real global_action). */
export const suggestedActionSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).default(''),
  category: z.string().default('general'),
  priority: z.string().default('medium'),
  moduleId: z.string().nullable().optional(),
  impactScore: z.coerce.number().int().min(0).max(10).catch(5).optional(),
  urgencyScore: z.coerce.number().int().min(0).max(10).catch(5).optional(),
  effortScore: z.coerce.number().int().min(0).max(10).catch(5).optional(),
  confidenceScore: z.coerce.number().min(0).max(1).catch(0.5).optional(),
});

export const chiefOfStaffOutputSchema = z.object({
  executiveSummary: z.string().default(''),
  topActions: z.array(suggestedActionSchema).default([]),
  risks: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  focusRecommendation: z.string().default(''),
  reasoning: z.string().default(''),
  confidence,
});

export const dailyBriefOutputSchema = z.object({
  summary: z.string().default(''),
  cashTarget: z.coerce.number().nullable().catch(null).default(null),
  topActions: z.array(suggestedActionSchema).default([]),
  followUps: z.array(z.string()).default([]),
  jobHuntPriority: z.string().default(''),
  projectPriority: z.string().default(''),
  risks: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  recommendedFocus: z.string().default(''),
  confidence,
});

export const recommendationOutputSchema = z.object({
  recommendation: z.string().default(''),
  reasoning: z.string().default(''),
  confidence,
  riskLevel: riskLevel.catch('medium'),
  upsideLevel: upsideLevel.catch('medium'),
  suggestedActions: z.array(suggestedActionSchema).default([]),
});

export const moduleCopilotOutputSchema = z.object({
  summary: z.string().default(''),
  recommendations: z.array(recommendationOutputSchema).default([]),
  suggestedActions: z.array(suggestedActionSchema).default([]),
});

// ---------------------------------------------------------------------------
// Request input schemas (API boundary)
// ---------------------------------------------------------------------------
export const generateBriefInputSchema = z.object({
  briefType: briefType.default('daily'),
  persist: z.boolean().default(true),
});

export const askInputSchema = z.object({
  question: z.string().min(1).max(2000),
  persist: z.boolean().default(false),
});

export const moduleCopilotInputSchema = z.object({
  question: z.string().max(2000).optional(),
  persist: z.boolean().default(true),
});

export const dismissRecommendationSchema = z.object({
  action: z.enum(['accept', 'dismiss']),
});

export type GenerateBriefInput = z.infer<typeof generateBriefInputSchema>;
export type AskInput = z.infer<typeof askInputSchema>;
export type ModuleCopilotInput = z.infer<typeof moduleCopilotInputSchema>;
