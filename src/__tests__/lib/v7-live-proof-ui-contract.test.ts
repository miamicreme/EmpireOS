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

  it('/ai/input renders a real upload + paste workbench with agent handoff', () => {
    const source = read('src/components/ai/input/AiInputWorkbench.tsx') + read('src/components/ai/input/FileUploadPanel.tsx') + read('src/components/ai/input/InputArtifactResult.tsx') + read('src/components/ai/input/SendToAgentPanel.tsx');
    expect(source).toContain('Drop anything here');
    expect(source).toContain('Paste text');
    expect(source).toContain('Analyze input');
    expect(source).toContain('Send to Agent');
    expect(source).toContain('type="file"');
    expect(source).toContain('/api/ai/input/upload');
    expect(source).toContain('/api/ai/input/analyze');
    expect(source).toContain('/api/ai/agent/run');
    expect(source).toContain('inputArtifactIds');
    expect(source).toContain('No public file URLs');
  });

  it('/ai/camera renders an explicit permission flow and bounded sampling', () => {
    const source = read('src/components/ai/camera/CameraWorkbench.tsx') + read('src/components/ai/camera/CameraCapture.tsx') + read('src/components/ai/camera/FrameSampler.tsx');
    expect(source).toContain('Camera is off until you start it.');
    expect(source).toContain('Start Camera');
    expect(source).toContain('Stop camera');
    expect(source).toContain('Sample 10 seconds');
    expect(source).toContain('Delete Frames');
    expect(source).toContain('getUserMedia');
    expect(source).toContain('Sample 10 seconds');
    expect(source).toContain('Stop camera releases the browser camera tracks.');
    expect(source).toContain('No default streaming.');
    expect(source).not.toContain('useEffect(() => startCamera');
  });

  it('/ai/runs/[id] displays safe detail fields without hidden chain-of-thought', () => {
    const page = read('src/app/ai/runs/[id]/page.tsx');
    const component = read('src/components/ai/runs/RunDetailWorkbench.tsx');
    expect(page).toContain('without hidden chain-of-thought');
    for (const text of ['User request', 'Input artifacts used', 'Created artifact', 'Provider / model / cost / latency', 'Action drafts', 'Feedback controls']) {
      expect(component).toContain(text);
    }
    expect(component).toContain('/api/ai/agent/action-drafts/${id}/approve');
    expect(component).toContain("action: reject ? 'reject' : 'approve'");
    expect(component).toContain('Safe reasoning summary only');
    expect(component).not.toContain('chainOfThought');
    expect(component).not.toContain('apiKey');
  });

  it('/ai/providers, /ai/memory, and /settings/security expose owner-only surfaces without keys', () => {
    const providers = read('src/components/ai/providers/ProvidersWorkbench.tsx') + read('src/app/ai/providers/page.tsx');
    const memory = read('src/components/ai/memory/MemoryWorkbench.tsx') + read('src/app/ai/memory/page.tsx');
    const security = read('src/components/ai/security/SecurityStatusWorkbench.tsx') + read('src/app/settings/security/page.tsx');

    expect(providers).toContain('Configured providers');
    expect(providers).toContain('Key source');
    expect(providers).not.toContain('apiKey');

    expect(memory).toContain('Durable memory');
    expect(memory).toContain('Approve');
    expect(memory).toContain('Reject');
    expect(memory).toContain('Delete');
    expect(memory).toContain('Edit');

    expect(security).toContain('Owner-only posture');
    expect(security).toContain('secret-free');
    expect(security).not.toContain('apiKey');
  });

  it('documents environment-blocked audit status exactly', () => {
    const report = read('docs/SECURITY_DEPENDENCY_REPORT.md');
    expect(report).toContain('403 Forbidden - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk');
    expect(report).toContain('do not mark dependency audit clean');
  });
});
