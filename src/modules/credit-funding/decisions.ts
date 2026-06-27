import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreditItem, DecisionContext } from '@/spine/types';
import { manifest } from './manifest';

export async function getDecisionContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<DecisionContext> {
  const { data } = await supabase
    .from('credit_items')
    .select('status, item_name, bureau')
    .eq('user_id', userId);

  const items = (data ?? []) as Pick<CreditItem, 'status' | 'item_name' | 'bureau'>[];
  const disputing = items.filter((i) => i.status === 'disputing').length;
  const resolved = items.filter((i) => i.status === 'resolved').length;
  const open = items.filter((i) => i.status === 'open').length;

  return {
    moduleId: manifest.id,
    summary: `${items.length} credit items: ${resolved} resolved, ${disputing} disputing, ${open} open.`,
    facts: {
      totalItems: items.length,
      resolved,
      disputing,
      open,
    },
    risks: disputing > 3 ? ['High dispute count may delay funding.'] : [],
    opportunities: ['Resolving disputes improves funding readiness score.'],
    recommendedActions:
      disputing > 0 ? ['Follow up on active disputes this week.'] : [],
  };
}
