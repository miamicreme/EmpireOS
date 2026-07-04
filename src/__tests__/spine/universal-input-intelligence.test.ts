import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/security', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security')>('@/lib/security');
  return { ...actual, containsHighRiskSecret: (text: string) => /sk-test-secret|seed phrase/i.test(text) };
});

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

  it('requires a vision provider for image/camera analysis', async () => {
    const { analyzeVision } = await import('@/spine/agent/input/vision-intelligence.service');
    const result = analyzeVision({ kind: 'camera_snapshot', descriptions: ['receipt on desk'], allowVision: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('allowVision');
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
});
