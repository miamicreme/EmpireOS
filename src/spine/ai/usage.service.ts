/**
 * AI usage telemetry. Best-effort: a failure to record usage must never break
 * the feature that produced it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export interface RecordUsageInput {
  feature: string;
  provider?: string;
  modelName?: string;
  inputTokens?: number;
  outputTokens?: number;
  success?: boolean;
  metadata?: Record<string, unknown>;
}

export async function recordUsage(
  supabase: SupabaseClient,
  userId: string,
  input: RecordUsageInput,
): Promise<void> {
  try {
    await supabase.from('ai_usage_events').insert({
      user_id: userId,
      feature: input.feature,
      provider: input.provider ?? null,
      model_name: input.modelName ?? null,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      success: input.success ?? true,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    logger.warn('ai_usage_record_failed', {
      feature: input.feature,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
