import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/security', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security')>('@/lib/security');
  return { ...actual, containsHighRiskSecret: (text: string) => /sk-test-secret|seed phrase/i.test(text) };
});

const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

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
