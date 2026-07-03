import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('V7.1 live proof and input polish contract', () => {
  it('adds repeatable live proof checklist and safe fixtures', () => {
    expect(read('docs/V7_LIVE_PROOF_CHECKLIST.md')).toContain('PDF analysis');
    for (const fixture of ['sample.txt', 'sample.md', 'sample.csv', 'sample.pdf.txt', 'sample.docx.txt', 'sample.xlsx.csv', 'sample-image.txt']) {
      expect(existsSync(join(root, 'src/__tests__/fixtures/universal-input', fixture))).toBe(true);
    }
  });

  it('/ai/input supports file state, detected kind, artifact, drafts, and send-to-agent flow', () => {
    const component = read('src/components/ai/UniversalInputWorkbench.tsx');
    expect(component).toContain('Current file status');
    expect(component).toContain('Detected input kind');
    expect(component).toContain('Created artifact');
    expect(component).toContain('Action drafts awaiting approval');
    expect(component).toContain('/api/ai/agent/run');
    expect(component).toContain('inputArtifactIds');
    expect(component).toContain('Go deeper');
    expect(component).toContain('Research needed');
  });

  it('/ai/camera has explicit privacy controls and does not auto-start', () => {
    const component = read('src/components/ai/CameraCaptureWorkbench.tsx');
    expect(component).toContain('getUserMedia');
    expect(component).toContain('Start camera');
    expect(component).toContain('Stop camera');
    expect(component).toContain('Delete captured frames');
    expect(component).toContain('Sample 10 seconds');
    expect(component).toContain('slice(0, 10)');
    expect(component).not.toContain('useEffect(() => startCamera');
  });

  it('/ai/runs/[id] displays input artifacts and safe fields without hidden chain-of-thought', () => {
    const page = read('src/app/ai/runs/[id]/page.tsx');
    const component = read('src/components/ai/RunDetailView.tsx');
    expect(page).toContain('without hidden chain-of-thought');
    for (const text of ['User request', 'Input artifacts used', 'Created artifact', 'Provider / model / cost / latency', 'Action drafts created', 'Feedback controls']) {
      expect(component).toContain(text);
    }
    expect(component).not.toContain('chainOfThought');
    expect(component).not.toContain('apiKey');
  });

  it('documents environment-blocked audit status exactly', () => {
    const report = read('docs/SECURITY_DEPENDENCY_REPORT.md');
    expect(report).toContain('403 Forbidden - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk');
    expect(report).toContain('do not mark dependency audit clean');
  });
});
