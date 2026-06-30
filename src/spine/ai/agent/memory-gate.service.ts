/**
 * Memory gate.
 *
 * Decides whether a durable user fact is missing (and worth asking ≤2 targeted
 * questions) and gates what may be saved as durable memory. Facts that already
 * live in a module/profile record are referenced, never duplicated into memory.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { containsHighRiskSecret } from '@/lib/security';
import { saveMemory as repoSaveMemory } from './agent-repository.service';
import type { EmpireContext } from '../ai.types';
import type { AgentIntent, MemoryRequest, RiskLevel } from './agent.types';

/**
 * Returns the highest-leverage missing-memory questions (≤2). Conservative by
 * design: profile-backed facts (cash target, risk tolerance) are NOT re-asked
 * when the profile already holds them — that data is referenced, not duplicated.
 */
export function evaluateMemoryGate(
  ctx: EmpireContext,
  intent: AgentIntent,
  stakes: RiskLevel,
): MemoryRequest[] {
  const requests: MemoryRequest[] = [];

  // Only the highest-stakes runs justify pausing for missing durable context.
  if (stakes !== 'high') return requests;

  if (!ctx.profile) {
    requests.push({
      question: 'What is your primary objective and risk tolerance right now?',
      reason: 'No durable profile is set; high-stakes reasoning needs your goal and risk posture.',
      memoryType: 'profile',
    });
  }

  if (intent === 'stock_trading' || intent === 'acquisitions') {
    requests.push({
      question: 'What is your max acceptable loss / capital at risk for this kind of move?',
      reason: 'Position sizing and downside limits are required before high-stakes financial analysis.',
      memoryType: 'trading_risk_profile',
    });
  } else if (intent === 'credit_funding') {
    requests.push({
      question: 'What is your business entity status and current funding goal?',
      reason: 'Entity readiness and the funding target shape the credit/funding sequence.',
      memoryType: 'credit_context',
    });
  }

  return requests.slice(0, 2);
}

/**
 * Save durable memory, but refuse secrets. Module-backed facts should be
 * referenced by the caller rather than passed here.
 */
export async function saveMemoryItem(
  supabase: SupabaseClient,
  userId: string,
  input: {
    memoryType: string;
    title?: string;
    content: string;
    summary?: string;
    source?: string;
    confidence?: number;
  },
): Promise<AppResult<{ id: string }>> {
  if (containsHighRiskSecret(`${input.content} ${input.summary ?? ''} ${input.title ?? ''}`)) {
    return err(
      appError('redaction_blocked', 'Refusing to store memory containing high-risk secrets.'),
    );
  }
  return repoSaveMemory(supabase, userId, input);
}
