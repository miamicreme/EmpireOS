import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk } from '@/lib/api';
import { appError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CHARS = 50_000; // matches intakeInputSchema's content cap

/**
 * POST /api/ai/intake/extract (multipart form-data, field `file`)
 *
 * Extracts plain text from an uploaded document so it can be fed to the intake
 * classifier. PDFs go through unpdf (serverless-friendly, no native deps); text
 * files are read as UTF-8. Returns { text, title } — the client then reviews
 * and submits it to /api/ai/intake like any pasted document.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(appError('validation', 'Expected a multipart file upload.'));
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return jsonError(appError('validation', 'No file provided.'));
  }
  if (file.size === 0) {
    return jsonError(appError('validation', 'The file is empty.'));
  }
  if (file.size > MAX_BYTES) {
    return jsonError(appError('validation', 'File is too large (max 10 MB).'));
  }

  const name = file.name || 'document';
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(name);

  try {
    let text: string;
    if (isPdf) {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(data);
      const result = await extractText(pdf, { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join('\n') : result.text;
    } else {
      // text/*, .md, .csv, .json, etc. — read as UTF-8.
      text = await file.text();
    }

    text = text.trim();
    if (!text) {
      return jsonError(
        appError('validation', 'No readable text found (a scanned/image-only PDF needs OCR).'),
      );
    }
    if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);

    // Strip the extension for a friendly default title.
    const title = name.replace(/\.[^.]+$/, '');
    return jsonOk({ text, title });
  } catch (e) {
    return jsonError(appError('internal', `Could not read the file: ${(e as Error).message}`));
  }
}
