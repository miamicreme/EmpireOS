import type { SupabaseClient } from '@supabase/supabase-js';
import { nowISO } from '@/lib/dates';
import type { Contact, DecisionContext } from '@/spine/types';
import { manifest } from './manifest';

export async function getDecisionContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<DecisionContext> {
  const { data } = await supabase
    .from('contacts')
    .select('next_follow_up_at, status, name')
    .eq('user_id', userId);
  const contacts = (data ?? []) as Pick<Contact, 'next_follow_up_at' | 'status' | 'name'>[];
  const now = nowISO();
  const due = contacts.filter(
    (c) => c.next_follow_up_at !== null && c.next_follow_up_at <= now && c.status !== 'archived',
  );

  return {
    moduleId: manifest.id,
    summary: `${due.length} follow-ups due of ${contacts.length} contacts.`,
    facts: { dueCount: due.length, totalContacts: contacts.length },
    risks: due.length > 0 ? ['Relationships may go cold without follow-up.'] : [],
    opportunities: ['Re-engage warm contacts to unlock cash and deals.'],
    recommendedActions: due.length > 0 ? ['Clear due follow-ups today.'] : [],
  };
}
