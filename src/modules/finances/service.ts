/**
 * Finances module. Owns financial_accounts + financial_transactions; surfaces
 * net-worth / burn / runway metrics, actions, and a decision context to the
 * Spine via the ModuleContract.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import type { ModuleContract } from '@/spine/module-contract';
import { emitSystemEvent } from '@/spine/events/event.service';
import { manifest } from './manifest';
import { getMetrics, getHealth } from './metrics';
import { getActions } from './actions';
import { getDecisionContext } from './decisions';
import { computeInsights } from './insights';
import {
  createAccountSchema,
  updateAccountSchema,
  createTransactionSchema,
  updateTransactionSchema,
  LIABILITY_TYPES,
  LIQUID_TYPES,
  type CreateAccountInput,
  type UpdateAccountInput,
  type CreateTransactionInput,
  type UpdateTransactionInput,
} from './schemas';
import type { FinanceInsights, FinancialAccount, FinancialTransaction } from './types';

const ACCOUNTS = 'financial_accounts';
const TXNS = 'financial_transactions';

// --- Accounts --------------------------------------------------------------

export async function getAccounts(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<FinancialAccount[]>> {
  const { data, error } = await supabase
    .from(ACCOUNTS)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as FinancialAccount[]);
}

export async function createAccount(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAccountInput,
): Promise<AppResult<FinancialAccount>> {
  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid account.', parsed.error.format()));
  }
  const v = parsed.data;
  // Default liability/liquidity from the account type unless explicitly set.
  const is_liability = v.is_liability ?? (LIABILITY_TYPES as readonly string[]).includes(v.account_type);
  const liquid = v.liquid ?? (LIQUID_TYPES as readonly string[]).includes(v.account_type);

  const { data, error } = await supabase
    .from(ACCOUNTS)
    .insert({ ...v, is_liability, liquid, user_id: userId })
    .select('*')
    .single();
  if (error) return err(appError('db_error', error.message));

  await emitSystemEvent(supabase, userId, {
    event_name: 'finances.account.created',
    event_type: 'created',
    module_id: manifest.id,
    entity_type: 'financial_account',
    entity_id: (data as FinancialAccount).id,
    payload: { balance: (data as FinancialAccount).balance },
  });
  return ok(data as FinancialAccount);
}

export async function updateAccount(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateAccountInput,
): Promise<AppResult<FinancialAccount>> {
  const parsed = updateAccountSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid account update.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(ACCOUNTS)
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Account not found.'));
  return ok(data as FinancialAccount);
}

export async function deleteAccount(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<{ id: string }>> {
  const { error } = await supabase.from(ACCOUNTS).delete().eq('id', id).eq('user_id', userId);
  if (error) return err(appError('db_error', error.message));
  return ok({ id });
}

// --- Transactions ----------------------------------------------------------

export async function getTransactions(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<FinancialTransaction[]>> {
  const { data, error } = await supabase
    .from(TXNS)
    .select('*')
    .eq('user_id', userId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as FinancialTransaction[]);
}

export async function createTransaction(
  supabase: SupabaseClient,
  userId: string,
  input: CreateTransactionInput,
): Promise<AppResult<FinancialTransaction>> {
  const parsed = createTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid transaction.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TXNS)
    .insert({ ...parsed.data, user_id: userId })
    .select('*')
    .single();
  if (error) return err(appError('db_error', error.message));

  await emitSystemEvent(supabase, userId, {
    event_name: 'finances.transaction.created',
    event_type: 'created',
    module_id: manifest.id,
    entity_type: 'financial_transaction',
    entity_id: (data as FinancialTransaction).id,
    payload: { kind: (data as FinancialTransaction).kind, amount: (data as FinancialTransaction).amount },
  });
  return ok(data as FinancialTransaction);
}

export async function updateTransaction(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateTransactionInput,
): Promise<AppResult<FinancialTransaction>> {
  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid transaction update.', parsed.error.format()));
  }
  const { data, error } = await supabase
    .from(TXNS)
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'Transaction not found.'));
  return ok(data as FinancialTransaction);
}

export async function deleteTransaction(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<AppResult<{ id: string }>> {
  const { error } = await supabase.from(TXNS).delete().eq('id', id).eq('user_id', userId);
  if (error) return err(appError('db_error', error.message));
  return ok({ id });
}

// --- Insights --------------------------------------------------------------

export interface FinanceSnapshot {
  accounts: FinancialAccount[];
  transactions: FinancialTransaction[];
  insights: FinanceInsights;
}

/** Load accounts + transactions and the derived insight in one call. */
export async function getFinanceSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<FinanceSnapshot>> {
  const [accounts, transactions] = await Promise.all([
    getAccounts(supabase, userId),
    getTransactions(supabase, userId),
  ]);
  if (!accounts.ok) return accounts;
  if (!transactions.ok) return transactions;
  const insights = computeInsights(accounts.data, transactions.data);
  return ok({ accounts: accounts.data, transactions: transactions.data, insights });
}

export const financesModule: ModuleContract = {
  manifest,
  getMetrics: (userId) => getMetrics(createClient(), userId),
  getActions: (userId) => getActions(createClient(), userId),
  getDecisionContext: (userId) => getDecisionContext(createClient(), userId),
  getHealth: (userId) => getHealth(createClient(), userId),
  syncToSpine: async (userId) => {
    const supabase = createClient();
    await emitSystemEvent(supabase, userId, {
      event_name: 'module.synced',
      event_type: 'synced',
      module_id: manifest.id,
      payload: {},
    });
  },
};
