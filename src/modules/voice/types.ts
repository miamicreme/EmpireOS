export type VoiceSessionStatus =
  | 'idle'
  | 'listening'
  | 'speech_detected'
  | 'capturing'
  | 'transcribing'
  | 'evaluating_direction'
  | 'awaiting_empire'
  | 'speaking'
  | 'interrupted'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type VoiceDirection = 'directed' | 'not_directed' | 'stop_request' | 'ambiguous';
export type VoiceDeviceClass = 'mobile_web' | 'desktop_web' | 'voice_node';

export interface VoiceClientContext {
  channel: 'voice';
  sessionId: string;
  utteranceId: string;
  language?: string;
  deviceClass: VoiceDeviceClass;
}

export interface VoiceTranscriptionResult {
  text: string;
  language?: string;
  confidence?: number;
  noSpeechProbability?: number;
  durationMs: number;
  provider: string;
  model: string;
}

export interface VoiceDirectionResult {
  direction: VoiceDirection;
  confidence: number;
  reasonCode:
    | 'wake_phrase'
    | 'active_followup'
    | 'explicit_stop'
    | 'likely_echo'
    | 'not_addressed'
    | 'uncertain';
}

export interface VoiceSessionSummary {
  id: string;
  status: VoiceSessionStatus;
  deviceClass: VoiceDeviceClass;
  language?: string;
  startedAt: string;
  completedAt?: string;
  utteranceCount: number;
  activeEmpireRunId?: string;
}

export interface VoiceSpeechRequest {
  text: string;
  voice?: string;
  language?: string;
  speed?: number;
}

export interface VoiceSpeechResult {
  speechRunId: string;
  provider: string;
  voice: string;
  durationMs?: number;
  streamUrl?: string;
}
