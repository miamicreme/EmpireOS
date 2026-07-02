/**
 * Universal input analysis for Prompt 3.
 *
 * This is intentionally adapter-first and routes outputs back into the compact
 * agent_* runtime as agent_artifacts. It does not create another AI system, does
 * not activate cameras, and does not stream video. Browser/device capture must
 * be explicit on the client; this service only accepts submitted content.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { containsHighRiskSecret } from '@/lib/security';
import { err, ok, type AppResult } from '@/lib/result';
import { saveArtifact } from './agent-repository.service';
import type { ArtifactType } from './agent.types';
import type { UniversalInputAnalyzeDTO } from './agent.schemas';

const MAX_TEXT_CHARS = 80_000;
const MAX_ROWS = 500;
const MAX_VIDEO_FRAMES = 10;

function textFromInput(input: UniversalInputAnalyzeDTO): string {
  return [
    input.contentText,
    input.transcript,
    input.imageDescription,
    ...(input.frameDescriptions ?? []),
  ].filter(Boolean).join('\n\n').slice(0, MAX_TEXT_CHARS);
}

function artifactTypeFor(inputType: UniversalInputAnalyzeDTO['inputType']): ArtifactType {
  if (inputType === 'csv' || inputType === 'xlsx') return 'spreadsheet_analysis';
  if (inputType === 'image' || inputType === 'screenshot') return 'vision_analysis';
  if (inputType === 'camera_snapshot') return 'camera_snapshot_analysis';
  if (inputType === 'voice_transcript') return 'voice_transcript_analysis';
  return 'document_analysis';
}

function summarizeSpreadsheet(rows: NonNullable<UniversalInputAnalyzeDTO['rows']>) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const numericColumns = columns.filter((column) => rows.some((row) => typeof row[column] === 'number'));
  const numericSummaries = Object.fromEntries(
    numericColumns.map((column) => {
      const values = rows.map((row) => row[column]).filter((value): value is number => typeof value === 'number');
      const total = values.reduce((sum, value) => sum + value, 0);
      return [column, { count: values.length, total, average: values.length ? total / values.length : 0 }];
    }),
  );
  return { rowCount: rows.length, columns, numericSummaries };
}

export async function analyzeUniversalInput(
  supabase: SupabaseClient,
  userId: string,
  input: UniversalInputAnalyzeDTO,
): Promise<AppResult<{ artifactId: string; artifactType: ArtifactType; summary: string; nextCommandHint: string }>> {
  if (input.inputType === 'video_frames' && (input.frameDescriptions?.length ?? 0) > MAX_VIDEO_FRAMES) {
    return err(appError('validation', 'Video analysis accepts at most 10 sampled frames.'));
  }
  if ((input.rows?.length ?? 0) > MAX_ROWS) {
    return err(appError('validation', `Spreadsheet analysis accepts at most ${MAX_ROWS} rows per request.`));
  }

  const text = textFromInput(input);
  if (containsHighRiskSecret(text)) {
    return err(appError('redaction_blocked', 'Refusing to analyze input containing high-risk secrets.'));
  }

  const spreadsheet = input.rows ? summarizeSpreadsheet(input.rows) : null;
  const frameCount = input.frameDescriptions?.length ?? 0;
  const summary = spreadsheet
    ? `Spreadsheet analyzed locally: ${spreadsheet.rowCount} rows, ${spreadsheet.columns.length} columns.`
    : input.inputType === 'video_frames'
      ? `Video frame sample received: ${frameCount} frame descriptions; no video stream stored.`
      : input.inputType === 'camera_snapshot'
        ? 'Camera snapshot submitted explicitly; camera activation is not server-side or silent.'
        : `Input analyzed as ${input.inputType}.`;

  const artifactType = artifactTypeFor(input.inputType);
  const artifact = await saveArtifact(supabase, userId, null, {
    artifactType,
    title: input.fileName ?? `${input.inputType} input analysis`,
    summary,
    contentJson: {
      inputType: input.inputType,
      fileName: input.fileName ?? null,
      mimeType: input.mimeType ?? null,
      textPreview: text.slice(0, 2000),
      spreadsheet,
      imageDescription: input.imageDescription ?? null,
      frameDescriptions: input.frameDescriptions ?? [],
      transcriptPreview: input.transcript?.slice(0, 2000) ?? null,
      safety: {
        redactionChecked: true,
        cameraActivatedServerSide: false,
        videoStreamStored: false,
      },
    },
    confidence: 0.8,
    riskLevel: 'low',
  });
  if (!artifact.ok) return artifact;

  return ok({
    artifactId: artifact.data.id,
    artifactType,
    summary,
    nextCommandHint: `Run POST /api/ai/agent/run with inputArtifactIds: [${artifact.data.id}] to reason over this input.`,
  });
}
