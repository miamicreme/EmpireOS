import { describe, it, expect } from 'vitest';
import { balanceEffect, computeInsights } from '@/modules/finances/insights';
import type { FinancialAccount, FinancialTransaction } from '@/modules/finances/types';

function account(p: Partial<FinancialAccount>): FinancialAccount {
  return {
    id: 'a', user_id: 'u', name: 'acc', account_type: 'checking', balance: 0,
    is_liability: false, liquid: true, institution: null, notes: null,
    created_at: '', updated_at: '', ...p,
  };
}
function txn(p: Partial<FinancialTransaction>): FinancialTransaction {
  return {
    id: 't', user_id: 'u', account_id: null, occurred_on: '2026-07-01', description: 'x',
    amount: 0, kind: 'expense', category: null, recurring: false, cadence: 'once',
    notes: null, created_at: '', updated_at: '', ...p,
  };
}

describe('finances balanceEffect', () => {
  it('asset: income raises, expense lowers', () => {
    expect(balanceEffect('income', 100, false)).toBe(100);
    expect(balanceEffect('expense', 40, false)).toBe(-40);
  });
  it('liability: expense/charge raises owed, income/payment lowers owed', () => {
    expect(balanceEffect('expense', 100, true)).toBe(100);
    expect(balanceEffect('income', 100, true)).toBe(-100);
  });
});

describe('finances computeInsights', () => {
  it('nets assets minus liabilities and derives runway from recurring net burn', () => {
    const accounts = [
      account({ id: 'chk', account_type: 'checking', balance: 6000, liquid: true }),
      account({ id: 'inv', account_type: 'investment', balance: 10000, liquid: false }),
      account({ id: 'cc', account_type: 'credit_card', balance: 2000, is_liability: true, liquid: false }),
    ];
    const txns = [
      txn({ kind: 'expense', amount: 2000, recurring: true, cadence: 'monthly', category: 'rent' }),
      txn({ kind: 'expense', amount: 1200, recurring: true, cadence: 'yearly', category: 'insurance' }), // 100/mo
      txn({ kind: 'income', amount: 1000, recurring: true, cadence: 'monthly' }),
      txn({ kind: 'expense', amount: 999, recurring: false, cadence: 'once' }), // ignored for burn
    ];
    const i = computeInsights(accounts, txns);
    expect(i.totalAssets).toBe(16000);
    expect(i.totalLiabilities).toBe(2000);
    expect(i.netWorth).toBe(14000);
    expect(i.liquidAssets).toBe(6000);
    expect(i.monthlyRecurringExpense).toBe(2100); // 2000 + 100
    expect(i.monthlyRecurringIncome).toBe(1000);
    // net burn = 2100 - 1000 = 1100; runway = 6000 / 1100 ≈ 5.5
    expect(i.runwayMonths).toBe(5.5);
    expect(i.topExpenseCategories[0]).toEqual({ category: 'rent', monthly: 2000 });
  });

  it('runway is null when cash-flow positive', () => {
    const i = computeInsights(
      [account({ balance: 5000 })],
      [txn({ kind: 'income', amount: 5000, recurring: true, cadence: 'monthly' })],
    );
    expect(i.runwayMonths).toBeNull();
  });
});
