import type { SupabaseClient } from '@supabase/supabase-js';
import { todayISODate } from '@/lib/dates';
import type { ModuleMetric, ModuleHealthResult } from '@/spine/types';
import { manifest } from './manifest';
import { computeInsights } from './insights';
import type { FinanceInsights, FinancialAccount, FinancialTransaction } from './types';

/** Load accounts + transactions and compute the derived insight. Queries the
 *  tables directly (not the service) to avoid a circular import. */
async function loadInsights(
  supabase: SupabaseClient,
  userId: string,
): Promise<FinanceInsights> {
  const [{ data: accounts }, { data: txns }] = await Promise.all([
    supabase.from('financial_accounts').select('*').eq('user_id', userId),
    supabase.from('financial_transactions').select('*').eq('user_id', userId),
  ]);
  return computeInsights(
    (accounts ?? []) as FinancialAccount[],
    (txns ?? []) as FinancialTransaction[],
  );
}

export async function getMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleMetric[]> {
  const i = await loadInsights(supabase, userId);
  const date = todayISODate();
  const now = new Date().toISOString();
  const base = { user_id: userId, module_id: manifest.id, metric_text: null, date, trend_direction: null, metadata: {}, created_at: now };
  return [
    { ...base, id: `derived:net_worth:${date}`, metric_key: 'net_worth', metric_label: 'Net Worth', metric_value: i.netWorth, target_value: null, unit: 'USD' },
    { ...base, id: `derived:monthly_burn:${date}`, metric_key: 'monthly_burn', metric_label: 'Monthly Burn', metric_value: i.monthlyRecurringExpense, target_value: null, unit: 'USD' },
    { ...base, id: `derived:runway_months:${date}`, metric_key: 'runway_months', metric_label: 'Runway (months)', metric_value: i.runwayMonths, target_value: null, unit: 'months' },
    { ...base, id: `derived:liquid_assets:${date}`, metric_key: 'liquid_assets', metric_label: 'Liquid Assets', metric_value: i.liquidAssets, target_value: null, unit: 'USD' },
  ];
}

/** Green if net worth positive with 6+ months runway; red if underwater or <1mo. */
export async function getHealth(
  supabase: SupabaseClient,
  userId: string,
): Promise<ModuleHealthResult> {
  const i = await loadInsights(supabase, userId);
  if (i.accountCount === 0) {
    return { moduleId: manifest.id, health: 'yellow', reason: 'No accounts added yet.' };
  }
  if (i.netWorth < 0) {
    return { moduleId: manifest.id, health: 'red', reason: 'Net worth is negative (underwater).' };
  }
  if (i.runwayMonths !== null && i.runwayMonths < 1) {
    return { moduleId: manifest.id, health: 'red', reason: 'Under 1 month of runway.' };
  }
  if (i.runwayMonths !== null && i.runwayMonths < 6) {
    return { moduleId: manifest.id, health: 'yellow', reason: `~${i.runwayMonths} months of runway.` };
  }
  return { moduleId: manifest.id, health: 'green', reason: 'Positive net worth and healthy runway.' };
}
