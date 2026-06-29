/**
 * Structured AI runner shared by all V2 services.
 *
 * Responsibilities:
 *   1. Redact the context object before it leaves the system (final gate).
 *   2. Call the best available provider through the existing abstraction.
 *   3. Parse the model's JSON (stripping code fences) and validate with Zod.
 *   4. Fall back to a deterministic stub when no provider key is configured,
 *      so every V2 feature is testable with zero external dependencies.
 *
 * The Spine owns priority. AI sits on top — it never bypasses redaction.
 */
import type { z } from 'zod';
import { logger } from '@/lib/logger';
import { aiConfig } from '@/lib/env';
import { callAI, activeProvider, modelForAdvisor, type AIProvider } from './provider';
import {
  assertNoHighRiskSecrets,
  redactSensitiveText,
} from '../decisions/context-redaction.service';
import { redactObject } from './redaction';

export interface StructuredRunResult<T> {
  data: T;
  provider: AIProvider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface StructuredRunOptions<T> {
  feature: string;
  systemPrompt: string;
  /** Free-text instruction / question. Redacted before sending. */
  instruction: string;
  /** Structured context object. Redacted before sending. */
  context: Record<string, unknown>;
  /**
   * Validation schema for the model's JSON. Kept loosely typed (ZodTypeAny) so
   * coercion/default helpers don't fight the caller's domain interface — the
   * `stub` type is the source of truth for `T`.
   */
  schema: z.ZodTypeAny;
  /** Deterministic value returned when no provider is configured. */
  stub: T;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/** Strip markdown fences and parse the first JSON object/array in the text. */
export function extractJson(raw: string): unknown {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Model wrapped JSON in prose — grab the outermost object.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}

const JSON_ONLY = `You must return ONLY valid JSON matching the requested shape.
No prose, no markdown fences, no commentary before or after the JSON.`;

/**
 * Run a structured AI call. Returns the validated, typed object.
 * NEVER throws on a malformed model response — Zod defaults absorb it.
 */
export async function runStructured<T>(
  opts: StructuredRunOptions<T>,
): Promise<StructuredRunResult<T>> {
  const provider = activeProvider();
  // Resolve the model for the *active* provider. A caller-supplied preference
  // (e.g. the Anthropic fast model) is only honored on Anthropic; OpenAI/Google
  // fall back to their own provider defaults so single-key envs don't pass an
  // Anthropic model name into a non-Anthropic API.
  const model = modelForAdvisor(opts.model ?? aiConfig.defaultModel, provider);

  // Redaction gate — applies to both the instruction and the context.
  const safeInstruction = redactSensitiveText(opts.instruction);
  const safeContext = redactObject(opts.context);
  assertNoHighRiskSecrets(JSON.stringify(safeContext));
  assertNoHighRiskSecrets(safeInstruction);

  if (provider === 'stub') {
    return { data: opts.stub, provider, model: 'stub' };
  }

  const userPrompt = `${opts.instruction ? `INSTRUCTION:\n${safeInstruction}\n\n` : ''}EMPIRE CONTEXT (redacted):
${JSON.stringify(safeContext, null, 2)}`;

  const response = await callAI([{ role: 'user', content: userPrompt }], {
    systemPrompt: `${opts.systemPrompt}\n\n${JSON_ONLY}`,
    model,
    maxTokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.3,
  });

  logger.info('ai_structured_call', {
    feature: opts.feature,
    provider,
    model,
    outputTokens: response.outputTokens,
  });

  const parsed = opts.schema.safeParse(extractJson(response.text));
  const data = (parsed.success ? parsed.data : opts.stub) as T;
  if (!parsed.success) {
    logger.warn('ai_structured_parse_failed', { feature: opts.feature, provider });
  }

  return {
    data,
    provider,
    model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
