/** Finances module domain types. */

export type AccountType =
  | 'checking'
  | 'savings'
  | 'cash'
  | 'investment'
  | 'retirement'
  | 'credit_card'
  | 'loan'
  | 'mortgage'
  | 'other';

export type TransactionKind = 'income' | 'expense';
export type Cadence = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface FinancialAccount {
  id: string;
  user_id: string;
  name: string;
  account_type: AccountType;
  balance: number;
  is_liability: boolean;
  liquid: boolean;
  institution: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialTransaction {
  id: string;
  user_id: string;
  account_id: string | null;
  occurred_on: string;
  description: string;
  amount: number;
  kind: TransactionKind;
  category: string | null;
  recurring: boolean;
  cadence: Cadence;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Derived, deterministic financial insight — computed with no LLM. */
export interface FinanceInsights {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  liquidAssets: number;
  /** Recurring expenses normalized to a monthly figure. */
  monthlyRecurringExpense: number;
  /** Recurring income normalized to a monthly figure. */
  monthlyRecurringIncome: number;
  /** Net monthly cash flow from recurring items (income - expense). */
  monthlyNet: number;
  /** Months of liquid runway at the current recurring burn (null if burn is 0). */
  runwayMonths: number | null;
  topExpenseCategories: Array<{ category: string; monthly: number }>;
  accountCount: number;
}
