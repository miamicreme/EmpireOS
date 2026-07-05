export type { Recording, RecordingStatus } from '@/spine/types';

/** Structured output of the post-transcript analysis pass. */
export interface RecordingAnalysis {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  followUps: string[];
  questions: string[];
  names: string[];
  dates: string[];
  risks: string[];
  confidence: number;
}
