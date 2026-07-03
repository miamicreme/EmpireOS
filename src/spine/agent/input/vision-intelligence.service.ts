import type { SuggestedDraft } from '@/spine/ai/agent/agent.types';
import { routeProviderForTask } from '@/spine/ai/provider-capabilities';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';

export interface VisionAnalysis {
  artifactType: 'vision_analysis' | 'camera_analysis' | 'video_frame_analysis';
  title: string;
  summary: string;
  keyFacts: string[];
  risks: string[];
  opportunities: string[];
  recommendedActions: string[];
  confidence: number;
  provider: string;
  suggestedDrafts: SuggestedDraft[];
}

export function analyzeVision(input: { descriptions: string[]; kind: 'image' | 'screenshot' | 'camera_snapshot' | 'video_frames'; allowVision?: boolean }): AppResult<VisionAnalysis> {
  if (input.allowVision === false) return err(appError('validation', 'Vision analysis requires allowVision.'));
  const provider = routeProviderForTask('vision');
  if (!provider.ok) return err(appError('validation', provider.code));
  const text = input.descriptions.join('\n').toLowerCase();
  const screenshot = input.kind === 'screenshot' || /error|bug|screen|ui|login|console/.test(text);
  const recommendedActions = [
    screenshot ? 'Create troubleshoot/fix/research draft for the screenshot issue.' : null,
    input.kind === 'camera_snapshot' ? 'Clarify, recapture, analyze, or save this camera observation.' : null,
    input.kind === 'video_frames' ? 'Review sampled frames and decide whether deeper visual analysis is needed.' : null,
  ].filter(Boolean) as string[];
  return ok({
    artifactType: input.kind === 'camera_snapshot' ? 'camera_analysis' : input.kind === 'video_frames' ? 'video_frame_analysis' : 'vision_analysis',
    title: input.kind === 'camera_snapshot' ? 'Camera analysis' : input.kind === 'video_frames' ? 'Video frame analysis' : 'Vision analysis',
    summary: input.descriptions[0] ?? 'Vision-capable provider required for image understanding.',
    keyFacts: input.descriptions.length ? input.descriptions : ['No visual description supplied.'],
    risks: input.descriptions.length ? [] : ['Image content was not described locally.'],
    opportunities: recommendedActions.length ? recommendedActions : ['Use visual artifact as context for the next agent run.'],
    recommendedActions,
    confidence: input.descriptions.length ? 0.72 : 0.35,
    provider: provider.provider,
    suggestedDrafts: recommendedActions.map((title) => ({ title, description: `Suggested from ${input.kind} visual analysis.`, category: screenshot ? 'projects' : 'general', priority: screenshot ? 'medium' : 'low', reason: 'Vision intelligence identified approval-gated work.', confidenceScore: 0.68 })),
  });
}
