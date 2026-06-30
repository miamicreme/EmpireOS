/**
 * Feedback learning.
 *
 * Reads the operator's revealed preferences from prior AI interactions —
 * accepted vs dismissed recommendations and approved vs rejected action drafts —
 * and distills them into FeedbackSignals the prompt can use to adapt. This is
 * the loop that makes the system get smarter the more it's used.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, type AppResult } from '@/lib/result';
import { isoDateDaysAgo } from '@/lib/dates';
import type { FeedbackSignals } from '../ai.types';

const LOOKBACK_DAYS = 30;
const MIN_SAMPLES = 3; // need enough signal before claiming a preference

interface RecRow {
  recommendation: string;
  accepted_at: string | null;
  dismissed_at: string | null;
}

interface DraftRow {
  category: string;
  status: string;
}

/**
 * Build FeedbackSignals for a user. Always returns ok() with a best-effort
 * summary; a missing table or empty history yields zeroed signals.
 */
export async function summarizeFeedback(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<FeedbackSignals>> {
  const since = isoDateDaysAgo(LOOKBACK_DAYS);

  const [recs, drafts] = await Promise.all([
    fetchRecs(supabase, userId, since),
    fetchDrafts(supabase, userId, since),
  ]);

  const accepted = recs.filter((r) => r.accepted_at);
  const dismissed = recs.filter((r) => r.dismissed_at);
  const approvedDrafts = drafts.filter((d) => d.status === 'approved');
  const rejectedDrafts = drafts.filter((d) => d.status === 'rejected');

  // Category preference from draft decisions: a category is "preferred" when it
  // is approved clearly more than rejected, and "avoided" when the reverse.
  const byCategory = new Map<string, { approved: number; rejected: number }>();
  for (const d of drafts) {
    const entry = byCategory.get(d.category) ?? { approved: 0, rejected: 0 };
    if (d.status === 'approved') entry.approved++;
    else if (d.status === 'rejected') entry.rejected++;
    byCategory.set(d.category, entry);
  }

  const preferredCategories: string[] = [];
  const avoidedCategories: string[] = [];
  for (const [category, { approved, rejected }] of byCategory) {
    const total = approved + rejected;
    if (total < MIN_SAMPLES) continue;
    const approvalRate = approved / total;
    if (approvalRate >= 0.66) preferredCategories.push(category);
    else if (approvalRate <= 0.34) avoidedCategories.push(category);
  }

  return ok({
    acceptedCount: accepted.length,
    dismissedCount: dismissed.length,
    approvedDraftCount: approvedDrafts.length,
    rejectedDraftCount: rejectedDrafts.length,
    preferredCategories,
    avoidedCategories,
    recentAccepted: accepted.slice(0, 5).map((r) => r.recommendation),
    recentDismissed: dismissed.slice(0, 5).map((r) => r.recommendation),
  });
}

async function fetchRecs(
  supabase: SupabaseClient,
  userId: string,
  since: string,
): Promise<RecRow[]> {
  try {
    const { data } = await supabase
      .from('ai_recommendations')
      .select('recommendation, accepted_at, dismissed_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);
    return (data ?? []) as RecRow[];
  } catch {
    return [];
  }
}

async function fetchDrafts(
  supabase: SupabaseClient,
  userId: string,
  since: string,
): Promise<DraftRow[]> {
  try {
    const { data } = await supabase
      .from('ai_action_drafts')
      .select('category, status')
      .eq('user_id', userId)
      .gte('created_at', since)
      .limit(200);
    return (data ?? []) as DraftRow[];
  } catch {
    return [];
  }
}
