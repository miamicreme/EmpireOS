/**
 * Credit & Funding module types.
 * CreditItem mirrors the credit_items table in migration 0001.
 */
export type { CreditItem, CreditItemStatus } from '@/spine/types';

export type FundingReadiness = {
  score: number; // 0–100
  openDisputes: number;
  itemsInProgress: number;
  itemsComplete: number;
  recommendation: string;
};
