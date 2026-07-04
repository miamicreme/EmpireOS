import { z } from 'zod';
import { containsHighRiskSecret } from '@/lib/security';
import { redactSensitiveText } from '@/spine/decisions/context-redaction.service';
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
  highRiskSecretsRedacted: boolean;
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

function redactRows(rows: NonNullable<z.infer<typeof rawInputSchema>['rows']>) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === 'string' ? redactSensitiveText(value) : value,
      ]),
    ),
  );
}

export function normalizeRawInput(raw: z.infer<typeof rawInputSchema>): AppResult<NormalizedInput> {
  const rawText = [raw.contentText, raw.transcript, raw.imageDescription, ...(raw.frameDescriptions ?? [])]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 80_000);
  const highRiskSecretsRedacted = containsHighRiskSecret(rawText);
  const extractedText = redactSensitiveText(rawText);
  const redactionsApplied = highRiskSecretsRedacted || extractedText !== rawText;
  const imageDescriptions = [
    raw.imageDescription ? redactSensitiveText(raw.imageDescription) : null,
    ...(raw.frameDescriptions ?? []).map((description) => redactSensitiveText(description)),
  ].filter(Boolean) as string[];
  const transcript = raw.transcript ? redactSensitiveText(raw.transcript) : null;
  const rows = redactRows(raw.rows ?? []);

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
    rows,
    imageDescriptions,
    transcript,
    sourceRefs: [raw.fileName, raw.mimeType].filter(Boolean) as string[],
    redactionChecked: true,
    highRiskSecretsRedacted: redactionsApplied,
    cost: cost.data,
  });
}
