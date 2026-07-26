import { z } from 'zod';
import { CALL_STAGES } from './types';

const historyTurnSchema = z.object({
  speaker: z.enum(['rep', 'prospect']),
  text: z.string().trim().min(1).max(1000),
});

/** Validate a live-call assist request before it reaches the prompt builder. */
export const callAssistRequestSchema = z.object({
  input: z.string().trim().min(1).max(2000),
  stage: z.enum(CALL_STAGES).default('unknown'),
  intent: z.string().trim().max(200).optional(),
  history: z.array(historyTurnSchema).max(20).default([]),
  recentLowConfidenceCount: z.coerce.number().int().min(0).max(50).default(0),
});

export type CallAssistRequestInput = z.infer<typeof callAssistRequestSchema>;
