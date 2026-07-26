/**
 * Call Assist module — real-time call-turn suggestions (V11 Elite spec).
 *
 * No call content is persisted: the assist endpoint is stateless per the
 * `src/modules/README.md` guardrail ("no module should log raw transcripts").
 * The client holds conversation history and the low-confidence streak and
 * resends them with each turn.
 */
import { createClient } from '@/lib/supabase/server';
import type { ModuleContract } from '@/spine/module-contract';
import type { ModuleHealthResult } from '@/spine/types';
import { runStructured } from '@/spine/ai/ai-runner';
import { callAssistOutputSchema } from '@/spine/ai/ai.schemas';
import { manifest } from './manifest';
import { emitSyncedEvent } from './events';
import { buildCallAssistPrompt } from './prompts';
import type { CallAssistRequestInput } from './schemas';
import type { CallAssistResult } from './types';

const LOW_CONFIDENCE_THRESHOLD = 0.5;
const ESCALATE_AT_STREAK = 2;
const SAFE_FALLBACK_RESPONSE = "Tell me a bit more about that so I can help.";

const STUB_RESULT = {
  response: SAFE_FALLBACK_RESPONSE,
  intent: 'unknown',
  confidence: 0.3,
  next_action: 'clarify',
};

interface FallbackInput {
  response: string;
  intent: string;
  confidence: number;
  next_action: string;
}

/**
 * Spec's confidence + fallback logic: below-threshold turns get swapped for a
 * safe scripted response, and a streak of low-confidence turns raises `escalate`
 * so the UI can prompt the operator to bring in a manager — without any
 * server-side session storage.
 */
export function applyFallback(
  data: FallbackInput,
  recentLowConfidenceCount: number,
): CallAssistResult & { escalate: boolean } {
  const isLowConfidence = data.confidence < LOW_CONFIDENCE_THRESHOLD;
  const streak = isLowConfidence ? recentLowConfidenceCount + 1 : 0;

  return {
    response: isLowConfidence ? SAFE_FALLBACK_RESPONSE : data.response,
    intent: data.intent,
    confidence: data.confidence,
    next_action: isLowConfidence ? 'clarify' : data.next_action,
    escalate: streak >= ESCALATE_AT_STREAK,
    provider: '',
  };
}

export async function runCallAssist(request: CallAssistRequestInput): Promise<CallAssistResult> {
  const { systemPrompt, instruction, context } = buildCallAssistPrompt(request);

  const result = await runStructured({
    feature: 'call_command.assist',
    systemPrompt,
    instruction,
    context,
    schema: callAssistOutputSchema,
    stub: STUB_RESULT,
    maxTokens: 200,
    temperature: 0.3,
  });

  const withFallback = applyFallback(result.data, request.recentLowConfidenceCount);
  return { ...withFallback, provider: result.provider };
}

async function getHealth(userId: string): Promise<ModuleHealthResult> {
  void userId;
  return { moduleId: manifest.id, health: 'green', reason: 'Stateless call assist — nothing to sync.' };
}

export const callCommandModule: ModuleContract = {
  manifest,
  getMetrics: async () => [],
  getActions: async () => [],
  getDecisionContext: async () => ({
    moduleId: manifest.id,
    summary: `${manifest.name}: live-only, no call content is retained.`,
    facts: {},
    risks: [],
    opportunities: [],
    recommendedActions: [],
  }),
  getHealth,
  syncToSpine: async (userId) => {
    await emitSyncedEvent(createClient(), userId);
  },
};
