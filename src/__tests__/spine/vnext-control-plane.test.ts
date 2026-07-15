import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { hashOperationInput } from '@/spine/tools/tool-hash';
import { getTool, listTools } from '@/spine/tools/tool-registry';

const ROOT = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('VNext control plane', () => {
  it('creates stable hashes independent of object key order', () => {
    expect(hashOperationInput({ b: 2, a: 1 })).toBe(hashOperationInput({ a: 1, b: 2 }));
  });

  it('registers the first Recorder and Spine tools', () => {
    expect(getTool('recorder.transcribe')).toBeDefined();
    expect(getTool('spine.get_daily_context')).toBeDefined();
    expect(listTools().map((tool) => tool.id)).toContain('spine.get_daily_context');
  });

  it('persists exact-operation approvals and safe receipts', () => {
    const migration = read('supabase/migrations/0024_vnext_control_plane.sql');
    expect(migration).toContain('tool_approval_requests');
    expect(migration).toContain('input_hash');
    expect(migration).toContain("status in ('pending','approved','rejected','expired','used')");
    expect(migration).toContain('tool_run_receipts');
    expect(migration).toContain('output_hash');
  });

  it('routes Jarvis through the governed Tool Gateway', () => {
    const route = read('src/app/api/jarvis/runs/route.ts');
    const service = read('src/spine/jarvis/jarvis.service.ts');
    expect(route).toContain('runJarvisCommand');
    expect(service).toContain('executeTool');
    expect(service).toContain('spine.get_daily_context');
    expect(service).toContain('recorder.transcribe');
  });

  it('binds approval consumption to tool version and exact input hash', () => {
    const approval = read('src/spine/tools/approval.service.ts');
    expect(approval).toContain(".eq('tool_version', tool.version)");
    expect(approval).toContain(".eq('input_hash', inputHash)");
    expect(approval).toContain(".eq('status', 'approved')");
  });
});
