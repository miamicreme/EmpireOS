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
    expect(read('src/spine/ai/agent/agent.schemas.ts')).toContain('imageBase64');
    expect(read('src/spine/ai/agent/agent.schemas.ts')).toContain('frameImagesBase64');
  });

  it('keeps camera and video analysis explicit and bounded', () => {
    const service = read('src/spine/ai/agent/universal-input.service.ts');
    expect(service).toContain('MAX_VIDEO_FRAMES = 10');
    expect(service).toContain('cameraActivatedServerSide: false');
    expect(service).toContain('videoStreamStored: false');
    expect(service).toContain('imageByteMetadata');
  });

  it('adds owner-facing universal input and camera pages with privacy controls', () => {
    const inputWorkbench = read('src/components/ai/input/AiInputWorkbench.tsx') + read('src/components/ai/input/FileUploadPanel.tsx') + read('src/components/ai/input/InputArtifactResult.tsx') + read('src/components/ai/input/SendToAgentPanel.tsx');
    expect(inputWorkbench).toContain('Drop anything here');
    expect(inputWorkbench).toContain('Paste text');
    expect(inputWorkbench).toContain('Send to Agent');
    expect(inputWorkbench).toContain('No public file URLs');

    const cameraWorkbench = read('src/components/ai/camera/CameraWorkbench.tsx') + read('src/components/ai/camera/CameraCapture.tsx') + read('src/components/ai/camera/FrameSampler.tsx');
    expect(cameraWorkbench).toContain('Camera is off until you start it.');
    expect(cameraWorkbench).toContain('Stop camera');
    expect(cameraWorkbench).toContain('Sample 10 seconds');
    expect(cameraWorkbench).toContain('Delete Frames');
    expect(cameraWorkbench).toContain('getUserMedia');
  });
});
