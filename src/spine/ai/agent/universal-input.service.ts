/**
 * Universal input intelligence.
 *
 * Normalizes documents, spreadsheets, screenshots, camera snapshots, sampled
 * video frames, and transcripts into compact agent artifacts. This does not
 * create another AI island: deeper reasoning still flows through
 * POST /api/ai/agent/run with inputArtifactIds.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, type AppResult } from '@/lib/result';
import { normalizeRawInput } from '@/spine/agent/input/file-ingestion.service';
import { analyzeDocument } from '@/spine/agent/input/document-intelligence.service';
import { analyzeSpreadsheet } from '@/spine/agent/input/spreadsheet-intelligence.service';
import { analyzeVision } from '@/spine/agent/input/vision-intelligence.service';
import { createActionDrafts, saveArtifact } from './agent-repository.service';
import type { ArtifactType, SuggestedDraft } from './agent.types';
import type { UniversalInputAnalyzeDTO } from './agent.schemas';

/**
 * Hard cap on sampled video frames analyzed per submission. Bounds cost and
 * enforces the "no silent streaming" guarantee — a submission can only ever
 * carry a small, deliberate handful of frames.
 */
const MAX_VIDEO_FRAMES = 10;

function toAgentArtifactType(type: string): ArtifactType {
  if (type === 'camera_analysis') return 'camera_analysis';
  if (type === 'video_frame_analysis') return 'video_frame_analysis';
  if (type === 'vision_analysis') return 'vision_analysis';
  if (type === 'spreadsheet_analysis') return 'spreadsheet_analysis';
  return 'document_analysis';
}

function highStakesNeedsResearch(text: string, inputType: string) {
  return /legal|lawsuit|foreclosure|default|credit|tradeline|trading|investment|offering memorandum|purchase agreement|loan/i.test(text) || inputType === 'xlsx';
}

export interface UniversalInputArtifactResult {
  artifactId: string;
  artifactType: ArtifactType;
  summary: string;
  keyFacts: string[];
  risks: string[];
  opportunities: string[];
  recommendedActions: string[];
  actionDraftIds: string[];
  provider: string | null;
  nextCommandHint: string;
}

export async function analyzeUniversalInput(
  supabase: SupabaseClient,
  userId: string,
  input: UniversalInputAnalyzeDTO,
): Promise<AppResult<UniversalInputArtifactResult>> {
  const normalized = normalizeRawInput({ ...input, allowDeepAnalysis: input.allowDeepAnalysis });
  if (!normalized.ok) return normalized;
  const data = normalized.data;

  // Bound sampled video frames to MAX_VIDEO_FRAMES before any analysis.
  const imageDescriptions =
    input.inputType === 'video_frames'
      ? data.imageDescriptions.slice(0, MAX_VIDEO_FRAMES)
      : data.imageDescriptions;

  const analysis = data.rows.length > 0 || input.inputType === 'csv' || input.inputType === 'xlsx'
    ? ok(analyzeSpreadsheet(data.rows, data.fileName))
    : input.inputType === 'image' || input.inputType === 'screenshot' || input.inputType === 'camera_snapshot' || input.inputType === 'video_frames'
      ? await analyzeVision({ descriptions: imageDescriptions, images: data.imageInputs, kind: input.inputType, allowVision: input.allowVision })
      : ok(analyzeDocument({ text: data.extractedText, fileName: data.fileName, inputType: input.inputType }));
  if (!analysis.ok) return analysis;

  const a = analysis.data;
  const requiresResearch = highStakesNeedsResearch(data.extractedText, input.inputType);
  const artifactType = requiresResearch && !input.allowDeepAnalysis ? 'research_needed' : toAgentArtifactType(a.artifactType);
  const contentJson = {
    artifactType,
    title: a.title,
    summary: a.summary,
    keyFacts: a.keyFacts,
    risks: a.risks,
    opportunities: a.opportunities,
    recommendedActions: a.recommendedActions,
    confidence: a.confidence,
    sourceReferences: data.sourceRefs,
    input: {
      inputType: input.inputType,
      fileName: data.fileName,
      mimeType: data.mimeType,
      textPreview: data.extractedText.slice(0, 2000),
      rowsPreview: data.rows.slice(0, 5),
      imageDescriptions,
      imageByteMetadata: data.imageInputs.map((image) => ({
        mediaType: image.mediaType,
        format: image.format,
        byteLength: image.byteLength,
        sha256: image.sha256,
        width: image.width,
        height: image.height,
        sourceName: image.sourceName,
      })),
      transcriptPreview: data.transcript?.slice(0, 2000) ?? null,
    },
    routing: {
      provider: 'provider' in a ? a.provider : null,
      highStakes: requiresResearch,
      researchRequired: artifactType === 'research_needed',
      cost: data.cost,
    },
    safety: {
      redactionChecked: data.redactionChecked,
      highRiskSecretsRedacted: data.highRiskSecretsRedacted,
      cameraActivatedServerSide: false,
      videoStreamStored: false,
      hiddenChainOfThoughtStored: false,
    },
  };

  const artifact = await saveArtifact(supabase, userId, null, {
    artifactType,
    title: a.title,
    summary: artifactType === 'research_needed' ? `${a.summary} Research/deep review is required before final advice.` : a.summary,
    contentJson,
    sourceRefs: data.sourceRefs,
    confidence: a.confidence,
    riskLevel: requiresResearch ? 'high' : a.risks.length ? 'medium' : 'low',
  });
  if (!artifact.ok) return artifact;

  const drafts: SuggestedDraft[] = input.createDrafts === false ? [] : a.suggestedDrafts;
  const draftResult = await createActionDrafts(supabase, userId, null, artifact.data.id, drafts);
  if (!draftResult.ok) return draftResult;

  return ok({
    artifactId: artifact.data.id,
    artifactType,
    summary: artifact.data.summary ?? a.summary,
    keyFacts: a.keyFacts,
    risks: a.risks,
    opportunities: a.opportunities,
    recommendedActions: a.recommendedActions,
    actionDraftIds: draftResult.data.map((draft) => draft.id),
    provider: 'provider' in a ? a.provider : null,
    nextCommandHint: `Run POST /api/ai/agent/run with inputArtifactIds: [${artifact.data.id}] to reason over this input.`,
  });
}
