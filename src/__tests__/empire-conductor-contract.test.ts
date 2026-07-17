import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Empire Conductor contracts', () => {
  it('uses an AI conductor to decide direct versus delegated work', () => {
    const source = read('src/spine/empire/conductor-agent.service.ts');
    expect(source).toContain("feature: 'empire:conductor'");
    expect(source).toContain("responseMode: z.enum(['direct', 'delegated'])");
    expect(source).toContain('delegatedTasks');
    expect(source).toContain('availableAgents');
  });

  it('keeps Empire as the sole user-facing orchestrator', () => {
    const source = read('src/spine/empire/conductor-agent.service.ts');
    expect(source).toContain('Empire is the sole user-facing orchestrator');
    expect(source).toContain('Never bypass approvals, tools, receipts, or owner controls');
  });

  it('passes conductor decisions into the canonical agent runtime', () => {
    const source = read('src/spine/empire/general-conversation.service.ts');
    expect(source).toContain('decideEmpireDelegation');
    expect(source).toContain("modeHint: decision.responseMode === 'delegated' ? 'empire_orchestrated'");
    expect(source).toContain('runtimePreference: decision.runtimePreference');
    expect(source).toContain('goDeeper: decision.goDeeper || decision.responseMode === \'delegated\'');
  });

  it('returns specialist activity without exposing hidden reasoning', () => {
    const source = read('src/spine/empire/general-conversation.service.ts');
    expect(source).toContain('specialistAgents');
    expect(source).toContain('conductorDecision');
    expect(source).not.toContain('chainOfThought');
  });

  it('maintains a conversation thread across turns', () => {
    const service = read('src/spine/empire/general-conversation.service.ts');
    const ui = read('src/components/empire/EmpireVoiceConsole.tsx');
    expect(service).toContain('threadId: input.conversationId ?? undefined');
    expect(ui).toContain('conversationIdRef');
    expect(ui).toContain('conversationId: conversationIdRef.current || undefined');
  });

  it('supports hands-free continuous conversation', () => {
    const source = read('src/components/empire/EmpireVoiceConsole.tsx');
    expect(source).toContain('Continuous conversation');
    expect(source).toContain('continuousRef.current');
    expect(source).toContain('window.setTimeout(startListening');
    expect(source).toContain('Stop speaking');
  });
});
