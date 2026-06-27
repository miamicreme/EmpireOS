/**
 * Unified redaction interface for the AI layer.
 * Delegates to context-redaction.service for text and context redaction.
 */
export {
  redactDecisionContext,
  redactSensitiveText as redactText,
  assertNoHighRiskSecrets,
} from '../decisions/context-redaction.service';

/**
 * Recursively redact all string values inside a plain object,
 * replacing PII and high-risk secret patterns with [REDACTED].
 */
import { redactSensitiveText } from '../decisions/context-redaction.service';

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(v);
    }
    return out;
  }
  return value;
}

export function redactObject(input: Record<string, unknown>): Record<string, unknown> {
  return redactValue(input) as Record<string, unknown>;
}
