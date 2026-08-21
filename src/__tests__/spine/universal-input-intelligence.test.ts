import { describe, expect, it, vi } from 'vitest';
import { deflateRawSync } from 'node:zlib';

vi.mock('@/lib/security', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security')>('@/lib/security');
  return { ...actual, containsHighRiskSecret: (text: string) => /sk-test-secret|seed phrase/i.test(text) };
});

const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function zipFixture(files: Record<string, string>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const raw = Buffer.from(content);
    const compressed = deflateRawSync(raw);
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(local, 30);
    locals.push(local, compressed);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centrals.push(central);
    offset += local.length + compressed.length;
  }

  const centralOffset = offset;
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length, 8);
  end.writeUInt16LE(centrals.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...locals, ...centrals, end]).toString('base64');
}

function xlsxFixtureBase64() {
  return zipFixture({
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types" />',
    'xl/workbook.xml': '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Transactions" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>date</t></si><si><t>amount</t></si><si><t>merchant</t></si><si><t>Fuel</t></si><si><t>Food</t></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="str"><v>2026-01-01</v></c><c r="B2"><v>120</v></c><c r="C2" t="s"><v>3</v></c></row><row r="3"><c r="A3" t="str"><v>2026-01-02</v></c><c r="B3"><v>50</v></c><c r="C3" t="s"><v>4</v></c></row></sheetData></worksheet>',
  });
}

describe('universal input intelligence services', () => {
  it('infers spreadsheet purpose and summarizes rows locally', async () => {
    const { analyzeSpreadsheet } = await import('@/spine/agent/input/spreadsheet-intelligence.service');
    const out = analyzeSpreadsheet([
      { date: '2026-01-01', amount: 120, merchant: 'Fuel' },
      { date: '2026-01-02', amount: 50, merchant: 'Food' },
      { date: '2026-01-02', amount: 50, merchant: 'Food' },
    ], 'transactions.csv');
    expect(out.purpose).toBe('transactions');
    expect(out.rowCount).toBe(3);
    expect(out.totals.amount).toBe(220);
    expect(out.duplicates).toBe(1);
    expect(out.suggestedDrafts.length).toBeGreaterThan(0);
  });

  it('redacts high-risk secrets before analysis', async () => {
    const { normalizeRawInput } = await import('@/spine/agent/input/file-ingestion.service');
    const result = normalizeRawInput({
      inputType: 'txt',
      contentText: 'Credit report account 1234 5678 9012 3456 and email me@example.com',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.extractedText).toContain('[REDACTED]');
      expect(result.data.extractedText).not.toContain('1234 5678 9012 3456');
      expect(result.data.extractedText).not.toContain('me@example.com');
      expect(result.data.highRiskSecretsRedacted).toBe(true);
    }
  });

  it('parses real XLSX workbook bytes into spreadsheet rows', async () => {
    const { normalizeRawInput } = await import('@/spine/agent/input/file-ingestion.service');
    const { analyzeSpreadsheet } = await import('@/spine/agent/input/spreadsheet-intelligence.service');
    const normalized = normalizeRawInput({
      inputType: 'xlsx',
      fileName: 'transactions.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xlsxBase64: xlsxFixtureBase64(),
    });

    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.data.rows).toEqual([
      { date: '2026-01-01', amount: 120, merchant: 'Fuel' },
      { date: '2026-01-02', amount: 50, merchant: 'Food' },
    ]);
    expect(normalized.data.sourceRefs).toContain('sheet:Transactions');

    const out = analyzeSpreadsheet(normalized.data.rows, normalized.data.fileName);
    expect(out.summary).toContain('2 rows, 3 columns');
    expect(out.totals.amount).toBe(170);
    expect(out.purpose).toBe('transactions');
  });

  it('decodes real image bytes before vision analysis', async () => {
    const { normalizeRawInput } = await import('@/spine/agent/input/file-ingestion.service');
    const result = normalizeRawInput({
      inputType: 'image',
      fileName: 'tiny.png',
      mimeType: 'image/png',
      imageBase64: tinyPngBase64,
      imageDescription: 'Tiny test image',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.imageInputs).toHaveLength(1);
      expect(result.data.imageInputs[0]?.format).toBe('png');
      expect(result.data.imageInputs[0]?.width).toBe(1);
      expect(result.data.imageInputs[0]?.height).toBe(1);
      expect(result.data.imageInputs[0]?.byteLength).toBeGreaterThan(0);
      expect(result.data.sourceRefs.some((ref) => ref.startsWith('image/png:'))).toBe(true);
    }
  });

  it('requires image bytes for image/camera vision analysis', async () => {
    const { analyzeVision } = await import('@/spine/agent/input/vision-intelligence.service');
    const result = await analyzeVision({
      kind: 'camera_snapshot',
      descriptions: ['receipt on desk'],
      images: [],
      allowVision: true,
      env: { OPENAI_API_KEY: 'configured' } as unknown as NodeJS.ProcessEnv,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('image_bytes_required');
  });

  it('preserves the vision_provider_required gate for real image bytes', async () => {
    const { normalizeRawInput } = await import('@/spine/agent/input/file-ingestion.service');
    const { analyzeVision } = await import('@/spine/agent/input/vision-intelligence.service');
    const normalized = normalizeRawInput({
      inputType: 'camera_snapshot',
      fileName: 'camera.png',
      mimeType: 'image/png',
      imageBase64: tinyPngBase64,
      imageDescription: 'receipt on desk',
    });
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;

    const result = await analyzeVision({
      kind: 'camera_snapshot',
      descriptions: normalized.data.imageDescriptions,
      images: normalized.data.imageInputs,
      allowVision: true,
      env: {} as NodeJS.ProcessEnv,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('vision_provider_required');
  });

  it('creates vision facts from real image bytes when a vision provider is configured', async () => {
    const { normalizeRawInput } = await import('@/spine/agent/input/file-ingestion.service');
    const { analyzeVision } = await import('@/spine/agent/input/vision-intelligence.service');
    const normalized = normalizeRawInput({
      inputType: 'screenshot',
      fileName: 'screen.png',
      mimeType: 'image/png',
      imageBase64: tinyPngBase64,
      imageDescription: 'error dialog screenshot',
    });
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;

    const result = await analyzeVision({
      kind: 'screenshot',
      descriptions: normalized.data.imageDescriptions,
      images: normalized.data.imageInputs,
      allowVision: true,
      env: { OPENAI_API_KEY: 'configured' } as unknown as NodeJS.ProcessEnv,
      providerExecutor: async ({ imageFacts }) => ({
        summary: 'Provider analyzed a real screenshot byte payload.',
        keyFacts: ['The screenshot contains an error dialog.', ...imageFacts],
        risks: [],
        opportunities: ['Use the screenshot as debugging context.'],
        recommendedActions: ['Create troubleshoot/fix/research draft for the screenshot issue.'],
        confidence: 0.82,
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.artifactType).toBe('vision_analysis');
      expect(result.data.keyFacts.join('\n')).toContain('PNG 1x1');
      expect(result.data.provider).toBe('openai');
    }
  });

  it('enforces video frame cost guard', async () => {
    const { evaluateInputCost } = await import('@/spine/agent/cost/cost-governor.service');
    const result = evaluateInputCost({ frameCount: 11 });
    expect(result.ok).toBe(false);
  });

  it('routes vision when provider capability exists', async () => {
    const { routeProviderForTask } = await import('@/spine/ai/provider-capabilities');
    const result = routeProviderForTask('vision', { OPENAI_API_KEY: 'configured' } as unknown as NodeJS.ProcessEnv);
    expect(result.ok).toBe(true);
  });

  it('routes vision through requesty when the router has a vision model', async () => {
    const { routeProviderForTask } = await import('@/spine/ai/provider-capabilities');
    const result = routeProviderForTask('vision', {
      REQUESTY_API_KEY: 'rq-test',
      REQUESTY_BASE_URL: 'https://router.requesty.ai/v1',
      REQUESTY_VISION_MODEL: 'openai/gpt-vision',
      OPENAI_API_KEY: 'configured-backup',
    } as unknown as NodeJS.ProcessEnv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('requesty');
      expect(result.capabilities.models?.some((model) => model.purpose === 'vision')).toBe(true);
    }
  });
});
