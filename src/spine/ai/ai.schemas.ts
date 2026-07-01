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

/** AI financial summary — a narrative "state of your finances" brief. */
export const financeSummaryOutputSchema = z.object({
  headline: z.string().default(''),
  state: z.string().default(''),
  strengths: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  moves: z
    .array(z.object({ title: z.string().default(''), why: z.string().default('') }))
    .default([]),
  confidence,
});

/** The module a submitted document is routed to (or 'none' when it fits none). */
export const intakeDestination = z.enum([
  'cash-engine',
  'finances',
  'job-hunt',
  'followup-crm',
  'credit-funding',
  'projects',
  'acquisitions',
  'none',
]);

/**
 * Doc-intake classifier output: where the document belongs, what it is, the
 * structured fields pulled out of it, and the next actions it implies.
 */
export const intakeOutputSchema = z.object({
  destinationModule: intakeDestination.catch('none'),
  documentType: z.string().default('document'),
  title: z.string().default('Untitled document'),
  summary: z.string().default(''),
  extractedFields: z
    .array(z.object({ label: z.string().default(''), value: z.string().default('') }))
    .default([]),
  suggestedActions: z.array(suggestedActionSchema).default([]),
  sensitive: z.boolean().catch(false).default(false),
  reasoning: z.string().default(''),
  confidence,
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
  // Action-oriented callers (Decision Console, dashboard ask) want recommendations
  // and drafts persisted, so default to true. The exploratory chat opts out
  // explicitly with persist: false.
  persist: z.boolean().default(true),
});

export const moduleCopilotInputSchema = z.object({
  question: z.string().max(2000).optional(),
  persist: z.boolean().default(true),
});

export const dismissRecommendationSchema = z.object({
  action: z.enum(['accept', 'dismiss']),
});

export const intakeInputSchema = z.object({
  title: z.string().max(300).optional(),
  content: z.string().min(1, 'Paste a document to review.').max(50000),
  // Persist the document + drafts (default) vs. a dry-run classification.
  persist: z.boolean().default(true),
});

export type GenerateBriefInput = z.infer<typeof generateBriefInputSchema>;
export type AskInput = z.infer<typeof askInputSchema>;
export type ModuleCopilotInput = z.infer<typeof moduleCopilotInputSchema>;
export type IntakeInput = z.infer<typeof intakeInputSchema>;
