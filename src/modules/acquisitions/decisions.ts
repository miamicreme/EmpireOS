import type { SupabaseClient } from '@supabase/supabase-js';
import type { AcquisitionTarget, DecisionContext } from '@/spine/types';
import { manifest } from './manifest';

const INACTIVE_STATUSES: AcquisitionTarget['status'][] = ['closed', 'passed'];

export async function getDecisionContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<DecisionContext> {
  const { data } = await supabase
    .from('acquisition_targets')
    .select('name, status, upside_score, risk_score, seller_financing_possible')
    .eq('user_id', userId);

  const targets = (data ?? []) as Pick<
    AcquisitionTarget,
    'name' | 'status' | 'upside_score' | 'risk_score' | 'seller_financing_possible'
  >[];
  const active = targets.filter((t) => !INACTIVE_STATUSES.includes(t.status));

  return {
    moduleId: manifest.id,
    summary: `${active.length} active acquisition targets of ${targets.length} total.`,
    facts: {
      activeCount: active.length,
      totalCount: targets.length,
      sellerFinancingAvailable: active.filter((t) => t.seller_financing_possible).length,
    },
    risks: active.length === 0 ? ['No active targets — acquisition pipeline empty.'] : [],
    opportunities: ['Seller-financed deals reduce capital requirements.'],
    recommendedActions:
      active.length === 0 ? ['Research at least one new acquisition target this week.'] : [],
  };
}
