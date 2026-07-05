import { z } from 'zod';
import { createHash } from 'node:crypto';
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
  imageInputs: NormalizedImageInput[];
  transcript: string | null;
  sourceRefs: string[];
  redactionChecked: boolean;
  highRiskSecretsRedacted: boolean;
  cost: ReturnType<typeof evaluateInputCost> extends AppResult<infer T> ? T : never;
}

export interface NormalizedImageInput {
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
  format: 'png' | 'jpeg' | 'webp';
  byteLength: number;
  sha256: string;
  width: number | null;
  height: number | null;
  sourceName: string | null;
  dataBase64: string;
}

export const rawInputSchema = z.object({
  inputType: z.enum(supportedInputKinds),
  fileName: z.string().max(240).optional(),
  mimeType: z.string().max(120).optional(),
  contentText: z.string().max(100_000).optional(),
  rows: z.array(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(500).optional(),
  imageDescription: z.string().max(5000).optional(),
  imageBase64: z.string().max(14_000_000).optional(),
  frameDescriptions: z.array(z.string().max(2000)).max(10).optional(),
  frameImagesBase64: z.array(z.string().max(14_000_000)).max(10).optional(),
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

function stripDataUrl(value: string) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(value.trim());
  return { mediaType: match?.[1]?.toLowerCase(), base64: match?.[2] ?? value.trim() };
}

function imageFormat(bytes: Buffer): NormalizedImageInput['format'] | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes.subarray(1, 4).toString('ascii') === 'PNG') return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

function dimensions(bytes: Buffer, format: NormalizedImageInput['format']) {
  if (format === 'png' && bytes.length >= 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (format === 'jpeg') {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2) break;
      if (marker != null && marker >= 0xc0 && marker <= 0xc3) {
        return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  if (format === 'webp' && bytes.length >= 30 && bytes.subarray(12, 16).toString('ascii') === 'VP8X') {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3),
    };
  }
  return { width: null, height: null };
}

function decodeImageInput(rawBase64: string, sourceName: string | null, fallbackMimeType: string | null): AppResult<NormalizedImageInput> {
  const stripped = stripDataUrl(rawBase64);
  const base64 = stripped.base64.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    return err(appError('validation', 'Invalid image byte payload.'));
  }

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) {
    return err(appError('validation', 'Image byte payload is empty or too large.'));
  }

  const format = imageFormat(bytes);
  if (!format) return err(appError('validation', 'Unsupported image byte payload.'));

  const detectedMediaType = `image/${format === 'jpeg' ? 'jpeg' : format}` as NormalizedImageInput['mediaType'];
  const declaredMediaType = stripped.mediaType ?? fallbackMimeType ?? detectedMediaType;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(declaredMediaType)) {
    return err(appError('validation', 'Unsupported image MIME type.'));
  }

  const size = dimensions(bytes, format);
  return ok({
    mediaType: detectedMediaType,
    format,
    byteLength: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    width: size.width,
    height: size.height,
    sourceName,
    dataBase64: base64,
  });
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
  const imageInputs: NormalizedImageInput[] = [];
  if (raw.imageBase64) {
    const decoded = decodeImageInput(raw.imageBase64, raw.fileName ?? null, raw.mimeType ?? null);
    if (!decoded.ok) return decoded;
    imageInputs.push(decoded.data);
  }
  for (const [index, frameImage] of (raw.frameImagesBase64 ?? []).entries()) {
    const decoded = decodeImageInput(frameImage, raw.fileName ? `${raw.fileName}#frame-${index + 1}` : `frame-${index + 1}`, raw.mimeType ?? 'image/png');
    if (!decoded.ok) return decoded;
    imageInputs.push(decoded.data);
  }
  const transcript = raw.transcript ? redactSensitiveText(raw.transcript) : null;
  const rows = redactRows(raw.rows ?? []);

  const cost = evaluateInputCost({
    extractedChars: extractedText.length,
    frameCount: Math.max(raw.frameDescriptions?.length ?? 0, raw.frameImagesBase64?.length ?? 0),
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
    imageInputs,
    transcript,
    sourceRefs: [
      raw.fileName,
      raw.mimeType,
      ...imageInputs.map((image) => `${image.mediaType}:${image.sha256.slice(0, 16)}`),
    ].filter(Boolean) as string[],
    redactionChecked: true,
    highRiskSecretsRedacted: redactionsApplied,
    cost: cost.data,
  });
}
