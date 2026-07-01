import type { SupabaseClient } from '@supabase/supabase-js';
import type { DecisionContext } from '@/spine/types';
import { manifest } from './manifest';
import { computeInsights } from './insights';
import type { FinancialAccount, FinancialTransaction } from './types';

export async function getDecisionContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<DecisionContext> {
  const [{ data: accounts }, { data: txns }] = await Promise.all([
    supabase.from('financial_accounts').select('*').eq('user_id', userId),
    supabase.from('financial_transactions').select('*').eq('user_id', userId),
  ]);
  const i = computeInsights(
    (accounts ?? []) as FinancialAccount[],
    (txns ?? []) as FinancialTransaction[],
  );

  const risks: string[] = [];
  if (i.netWorth < 0) risks.push('Net worth is negative.');
  if (i.runwayMonths !== null && i.runwayMonths < 3) risks.push(`Only ~${i.runwayMonths} months of runway.`);
  if (i.monthlyNet < 0) risks.push(`Recurring cash flow is negative ($${Math.abs(i.monthlyNet)}/mo).`);

  return {
    moduleId: manifest.id,
    summary: `Net worth $${i.netWorth}; liquid $${i.liquidAssets}; monthly burn $${i.monthlyRecurringExpense}; runway ${i.runwayMonths === null ? 'positive' : `${i.runwayMonths}mo`}.`,
    facts: {
      netWorth: i.netWorth,
      totalAssets: i.totalAssets,
      totalLiabilities: i.totalLiabilities,
      liquidAssets: i.liquidAssets,
      monthlyRecurringExpense: i.monthlyRecurringExpense,
      monthlyRecurringIncome: i.monthlyRecurringIncome,
      monthlyNet: i.monthlyNet,
      runwayMonths: i.runwayMonths,
      topExpenseCategories: i.topExpenseCategories,
    },
    risks,
    opportunities:
      i.monthlyNet > 0 ? ['Positive monthly cash flow — direct the surplus to debt paydown or investing.'] : [],
    recommendedActions:
      i.runwayMonths !== null && i.runwayMonths < 3 ? ['Cut recurring expenses or raise income to extend runway.'] : [],
  };
}
