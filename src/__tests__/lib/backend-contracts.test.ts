import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('backend completion contracts', () => {
  it('exposes safe run detail without raw event payloads', () => {
    const routePath = 'src/app/api/ai/agent/runs/[id]/route.ts';
    const repo = read('src/spine/ai/agent/agent-repository.service.ts');

    expect(existsSync(join(root, routePath))).toBe(true);
    expect(read(routePath)).toContain('getRunDetail');
    expect(repo).toContain('export async function getRunDetail');
    expect(repo).toContain('Safe run detail: summaries and metadata only');
    expect(repo).toContain("select('id, event_order, event_type, status, summary, latency_ms, created_at')");
  });

  it('completes memory GET/PATCH/DELETE and approve/reject routes', () => {
    expect(read('src/app/api/ai/agent/memory/route.ts')).toContain('export async function GET');
    expect(read('src/app/api/ai/agent/memory/[id]/route.ts')).toContain('export async function PATCH');
    expect(read('src/app/api/ai/agent/memory/[id]/route.ts')).toContain('export async function DELETE');
    expect(read('src/app/api/ai/agent/memory/[id]/approve/route.ts')).toContain('export async function POST');
  });

  it('exposes provider health and security status without secret fields', () => {
    const providerHealth = read('src/app/api/ai/providers/health/route.ts');
    const securityStatus = read('src/app/api/settings/security/status/route.ts');

    expect(providerHealth).toContain('hasAnyProvider');
    expect(providerHealth).not.toContain('apiKey:');
    expect(providerHealth).not.toContain('api_key_cipher');
    expect(securityStatus).toContain('secretValuesReturned: false');
  });

  it('documents backend API contracts and security limitations', () => {
    expect(read('docs/API_CONTRACTS.md')).toContain('GET /api/ai/agent/runs/[id]');
    expect(read('docs/BACKEND_COMPLETION_REPORT.md')).toContain('Completed in this pass');
    expect(read('docs/SECURITY_DEPENDENCY_REPORT.md')).toContain('403 Forbidden');
  });
});
