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
    expect(service).toContain('MAX_VIDEO_FRAMES = 10');
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
