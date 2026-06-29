/**
 * AI Recommendations.
 *
 * Persists ranked recommendations and tracks their lifecycle (accepted /
 * dismissed) so the system can learn what the user acts on over time.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { nowISO } from '@/lib/dates';
import { redactSensitiveText } from '../decisions/context-redaction.service';
import type { RecommendationOutput, RiskLevel, UpsideLevel } from './ai.types';

const TABLE = 'ai_recommendations';

export interface Recommendation {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string | null;
  recommendation: string;
  reasoning: string | null;
  confidence: number | null;
  risk_level: RiskLevel | null;
  upside_level: UpsideLevel | null;
  rank: number;
  suggested_actions: unknown;
  model_name: string | null;
  provider: string | null;
  accepted_at: string | null;
  dismissed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PersistRecommendationInput extends RecommendationOutput {
  sourceType: string;
  sourceId?: string | null;
  rank?: number;
  modelName?: string | null;
  provider?: string | null;
}

export async function persistRecommendations(
  supabase: SupabaseClient,
  userId: string,
  inputs: PersistRecommendationInput[],
): Promise<AppResult<Recommendation[]>> {
  if (inputs.length === 0) return ok([]);

  const rows = inputs.map((r, i) => ({
    user_id: userId,
    source_type: r.sourceType,
    source_id: r.sourceId ?? null,
    recommendation: redactSensitiveText(r.recommendation),
    reasoning: r.reasoning ? redactSensitiveText(r.reasoning) : null,
    confidence: r.confidence,
    risk_level: r.riskLevel,
    upside_level: r.upsideLevel,
    rank: r.rank ?? i,
    suggested_actions: r.suggestedActions ?? [],
    model_name: r.modelName ?? null,
    provider: r.provider ?? null,
  }));

  const { data, error } = await supabase.from(TABLE).insert(rows).select('*');
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as Recommendation[]);
}

export async function getRecommendations(
  supabase: SupabaseClient,
  userId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<AppResult<Recommendation[]>> {
  let query = supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('rank', { ascending: true });

  if (opts.activeOnly) {
    query = query.is('accepted_at', null).is('dismissed_at', null);
  }

  const { data, error } = await query;
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as Recommendation[]);
}

export async function setRecommendationState(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  action: 'accept' | 'dismiss',
): Promise<AppResult<Recommendation>> {
  const patch =
    action === 'accept'
      ? { accepted_at: nowISO(), dismissed_at: null }
      : { dismissed_at: nowISO(), accepted_at: null };

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Recommendation not found.'));
  return ok(data as Recommendation);
}
