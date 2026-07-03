import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk, readJson } from '@/lib/api';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const uploadSchema = z.object({
  fileName: z.string().min(1).max(240),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.coerce.number().int().min(1).max(MAX_BYTES),
});

/**
 * POST /api/ai/input/upload
 *
 * Validates owner-only upload metadata before a client proceeds to extraction or
 * analysis. It intentionally returns no public URL and stores no secret-bearing
 * content in this lightweight contract endpoint.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const parsed = uploadSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError({ code: 'validation', message: 'Invalid upload metadata or file size.' });
  }
  if (!ALLOWED_MIME_TYPES.has(parsed.data.mimeType)) {
    return jsonError({ code: 'validation', message: 'Unsupported file type for universal input.' });
  }

  return jsonOk({
    uploadAccepted: true,
    fileId: `pending:${parsed.data.fileName}`,
    publicUrl: null,
    maxBytes: MAX_BYTES,
  }, 201);
}
