/**
 * AI financial summary. Reads the deterministic finance snapshot (net worth,
 * burn, runway, categories) and produces a grounded "state of your finances"
 * brief — like the Chief of Staff, but financial. Uses the shared runner, so it
 * inherits provider failover across the configured (free-tier) providers.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import { ok, type AppResult } from '@/lib/result';
import { aiConfig } from '@/lib/env';
import { runStructured } from './ai-runner';
import { resolveUserCredentials } from './providers/provider-config.service';
import { financeSummaryOutputSchema } from './ai.schemas';
import { getFinanceSnapshot } from '@/modules/finances/service';
import type { FinanceInsights } from '@/modules/finances/types';

type FinanceSummaryOutput = z.infer<typeof financeSummaryOutputSchema>;

const SYSTEM_PROMPT = `You are the financial analyst for Empire OS. You receive a
computed snapshot of the operator's finances (net worth, assets, liabilities,
liquid cash, monthly recurring income/expense, runway, and top expense
categories). The numbers are authoritative — use them verbatim, never invent or
recompute. Be direct and specific.

Return ONLY JSON:
{
  "headline": "one line: the financial bottom line",
  "state": "2-4 sentences on the real state of the finances",
  "strengths": ["what's going well", "..."],
  "risks": ["specific financial risk", "..."],
  "moves": [ { "title": "a concrete money move", "why": "grounded in the numbers" } ],
  "confidence": 0.0-1.0
}
At most 4 strengths, 4 risks, and 5 moves.`;

function stub(i: FinanceInsights): FinanceSummaryOutput {
  const runway = i.runwayMonths === null ? 'positive cash flow' : `${i.runwayMonths} months of runway`;
  return {
    headline: `[STUB] Net worth $${i.netWorth}, ${runway}.`,
    state: `Assets $${i.totalAssets}, liabilities $${i.totalLiabilities}, liquid $${i.liquidAssets}. Monthly burn $${i.monthlyRecurringExpense}, income $${i.monthlyRecurringIncome}. Configure an AI provider for live analysis.`,
    strengths: i.netWorth > 0 ? ['Positive net worth.'] : [],
    risks: [
      ...(i.netWorth < 0 ? ['Negative net worth.'] : []),
      ...(i.runwayMonths !== null && i.runwayMonths < 3 ? [`Only ${i.runwayMonths} months of runway.`] : []),
    ],
    moves: i.topExpenseCategories.slice(0, 3).map((c) => ({
      title: `Review ${c.category} spend`,
      why: `$${c.monthly}/mo recurring.`,
    })),
    confidence: 0.5,
  };
}

export async function runFinanceSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<{ output: FinanceSummaryOutput; insights: FinanceInsights }>> {
  const snap = await getFinanceSnapshot(supabase, userId);
  if (!snap.ok) return snap;
  const { insights, accounts, transactions } = snap.data;

  const credentials = await resolveUserCredentials(supabase, userId);
  const run = await runStructured({
    feature: 'finance_summary',
    systemPrompt: SYSTEM_PROMPT,
    instruction: 'Summarize the state of these finances and the top money moves.',
    context: {
      insights,
      accounts: accounts.map((a) => ({
        name: a.name,
        type: a.account_type,
        balance: a.balance,
        isLiability: a.is_liability,
      })),
      recurring: transactions
        .filter((t) => t.recurring)
        .map((t) => ({ description: t.description, amount: t.amount, kind: t.kind, cadence: t.cadence, category: t.category })),
    },
    schema: financeSummaryOutputSchema,
    stub: stub(insights),
    model: aiConfig.defaultModel,
    maxTokens: 1200,
    credentials,
  });

  return ok({ output: run.data, insights });
}
