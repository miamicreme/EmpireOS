import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';

export const INPUT_COST_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxExtractedChars: 80_000,
  maxChunks: 12,
  maxVideoFrames: 10,
  deepAnalysisChars: 40_000,
} as const;

export interface CostDecision {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason: string;
  estimatedChunks: number;
  contextHashSeed: string;
}

export function estimateChunks(chars: number): number {
  return Math.max(1, Math.ceil(chars / 6000));
}

export function evaluateInputCost(input: {
  sizeBytes?: number | null;
  extractedChars?: number | null;
  frameCount?: number | null;
  allowDeepAnalysis?: boolean | null;
}): AppResult<CostDecision> {
  const sizeBytes = input.sizeBytes ?? 0;
  const extractedChars = input.extractedChars ?? 0;
  const frameCount = input.frameCount ?? 0;
  if (sizeBytes > INPUT_COST_LIMITS.maxFileBytes) {
    return err(appError('validation', `Input exceeds ${INPUT_COST_LIMITS.maxFileBytes} byte limit.`));
  }
  if (extractedChars > INPUT_COST_LIMITS.maxExtractedChars) {
    return err(appError('validation', `Extracted text exceeds ${INPUT_COST_LIMITS.maxExtractedChars} character limit.`));
  }
  if (frameCount > INPUT_COST_LIMITS.maxVideoFrames) {
    return err(appError('validation', `Video analysis accepts at most ${INPUT_COST_LIMITS.maxVideoFrames} sampled frames.`));
  }
  const estimatedChunks = estimateChunks(extractedChars);
  if (estimatedChunks > INPUT_COST_LIMITS.maxChunks) {
    return err(appError('validation', `Input would create too many chunks (${estimatedChunks}).`));
  }
  const requiresConfirmation = extractedChars > INPUT_COST_LIMITS.deepAnalysisChars && !input.allowDeepAnalysis;
  return ok({
    allowed: !requiresConfirmation,
    requiresConfirmation,
    reason: requiresConfirmation ? 'deep_analysis_confirmation_required' : 'within_cost_limits',
    estimatedChunks,
    contextHashSeed: `${sizeBytes}:${extractedChars}:${frameCount}:${estimatedChunks}`,
  });
}
