import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('Empire durable run lifecycle', () => {
  it('persists an owner-scoped safe run record without raw prompts', () => {
    const migration = read('supabase/migrations/0025_empire_runs.sql');
    expect(migration).toContain('create table if not exists public.empire_runs');
    expect(migration).toContain('request_summary text not null');
    expect(migration).not.toContain('raw_prompt');
    expect(migration).not.toContain('chain_of_thought');
    expect(migration).toContain('owner reads empire runs');
  });

  it('provides run detail and cancellation endpoints', () => {
    const detail = read('src/app/api/empire/runs/[id]/route.ts');
    const cancel = read('src/app/api/empire/runs/[id]/cancel/route.ts');
    expect(detail).toContain('getEmpireRun');
    expect(detail).toContain('requireUserId');
    expect(cancel).toContain('requestEmpireRunCancellation');
    expect(cancel).toContain('requireUserId');
  });

  it('moves authoritative requests through explicit lifecycle states', () => {
    const service = read('src/spine/empire/empire.service.ts');
    expect(service).toContain("status: 'understanding'");
    expect(service).toContain("status: 'planning'");
    expect(service).toContain("status: 'executing'");
    expect(service).toContain("status: 'verifying'");
    expect(service).toContain("status: 'completed'");
    expect(service).toContain('operation_receipt_ids');
  });
});
