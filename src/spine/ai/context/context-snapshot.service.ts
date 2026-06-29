/**
 * Context snapshots.
 *
 * Persists a point-in-time, redacted EmpireContext so AI recommendations can be
 * audited later ("what did the AI see when it said this?"). Snapshots store the
 * already-redacted object — never raw context.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { todayISODate } from '@/lib/dates';
import { redactObject } from '../redaction';
import { assertNoHighRiskSecrets } from '../../decisions/context-redaction.service';
import type { EmpireContext } from '../ai.types';

const TABLE = 'ai_context_snapshots';

export interface ContextSnapshot {
  id: string;
  user_id: string;
  captured_for: string;
  context: Record<string, unknown>;
  redactions_applied: boolean;
  empire_score: number | null;
  current_phase: string | null;
  created_at: string;
}

/** Persist a redacted snapshot of the context. */
export async function saveContextSnapshot(
  supabase: SupabaseClient,
  userId: string,
  context: EmpireContext,
): Promise<AppResult<ContextSnapshot>> {
  const redacted = redactObject(context as unknown as Record<string, unknown>);
  // Final gate: refuse to persist anything carrying high-risk secrets.
  try {
    assertNoHighRiskSecrets(JSON.stringify(redacted));
  } catch {
    return err(appError('redaction_blocked', 'Snapshot failed redaction gate.'));
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      captured_for: context.generatedFor ?? todayISODate(),
      context: redacted,
      redactions_applied: true,
      empire_score: context.empireScore?.score ?? null,
      current_phase: context.profile?.currentPhase ?? null,
    })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as ContextSnapshot);
}

export async function getLatestSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<ContextSnapshot | null>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? null) as ContextSnapshot | null);
}
