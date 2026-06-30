/**
 * V2 compatibility adapters (read-only).
 *
 * Bridges V2 concepts to V3 artifacts WITHOUT duplicate writes: old surfaces can
 * read the latest agent_artifact in a V2-ish shape. New data is written only to
 * agent_* by the orchestrator.
 *
 *   ai_briefs          -> agent_artifacts (daily_brief)
 *   ai_recommendations -> agent_artifacts (recommendation)
 *   ai_conversations   -> agent_threads
 *   ai_messages        -> agent_runs + agent_artifacts
 *   ai_usage_events    -> agent_provider_runs + agent_run_events
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, type AppResult } from '@/lib/result';
import { getLatestArtifactByType } from './agent-repository.service';

export interface V2BriefShape {
  summary: string | null;
  recommendedFocus: string | null;
  topActions: unknown;
  risks: unknown;
  opportunities: unknown;
  confidence: number | null;
  createdAt: string;
}

/** Latest V3 daily_brief artifact, shaped like the V2 brief for old readers. */
export async function getLatestBriefAsV2(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<V2BriefShape | null>> {
  const res = await getLatestArtifactByType(supabase, userId, 'daily_brief');
  if (!res.ok) return res;
  if (!res.data) return ok(null);
  const a = res.data;
  const c = a.content_json as Record<string, unknown>;
  return ok({
    summary: a.summary,
    recommendedFocus: (c.answer as string) ?? a.title,
    topActions: c.nextActions ?? [],
    risks: c.risks ?? [],
    opportunities: c.opportunities ?? [],
    confidence: a.confidence,
    createdAt: a.created_at,
  });
}

export interface V2RecommendationShape {
  recommendation: string;
  reasoning: string | null;
  confidence: number | null;
  riskLevel: string | null;
  createdAt: string;
}

/** Latest V3 recommendation artifact, shaped like a V2 recommendation. */
export async function getLatestRecommendationAsV2(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<V2RecommendationShape | null>> {
  const res = await getLatestArtifactByType(supabase, userId, 'recommendation');
  if (!res.ok) return res;
  if (!res.data) return ok(null);
  const a = res.data;
  const c = a.content_json as Record<string, unknown>;
  return ok({
    recommendation: (c.answer as string) ?? a.title ?? '',
    reasoning: (c.reasoningSummary as string) ?? a.summary,
    confidence: a.confidence,
    riskLevel: a.risk_level,
    createdAt: a.created_at,
  });
}
