import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('universal input contract', () => {
  it('adds an analyze route without creating another command path', () => {
    expect(existsSync(join(root, 'src/app/api/ai/agent/input/analyze/route.ts'))).toBe(true);
    expect(read('src/app/api/ai/agent/run/route.ts')).toContain('POST /api/ai/agent/run');
    expect(read('src/spine/ai/agent/agent.schemas.ts')).toContain('inputArtifactIds');
  });

  it('stores input analysis in existing agent artifacts with camera/video guardrails', () => {
    const service = read('src/spine/ai/agent/universal-input.service.ts');

    expect(service).toContain('saveArtifact');
    expect(service).toContain('cameraActivatedServerSide: false');
    expect(service).toContain('videoStreamStored: false');
    expect(service).toContain('MAX_VIDEO_FRAMES = 10');
    expect(service).toContain('containsHighRiskSecret');
  });
});
