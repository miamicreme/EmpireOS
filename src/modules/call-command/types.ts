export const CALL_STAGES = ['opening', 'discovery', 'objection', 'closing', 'unknown'] as const;
export type CallStage = (typeof CALL_STAGES)[number];

export interface CallHistoryTurn {
  speaker: 'rep' | 'prospect';
  text: string;
}

export interface CallAssistRequest {
  input: string;
  stage: CallStage;
  intent?: string;
  history: CallHistoryTurn[];
  recentLowConfidenceCount: number;
}

export interface CallAssistResult {
  response: string;
  intent: string;
  confidence: number;
  next_action: string;
  escalate: boolean;
  provider: string;
}
