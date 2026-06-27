/**
 * Security helpers shared across the spine.
 *
 * Auth resolution lives here so services and routes resolve the current user
 * the same way. Pattern-based secret detection backs the AI redaction layer.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from './errors';
import { err, ok, type AppResult } from './result';

/** Resolves the authenticated user id from a server Supabase client. */
export async function requireUserId(
  supabase: SupabaseClient,
): Promise<AppResult<string>> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return err(appError('unauthorized', 'No authenticated user.'));
  }
  return ok(data.user.id);
}

/**
 * High-risk secret patterns. Used to assert that text is safe to send to an
 * external AI provider. Intentionally conservative (false positives > leaks).
 */
export const HIGH_RISK_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: 'ein', re: /\b\d{2}-\d{7}\b/g },
  // 13–19 digit sequences (cards / long account numbers), allowing spaces/dashes
  { name: 'long_account_number', re: /\b(?:\d[ -]?){13,19}\b/g },
  { name: 'iban', re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
];

export const PII_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'email', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { name: 'phone', re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
];

export function containsHighRiskSecret(text: string): boolean {
  return HIGH_RISK_PATTERNS.some(({ re }) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}
