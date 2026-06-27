import type { SupabaseClient } from '@supabase/supabase-js';
import type { DecisionContext } from '@/spine/types';
import { manifest } from './manifest';

/** Build the redaction-ready decision context this module contributes. */
export async function getDecisionContext(
  _supabase: SupabaseClient,
  _userId: string,
): Promise<DecisionContext> {
  return {
    moduleId: manifest.id,
    summary: `${manifest.name}: no data yet.`,
    facts: {},
    risks: [],
    opportunities: [],
    recommendedActions: [],
  };
}
