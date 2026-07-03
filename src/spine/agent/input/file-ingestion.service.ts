import { z } from 'zod';
import { containsHighRiskSecret } from '@/lib/security';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { evaluateInputCost } from '../cost/cost-governor.service';

export const supportedInputKinds = ['pdf', 'docx', 'txt', 'md', 'csv', 'xlsx', 'image', 'screenshot', 'camera_snapshot', 'video_frames', 'voice_transcript'] as const;
export type SupportedInputKind = typeof supportedInputKinds[number];

export interface NormalizedInput {
  inputType: SupportedInputKind;
  fileName: string | null;
  mimeType: string | null;
  extractedText: string;
  rows: Array<Record<string, string | number | boolean | null>>;
  imageDescriptions: string[];
  transcript: string | null;
  sourceRefs: string[];
  redactionChecked: boolean;
  cost: ReturnType<typeof evaluateInputCost> extends AppResult<infer T> ? T : never;
}

export const rawInputSchema = z.object({
  inputType: z.enum(supportedInputKinds),
  fileName: z.string().max(240).optional(),
  mimeType: z.string().max(120).optional(),
  contentText: z.string().max(100_000).optional(),
  rows: z.array(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(500).optional(),
  imageDescription: z.string().max(5000).optional(),
  frameDescriptions: z.array(z.string().max(2000)).max(10).optional(),
  transcript: z.string().max(50_000).optional(),
  allowDeepAnalysis: z.boolean().optional(),
});

export function normalizeRawInput(raw: z.infer<typeof rawInputSchema>): AppResult<NormalizedInput> {
  const extractedText = [raw.contentText, raw.transcript, raw.imageDescription, ...(raw.frameDescriptions ?? [])]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 80_000);
  if (containsHighRiskSecret(extractedText)) {
    return err(appError('redaction_blocked', 'Refusing to analyze input containing high-risk secrets.'));
  }
  const cost = evaluateInputCost({
    extractedChars: extractedText.length,
    frameCount: raw.frameDescriptions?.length ?? 0,
    allowDeepAnalysis: raw.allowDeepAnalysis,
  });
  if (!cost.ok) return cost;
  if (cost.data.requiresConfirmation) return err(appError('validation', 'Deep analysis confirmation required for this input size.'));

  return ok({
    inputType: raw.inputType,
    fileName: raw.fileName ?? null,
    mimeType: raw.mimeType ?? null,
    extractedText,
    rows: raw.rows ?? [],
    imageDescriptions: [raw.imageDescription, ...(raw.frameDescriptions ?? [])].filter(Boolean) as string[],
    transcript: raw.transcript ?? null,
    sourceRefs: [raw.fileName, raw.mimeType].filter(Boolean) as string[],
    redactionChecked: true,
    cost: cost.data,
  });
}
