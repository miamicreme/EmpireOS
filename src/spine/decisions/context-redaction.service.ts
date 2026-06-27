/**
 * Context redaction.
 *
 * Before any context is sent to an external AI model, sensitive data is redacted
 * with conservative pattern matching. High-risk secrets (SSN, EIN, full account
 * numbers, IBAN) cause `assertNoHighRiskSecrets` to throw — they must never
 * leave the system, even redacted-by-accident.
 */
import {
  HIGH_RISK_PATTERNS,
  PII_PATTERNS,
  containsHighRiskSecret,
} from '@/lib/security';
import { appError } from '@/lib/errors';
import type { DecisionContext } from '../types';

const REDACTED = '[REDACTED]';

/** Pattern-based redaction of free text. */
export function redactSensitiveText(text: string): string {
  let out = text;
  for (const { re } of HIGH_RISK_PATTERNS) {
    out = out.replace(new RegExp(re.source, re.flags), REDACTED);
  }
  for (const { re } of PII_PATTERNS) {
    out = out.replace(new RegExp(re.source, re.flags), REDACTED);
  }
  return out;
}

/** Recursively redact any string value inside a JSON-like structure. */
function redactDeep(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactDeep(v);
    }
    return out;
  }
  return value;
}

/** Returns a redacted copy of a decision context safe to send to an AI model. */
export function redactDecisionContext(context: DecisionContext): DecisionContext {
  return {
    moduleId: context.moduleId,
    summary: redactSensitiveText(context.summary),
    facts: redactDeep(context.facts) as Record<string, unknown>,
    risks: context.risks.map(redactSensitiveText),
    opportunities: context.opportunities.map(redactSensitiveText),
    recommendedActions: context.recommendedActions.map(redactSensitiveText),
  };
}

/**
 * Throws if high-risk secrets remain in the text. Call this as a final gate
 * right before sending anything to an external provider.
 */
export function assertNoHighRiskSecrets(text: string): void {
  if (containsHighRiskSecret(text)) {
    throw appError(
      'redaction_blocked',
      'High-risk secret detected; refusing to send context to external AI.',
    );
  }
}
