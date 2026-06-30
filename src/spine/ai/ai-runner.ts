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
  /**
   * Run a second grounding/critique pass that checks the first output against
   * the context, strips unsupported claims, corrects numbers to the derived
   * facts, and recalibrates confidence. Raises accuracy at ~2x token cost.
   * Skipped automatically in stub mode.
   */
  verify?: boolean;
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
  let data = (parsed.success ? parsed.data : opts.stub) as T;
  if (!parsed.success) {
    logger.warn('ai_structured_parse_failed', { feature: opts.feature, provider });
  }

  let inputTokens = response.inputTokens;
  let outputTokens = response.outputTokens;

  // Optional grounding pass — only worth running when the first pass parsed.
  if (opts.verify && parsed.success) {
    const verified = await verifyAndGround(opts, safeContext, data, provider);
    if (verified) {
      data = verified.data;
      inputTokens = sumTokens(inputTokens, verified.inputTokens);
      outputTokens = sumTokens(outputTokens, verified.outputTokens);
    }
  }

  return { data, provider, model, inputTokens, outputTokens };
}

const VERIFY_SYSTEM = `You are a strict fact-checker for an AI Chief of Staff.
You receive the redacted EMPIRE CONTEXT and a CANDIDATE JSON answer produced from it.
Return a CORRECTED version of the same JSON shape that:
- removes or fixes any claim, action, risk, or opportunity NOT supported by the context,
- replaces every number with the matching value from context.derived (the authoritative
  figures) when one exists — never invent or recompute numbers,
- keeps wording specific and grounded in the actual facts,
- recalibrates "confidence" downward if the candidate over-reached.
Preserve the exact JSON structure and field names. Output ONLY the corrected JSON.`;

interface VerifyResult<T> {
  data: T;
  inputTokens?: number;
  outputTokens?: number;
}

/** Second pass: ask the judge model to ground/correct the candidate output. */
async function verifyAndGround<T>(
  opts: StructuredRunOptions<T>,
  safeContext: Record<string, unknown>,
  candidate: T,
  provider: AIProvider,
): Promise<VerifyResult<T> | null> {
  try {
    const judgeModel = modelForAdvisor(aiConfig.judgeModel, provider);
    const prompt = `EMPIRE CONTEXT (redacted):
${JSON.stringify(safeContext, null, 2)}

CANDIDATE JSON:
${JSON.stringify(candidate, null, 2)}`;

    const response = await callAI([{ role: 'user', content: prompt }], {
      systemPrompt: `${VERIFY_SYSTEM}\n\n${JSON_ONLY}`,
      model: judgeModel,
      maxTokens: opts.maxTokens ?? 2048,
      temperature: 0,
    });

    const parsed = opts.schema.safeParse(extractJson(response.text));
    if (!parsed.success) return null;

    logger.info('ai_verify_pass', {
      feature: opts.feature,
      provider,
      model: judgeModel,
      outputTokens: response.outputTokens,
    });

    return {
      data: parsed.data as T,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  } catch (error) {
    logger.warn('ai_verify_failed', {
      feature: opts.feature,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function sumTokens(a?: number, b?: number): number | undefined {
  if (a == null && b == null) return undefined;
  return (a ?? 0) + (b ?? 0);
}
