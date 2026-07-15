import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZodType } from 'zod';
import type { AppResult } from '@/lib/result';

export type ToolRiskLevel = 'read' | 'low' | 'medium' | 'high' | 'critical';
export type ToolSideEffect = 'none' | 'draft' | 'reversible_write' | 'external_write' | 'irreversible';
export type ToolApprovalPolicy = 'none' | 'confirm' | 'strong_confirm' | 'manual_only';

export interface ToolExecutionContext {
  userId: string;
  supabase: SupabaseClient;
  traceId: string;
  runId?: string;
  approvalId?: string;
}

export interface ToolReceipt<T> {
  receiptId: string;
  toolId: string;
  toolVersion: string;
  traceId: string;
  status: 'verified' | 'unverified';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  output: T;
}

export interface ToolDefinition<I, O> {
  id: string;
  version: string;
  moduleId: string;
  description: string;
  inputSchema: ZodType<I>;
  outputSchema: ZodType<O>;
  riskLevel: ToolRiskLevel;
  sideEffect: ToolSideEffect;
  approvalPolicy: ToolApprovalPolicy;
  timeoutMs: number;
  execute: (context: ToolExecutionContext, input: I) => Promise<AppResult<O>>;
  verify?: (context: ToolExecutionContext, output: O) => Promise<AppResult<boolean>>;
}

export type AnyToolDefinition = ToolDefinition<unknown, unknown>;
