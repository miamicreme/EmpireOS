/**
 * V11 Elite call-assist prompt. Pure prompt text/assembly only — no provider or
 * network code lives here, mirroring `spine/ai/advisor-prompts.ts`.
 *
 * Shaped to feed `runStructured()` (`spine/ai/ai-runner.ts`), which redacts
 * `instruction` and `context` before they leave the system — live call input can
 * carry names, numbers, or other PII, so it must go through that gate rather than
 * being flattened into a raw prompt string here.
 */
import type { CallAssistRequestInput } from './schemas';

const BASE_SYSTEM = `You are a real-time call assistant.

Constraints:
- max 2 sentences
- natural spoken language
- no filler

Strategy:
- objection -> acknowledge + reframe + redirect
- interest -> advance to next step
- confusion -> clarify quickly`;

export interface CallAssistPromptResult {
  systemPrompt: string;
  /** Free-text instruction (the live turn's input) — redacted by runStructured. */
  instruction: string;
  /** Structured context (intent/stage/history) — redacted by runStructured. */
  context: Record<string, unknown>;
  injections: string[];
}

/** Dynamic prompt injection rules from the V11 spec. */
function buildInjections(request: CallAssistRequestInput): string[] {
  const injections: string[] = [];
  if (request.intent === 'price_objection') {
    injections.push('focus on value vs cost');
  }
  if (request.stage === 'closing') {
    injections.push('drive toward commitment');
  }
  return injections;
}

export function buildCallAssistPrompt(request: CallAssistRequestInput): CallAssistPromptResult {
  const injections = buildInjections(request);
  const systemPrompt =
    injections.length > 0
      ? `${BASE_SYSTEM}\n\nAdditional guidance for this turn:\n${injections.map((i) => `- ${i}`).join('\n')}`
      : BASE_SYSTEM;

  return {
    systemPrompt,
    instruction: request.input,
    context: {
      intent: request.intent ?? 'unknown',
      stage: request.stage,
      history: request.history,
    },
    injections,
  };
}
