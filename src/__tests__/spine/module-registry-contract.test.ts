import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const registryPath = path.join(ROOT, 'src/spine/module-registry.ts');
const modulesReadmePath = path.join(ROOT, 'src/modules/README.md');
const guardrailsPath = path.join(ROOT, 'docs/SPINE_MODULE_GUARDRAILS.md');

describe('Spine module registry contract', () => {
  const registry = fs.readFileSync(registryPath, 'utf8');
  const modulesReadme = fs.readFileSync(modulesReadmePath, 'utf8');
  const guardrails = fs.readFileSync(guardrailsPath, 'utf8');

  it('keeps Empire Recorder registered through the Spine registry', () => {
    expect(registry).toContain("import { recorderModule } from '@/modules/recorder/service'");
    expect(registry).toContain('recorderModule');
    expect(modulesReadme).toContain('| Empire Recorder | `recorder` | phase_1 |');
  });

  it('documents the Spine-first module boundary', () => {
    expect(guardrails).toContain('The Spine owns priority.');
    expect(guardrails).toContain('Modules own detail.');
    expect(guardrails).toContain('A module must expose itself through `ModuleContract`');
  });

  it('uses safe fanout so one module cannot take down aggregate Spine reads', () => {
    expect(registry).toContain('Promise.allSettled');
    expect(registry).toContain('module_registry_fanout_failed');
    expect(registry).toContain('getAllModuleMetrics');
    expect(registry).toContain('getAllModuleActions');
    expect(registry).toContain('getAllDecisionContexts');
    expect(registry).toContain('getModuleHealthSummary');
  });
});
