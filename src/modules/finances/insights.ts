/**
 * Deterministic financial insight — computed from accounts + transactions with
 * no LLM. Used by the module metrics, the /summary endpoint, and as the grounded
 * input to the AI financial summary.
 */
import type {
  FinanceInsights,
  FinancialAccount,
  FinancialTransaction,
  Cadence,
  TransactionKind,
} from './types';

/**
 * Signed change a one-off transaction applies to its linked account's balance.
 * - Asset account: income raises the balance, expense lowers it.
 * - Liability account (balance = amount owed): a charge/expense raises what's
 *   owed; a payment/income lowers it.
 */
export function balanceEffect(kind: TransactionKind, amount: number, isLiability: boolean): number {
  const amt = Math.abs(Number(amount) || 0);
  if (isLiability) return kind === 'expense' ? amt : -amt;
  return kind === 'income' ? amt : -amt;
}

/** Normalize a recurring amount at some cadence into a monthly figure. */
export function monthlyFactor(cadence: Cadence): number {
  switch (cadence) {
    case 'weekly':
      return 52 / 12;
    case 'biweekly':
      return 26 / 12;
    case 'monthly':
      return 1;
    case 'quarterly':
      return 1 / 3;
    case 'yearly':
      return 1 / 12;
    default:
      return 0; // 'once' is not part of the recurring monthly figure
  }
}

export function computeInsights(
  accounts: FinancialAccount[],
  transactions: FinancialTransaction[],
): FinanceInsights {
  let totalAssets = 0;
  let totalLiabilities = 0;
  let liquidAssets = 0;
  for (const a of accounts) {
    const bal = Number(a.balance ?? 0);
    if (a.is_liability) {
      totalLiabilities += Math.abs(bal);
    } else {
      totalAssets += bal;
      if (a.liquid) liquidAssets += bal;
    }
  }

  let monthlyRecurringExpense = 0;
  let monthlyRecurringIncome = 0;
  const expenseByCategory = new Map<string, number>();
  for (const t of transactions) {
    if (!t.recurring) continue;
    const monthly = Number(t.amount ?? 0) * monthlyFactor(t.cadence);
    if (monthly <= 0) continue;
    if (t.kind === 'expense') {
      monthlyRecurringExpense += monthly;
      const cat = (t.category ?? 'uncategorized').trim() || 'uncategorized';
      expenseByCategory.set(cat, (expenseByCategory.get(cat) ?? 0) + monthly);
    } else {
      monthlyRecurringIncome += monthly;
    }
  }

  const monthlyNet = monthlyRecurringIncome - monthlyRecurringExpense;
  const netBurn = monthlyRecurringExpense - monthlyRecurringIncome;
  const runwayMonths = netBurn > 0 ? liquidAssets / netBurn : null;

  const topExpenseCategories = [...expenseByCategory.entries()]
    .map(([category, monthly]) => ({ category, monthly: round2(monthly) }))
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 3);

  return {
    totalAssets: round2(totalAssets),
    totalLiabilities: round2(totalLiabilities),
    netWorth: round2(totalAssets - totalLiabilities),
    liquidAssets: round2(liquidAssets),
    monthlyRecurringExpense: round2(monthlyRecurringExpense),
    monthlyRecurringIncome: round2(monthlyRecurringIncome),
    monthlyNet: round2(monthlyNet),
    runwayMonths: runwayMonths === null ? null : round1(runwayMonths),
    topExpenseCategories,
    accountCount: accounts.length,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
