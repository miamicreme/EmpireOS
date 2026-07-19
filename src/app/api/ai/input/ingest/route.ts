import { createHash, randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk } from '@/lib/api';
import { appError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_CHARS = 100_000;
const BUCKET = 'empire-documents';

function safeName(name: string) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 180) || 'document';
}

function kindFor(file: File) {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.xlsx')) return 'xlsx';
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.md')) return 'md';
  if (name.endsWith('.txt')) return 'txt';
  if (file.type.startsWith('image/')) return 'image';
  return 'binary';
}

async function extract(file: File, kind: string, bytes: Uint8Array) {
  if (kind === 'pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    const text = (Array.isArray(result.text) ? result.text.join('\n') : result.text).trim();
    return {
      text: text.slice(0, MAX_CHARS),
      method: 'unpdf',
      status: text ? 'completed' : 'needs_ocr',
      structured: {},
    };
  }
  if (['txt', 'md', 'csv'].includes(kind)) {
    const text = (await file.text()).trim().slice(0, MAX_CHARS);
    return {
      text,
      method: kind === 'csv' ? 'utf8_csv' : 'utf8_text',
      status: text ? 'completed' : 'failed',
      structured: kind === 'csv' ? { rowCount: Math.max(0, text.split(/\r?\n/).filter(Boolean).length - 1) } : {},
    };
  }
  return {
    text: '',
    method: 'stored_for_worker',
    status: ['docx', 'xlsx', 'image'].includes(kind) ? 'unsupported' : 'unsupported',
    structured: { queuedForSpecializedExtraction: true },
  };
}

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(appError('validation', 'Expected multipart form-data.'));
  }

  const file = form.get('file');
  if (!(file instanceof File)) return jsonError(appError('validation', 'No file provided.'));
  if (!file.size) return jsonError(appError('validation', 'The file is empty.'));
  if (file.size > MAX_BYTES) return jsonError(appError('validation', 'File is too large (max 20 MB).'));

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const kind = kindFor(file);

  const { data: existing } = await supabase
    .from('empire_documents')
    .select('id,original_filename,status,storage_path')
    .eq('user_id', auth.data)
    .eq('sha256', sha256)
    .maybeSingle();

  if (existing) {
    const { data: extraction } = await supabase
      .from('empire_document_extractions')
      .select('text_content,status,extraction_method,word_count')
      .eq('document_id', existing.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return jsonOk({
      documentId: existing.id,
      duplicate: true,
      status: existing.status,
      fileName: existing.original_filename,
      extractedText: extraction?.text_content ?? '',
      extractionStatus: extraction?.status ?? 'unknown',
      extractionMethod: extraction?.extraction_method ?? null,
      wordCount: extraction?.word_count ?? 0,
    });
  }

  const documentId = randomUUID();
  const storagePath = `${auth.data}/${documentId}/${safeName(file.name)}`;
  const upload = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upload.error) return jsonError(appError('db_error', 'Could not save the private document.'));

  const inserted = await supabase
    .from('empire_documents')
    .insert({
      id: documentId,
      user_id: auth.data,
      original_filename: file.name || 'document',
      storage_bucket: BUCKET,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size: file.size,
      sha256,
      document_kind: kind,
      status: 'extracting',
    })
    .select('id')
    .single();

  if (inserted.error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return jsonError(appError('db_error', 'Could not create the document record.'));
  }

  try {
    const extraction = await extract(file, kind, bytes);
    const wordCount = extraction.text ? extraction.text.split(/\s+/).filter(Boolean).length : 0;
    const extractionInsert = await supabase.from('empire_document_extractions').insert({
      document_id: documentId,
      user_id: auth.data,
      extraction_method: extraction.method,
      text_content: extraction.text || null,
      structured_content: extraction.structured,
      word_count: wordCount,
      status: extraction.status,
      error_message: extraction.status === 'unsupported' ? 'A specialized extractor is required for this file type.' : null,
    });
    if (extractionInsert.error) throw new Error('Could not save extraction.');

    const nextStatus = extraction.status === 'completed' ? 'extracted' : extraction.status === 'needs_ocr' ? 'uploaded' : 'uploaded';
    await supabase.from('empire_documents').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', documentId).eq('user_id', auth.data);

    return jsonOk({
      documentId,
      duplicate: false,
      status: nextStatus,
      fileName: file.name,
      kind,
      sha256,
      extractedText: extraction.text,
      extractionStatus: extraction.status,
      extractionMethod: extraction.method,
      wordCount,
      private: true,
    });
  } catch (error) {
    await supabase.from('empire_documents').update({ status: 'failed', error_message: (error as Error).message.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', documentId).eq('user_id', auth.data);
    return jsonError(appError('internal', 'The document was saved, but extraction failed. Retry extraction from the document record.'));
  }
}
