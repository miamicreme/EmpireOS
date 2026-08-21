import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';

type CellValue = string | number | boolean | null;

export interface ParsedXlsxWorkbook {
  rows: Array<Record<string, CellValue>>;
  sheetName: string | null;
  rowCount: number;
  sourceRef: string;
}

interface ZipEntry {
  name: string;
  compression: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function stripTags(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, ''));
}

function attr(xml: string, name: string) {
  const match = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(xml);
  return match ? decodeXml(match[1] ?? '') : null;
}

function stripDataUrl(value: string) {
  const match = /^data:[^;,]+;base64,(.+)$/i.exec(value.trim());
  return (match?.[1] ?? value).replace(/\s/g, '');
}

function readZipEntries(bytes: Buffer): AppResult<Map<string, Buffer>> {
  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) return err(appError('validation', 'Invalid XLSX workbook.'));

  const entryCount = bytes.readUInt16LE(eocdOffset + 10);
  let centralOffset = bytes.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (bytes.readUInt32LE(centralOffset) !== 0x02014b50) {
      return err(appError('validation', 'Invalid XLSX workbook directory.'));
    }
    const compression = bytes.readUInt16LE(centralOffset + 10);
    const compressedSize = bytes.readUInt32LE(centralOffset + 20);
    const nameLength = bytes.readUInt16LE(centralOffset + 28);
    const extraLength = bytes.readUInt16LE(centralOffset + 30);
    const commentLength = bytes.readUInt16LE(centralOffset + 32);
    const localHeaderOffset = bytes.readUInt32LE(centralOffset + 42);
    const name = bytes.subarray(centralOffset + 46, centralOffset + 46 + nameLength).toString('utf8');
    entries.push({ name: name.replace(/\\/g, '/'), compression, compressedSize, localHeaderOffset });
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  const files = new Map<string, Buffer>();
  for (const entry of entries) {
    const local = entry.localHeaderOffset;
    if (bytes.readUInt32LE(local) !== 0x04034b50) return err(appError('validation', 'Invalid XLSX workbook entry.'));
    const nameLength = bytes.readUInt16LE(local + 26);
    const extraLength = bytes.readUInt16LE(local + 28);
    const dataOffset = local + 30 + nameLength + extraLength;
    const compressed = bytes.subarray(dataOffset, dataOffset + entry.compressedSize);
    if (entry.compression === 0) files.set(entry.name, compressed);
    else if (entry.compression === 8) files.set(entry.name, inflateRawSync(compressed));
    else return err(appError('validation', 'Unsupported XLSX compression.'));
  }
  return ok(files);
}

function parseSharedStrings(xml: string | undefined) {
  if (!xml) return [];
  return Array.from(xml.matchAll(/<si\b[\s\S]*?<\/si>/gi)).map(([si]) => {
    const textRuns = Array.from(si.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)).map(([, text]) => decodeXml(text ?? ''));
    return textRuns.length ? textRuns.join('') : stripTags(si);
  });
}

function relationshipTarget(files: Map<string, Buffer>) {
  const workbook = files.get('xl/workbook.xml')?.toString('utf8');
  const rels = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8');
  if (!workbook || !rels) return { path: 'xl/worksheets/sheet1.xml', sheetName: null };

  const firstSheet = /<sheet\b[^>]*>/i.exec(workbook)?.[0] ?? '';
  const sheetName = attr(firstSheet, 'name');
  const relId = attr(firstSheet, 'r:id');
  if (!relId) return { path: 'xl/worksheets/sheet1.xml', sheetName };

  const rel = Array.from(rels.matchAll(/<Relationship\b[^>]*>/gi))
    .map(([tag]) => tag)
    .find((tag) => attr(tag, 'Id') === relId);
  const target = rel ? attr(rel, 'Target') : null;
  if (!target) return { path: 'xl/worksheets/sheet1.xml', sheetName };
  const normalized = target.replace(/\\/g, '/').replace(/^\//, '');
  return { path: normalized.startsWith('xl/') ? normalized : `xl/${normalized}`, sheetName };
}

function columnIndex(cellRef: string | null, fallback: number) {
  if (!cellRef) return fallback;
  const letters = /^[A-Z]+/i.exec(cellRef)?.[0]?.toUpperCase();
  if (!letters) return fallback;
  return letters.split('').reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function parseCell(cellXml: string, sharedStrings: string[]): { index: number; value: CellValue } {
  const index = columnIndex(attr(cellXml, 'r'), 0);
  const type = attr(cellXml, 't');
  const rawValue = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(cellXml)?.[1];
  if (type === 'inlineStr') {
    const inline = /<is\b[^>]*>([\s\S]*?)<\/is>/i.exec(cellXml)?.[1] ?? '';
    return { index, value: stripTags(inline).trim() || null };
  }
  if (rawValue == null) return { index, value: null };
  const decoded = decodeXml(rawValue);
  if (type === 's') return { index, value: sharedStrings[Number(decoded)] ?? '' };
  if (type === 'b') return { index, value: decoded === '1' };
  if (type === 'str') return { index, value: decoded };
  const numeric = Number(decoded);
  return { index, value: Number.isFinite(numeric) ? numeric : decoded };
}

function parseWorksheetRows(xml: string, sharedStrings: string[], maxRows: number) {
  const rows: CellValue[][] = [];
  for (const [, rowXml] of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const cells: CellValue[] = [];
    let fallbackIndex = 0;
    for (const [cellXml] of (rowXml ?? '').matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/gi)) {
      const parsed = parseCell(cellXml, sharedStrings);
      const index = attr(cellXml, 'r') ? parsed.index : fallbackIndex;
      cells[index] = parsed.value;
      fallbackIndex = index + 1;
    }
    if (cells.some((value) => value !== null && value !== undefined && value !== '')) rows.push(cells);
    if (rows.length > maxRows) break;
  }
  return rows;
}

export function parseXlsxWorkbook(input: { xlsxBase64: string; fileName?: string | null; maxRows?: number }): AppResult<ParsedXlsxWorkbook> {
  const base64 = stripDataUrl(input.xlsxBase64);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return err(appError('validation', 'Invalid XLSX byte payload.'));

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) {
    return err(appError('validation', 'XLSX byte payload is empty or too large.'));
  }

  const files = readZipEntries(bytes);
  if (!files.ok) return files;

  const sharedStrings = parseSharedStrings(files.data.get('xl/sharedStrings.xml')?.toString('utf8'));
  const sheet = relationshipTarget(files.data);
  const sheetXml = files.data.get(sheet.path)?.toString('utf8') ?? files.data.get('xl/worksheets/sheet1.xml')?.toString('utf8');
  if (!sheetXml) return err(appError('validation', 'XLSX workbook has no readable worksheet.'));

  const rawRows = parseWorksheetRows(sheetXml, sharedStrings, (input.maxRows ?? 500) + 1);
  const headers = (rawRows[0] ?? []).map((value, index) => String(value ?? `column_${index + 1}`).trim() || `column_${index + 1}`);
  const rows = rawRows.slice(1, (input.maxRows ?? 500) + 1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])),
  );

  return ok({
    rows,
    sheetName: sheet.sheetName,
    rowCount: rows.length,
    sourceRef: `${input.fileName ?? 'workbook.xlsx'}:${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}`,
  });
}
