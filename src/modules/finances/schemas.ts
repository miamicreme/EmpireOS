import { z } from 'zod';

export const accountType = z.enum([
  'checking',
  'savings',
  'cash',
  'investment',
  'retirement',
  'credit_card',
  'loan',
  'mortgage',
  'other',
]);

export const transactionKind = z.enum(['income', 'expense']);
export const cadence = z.enum(['once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']);

/** Account types that represent money owed (liabilities) by default. */
export const LIABILITY_TYPES = ['credit_card', 'loan', 'mortgage'] as const;
/** Account types counted as liquid (spendable) toward runway. */
export const LIQUID_TYPES = ['checking', 'savings', 'cash'] as const;

export const createAccountSchema = z.object({
  name: z.string().min(1).max(120),
  account_type: accountType.default('checking'),
  balance: z.coerce.number().default(0),
  is_liability: z.boolean().optional(),
  liquid: z.boolean().optional(),
  institution: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateAccountSchema = createAccountSchema.partial();

export const createTransactionSchema = z.object({
  account_id: z.string().uuid().nullable().optional(),
  occurred_on: z.string().optional(),
  description: z.string().min(1).max(300),
  amount: z.coerce.number().nonnegative(),
  kind: transactionKind.default('expense'),
  category: z.string().max(80).nullable().optional(),
  recurring: z.boolean().default(false),
  cadence: cadence.default('once'),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
