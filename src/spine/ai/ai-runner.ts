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
import {
  callAI,
  activeProvider,
  modelForAdvisor,
  type AIProvider,
  type AICredential,
} from './provider';
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
  /**
   * A user-configured provider credential. When present it overrides the
   * env-based provider/model selection. Absent → env keys → stub.
   */
  credential?: AICredential | null;
  /**
   * Ordered failover chain of user-configured credentials (default-first). When
   * present, the runner tries each in turn until one succeeds — so a
   * rate-limited/erroring default (e.g. an exhausted OpenAI quota) falls through
   * to the next working provider. Takes precedence over `credential`.
   */
  credentials?: AICredential[] | null;
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
  // Build the ordered failover chain: an explicit list wins, else the single
  // credential, else [undefined] (env-based / stub selection).
  const chain: Array<AICredential | undefined> =
    opts.credentials && opts.credentials.length > 0
      ? opts.credentials
      : [opts.credential ?? undefined];

  // Redaction gate — applies to both the instruction and the context. Done once
  // up front so it isn't repeated per failover attempt.
  const safeInstruction = redactSensitiveText(opts.instruction);
  const safeContext = redactObject(opts.context);
  assertNoHighRiskSecrets(JSON.stringify(safeContext));
  assertNoHighRiskSecrets(safeInstruction);

  const userPrompt = `${opts.instruction ? `INSTRUCTION:\n${safeInstruction}\n\n` : ''}EMPIRE CONTEXT (redacted):
${JSON.stringify(safeContext, null, 2)}`;

  let lastError: unknown;
  for (let i = 0; i < chain.length; i++) {
    const credential = chain[i];
    const provider = credential?.provider ?? activeProvider();
    const model =
      credential?.model ?? modelForAdvisor(opts.model ?? aiConfig.defaultModel, provider);

    if (provider === 'stub') {
      return { data: opts.stub, provider, model: 'stub' };
    }

    try {
      const response = await callAI([{ role: 'user', content: userPrompt }], {
        systemPrompt: `${opts.systemPrompt}\n\n${JSON_ONLY}`,
        model,
        maxTokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.3,
        credential,
      });

      logger.info('ai_structured_call', {
        feature: opts.feature,
        provider,
        model,
        outputTokens: response.outputTokens,
        attempt: i + 1,
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
        const verified = await verifyAndGround(opts, safeContext, data, provider, credential);
        if (verified) {
          data = verified.data;
          inputTokens = sumTokens(inputTokens, verified.inputTokens);
          outputTokens = sumTokens(outputTokens, verified.outputTokens);
        }
      }

      return { data, provider, model, inputTokens, outputTokens };
    } catch (e) {
      // Provider failed (rate limit / quota / network). Try the next configured
      // provider in the chain; only rethrow once every option is exhausted.
      lastError = e;
      logger.warn('ai_structured_provider_failed', {
        feature: opts.feature,
        provider,
        attempt: i + 1,
        remaining: chain.length - i - 1,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All configured AI providers failed.');
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
  credential?: AICredential,
): Promise<VerifyResult<T> | null> {
  try {
    // With a user-configured provider, ground with that same model; otherwise
    // use the env judge model resolved against the active provider.
    const judgeModel = credential?.model ?? modelForAdvisor(aiConfig.judgeModel, provider);
    const prompt = `EMPIRE CONTEXT (redacted):
${JSON.stringify(safeContext, null, 2)}

CANDIDATE JSON:
${JSON.stringify(candidate, null, 2)}`;

    const response = await callAI([{ role: 'user', content: prompt }], {
      systemPrompt: `${VERIFY_SYSTEM}\n\n${JSON_ONLY}`,
      model: judgeModel,
      maxTokens: opts.maxTokens ?? 2048,
      temperature: 0,
      credential,
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
