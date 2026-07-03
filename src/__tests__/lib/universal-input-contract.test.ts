import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('universal input and camera contract', () => {
  it('adds owner-only universal input API routes without public URLs', () => {
    expect(existsSync(join(root, 'src/app/api/ai/input/upload/route.ts'))).toBe(true);
    expect(existsSync(join(root, 'src/app/api/ai/input/analyze/route.ts'))).toBe(true);
    expect(existsSync(join(root, 'src/app/api/ai/input/camera-frame/route.ts'))).toBe(true);
    expect(existsSync(join(root, 'src/app/api/ai/input/video-frames/analyze/route.ts'))).toBe(true);
    expect(read('src/app/api/ai/input/upload/route.ts')).toContain('publicUrl: null');
  });

  it('keeps camera and video analysis explicit and bounded', () => {
    const service = read('src/spine/ai/agent/universal-input.service.ts');
    expect(read('src/spine/agent/cost/cost-governor.service.ts')).toContain('maxVideoFrames: 10');
    expect(service).toContain('cameraActivatedServerSide: false');
    expect(service).toContain('videoStreamStored: false');
  });

  it('adds owner-facing universal input and camera pages with privacy controls', () => {
    expect(read('src/app/ai/input/page.tsx')).toContain('Drop anything here');
    const cameraPage = read('src/app/ai/camera/page.tsx');
    expect(cameraPage).toContain('does not silently activate your camera');
    expect(cameraPage).toContain('Stop camera');
    expect(cameraPage).toContain('Sample 10 seconds');
  });
});

describe('universal input V7 intelligence contract', () => {
  it('adds parser adapters, provider routing, and cost governor services', () => {
    expect(existsSync(join(root, 'src/spine/agent/input/file-ingestion.service.ts'))).toBe(true);
    expect(existsSync(join(root, 'src/spine/agent/input/document-intelligence.service.ts'))).toBe(true);
    expect(existsSync(join(root, 'src/spine/agent/input/spreadsheet-intelligence.service.ts'))).toBe(true);
    expect(existsSync(join(root, 'src/spine/agent/input/vision-intelligence.service.ts'))).toBe(true);
    expect(existsSync(join(root, 'src/spine/agent/cost/cost-governor.service.ts'))).toBe(true);
    expect(existsSync(join(root, 'src/spine/ai/provider-capabilities.ts'))).toBe(true);
  });

  it('documents real artifact payload fields and action draft creation', () => {
    const service = read('src/spine/ai/agent/universal-input.service.ts');
    for (const field of ['keyFacts', 'risks', 'opportunities', 'recommendedActions', 'sourceReferences', 'agent/run']) {
      expect(service).toContain(field);
    }
    expect(service).toContain('createActionDrafts');
    expect(service).toContain('research_needed');
  });

  it('integrates inputArtifactIds into the agent run context safely', () => {
    const orchestrator = read('src/spine/ai/agent/agent-orchestrator.service.ts');
    expect(orchestrator).toContain('getArtifactsByIds');
    expect(orchestrator).toContain('attachedInputArtifacts');
    expect(orchestrator).toContain('inputArtifactSummaries');
    expect(orchestrator).not.toContain('chainOfThought');
  });
});
