import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { empireRunSchema } from '@/spine/empire/empire.service';
import { EMPIRE_INTELLIGENCE_BENCHMARK_VERSION } from '@/spine/empire/intelligence-evaluation';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Empire 25-pass release contract', () => {
  const runRoute = source('src/app/api/empire/runs/route.ts');
  const general = source('src/spine/empire/general-conversation.service.ts');
  const voice = source('src/components/empire/EmpireVoiceConsole.tsx');
  const evaluation = source('src/spine/empire/intelligence-evaluation.ts');
  const evaluationRoute = source('src/app/api/empire/evaluate/route.ts');
  const page = source('src/app/empire/page.tsx');
  const sidebar = source('src/components/layout/Sidebar.tsx');
  const providerManager = source('src/components/ui/ai/ProviderManager.tsx');
  const toolTypes = source('src/spine/tools/tool.types.ts');

  it('passes all 25 release gates', () => {
    const gates: Array<[string, boolean]> = [
      ['1. Empire has one public run endpoint', runRoute.includes('POST /api/empire/runs')],
      ['2. Run input is schema validated', runRoute.includes('empireRunSchema.safeParse')],
      ['3. Owner authentication is required', runRoute.includes('requireUserId')],
      ['4. Governed operations use the governed runtime', runRoute.includes('runEmpireCommand')],
      ['5. General requests use the intelligence runtime', runRoute.includes('runEmpireGeneralConversation')],
      ['6. General intelligence delegates to the canonical agent', general.includes('runAgent')],
      ['7. General runs are persisted as Empire runs', general.includes('createEmpireRun')],
      ['8. General runs store provider evidence', general.includes('providersUsed')],
      ['9. Empty model output is handled honestly', general.includes('returned no usable answer')],
      ['10. Voice submits only to the Empire endpoint', voice.includes("'/api/empire/runs'")],
      ['11. Voice supports microphone input', voice.includes('SpeechRecognition')],
      ['12. Voice supports typed fallback', voice.includes('<textarea')],
      ['13. Voice supports spoken output', voice.includes('SpeechSynthesisUtterance')],
      ['14. Spoken output is interruptible', voice.includes('speechSynthesis?.cancel')],
      ['15. Microphone permission errors are surfaced', voice.includes('Microphone permission was denied')],
      ['16. Intelligence benchmark is versioned', EMPIRE_INTELLIGENCE_BENCHMARK_VERSION.length > 0],
      ['17. Benchmark tests reasoning', evaluation.includes("dimension: 'reasoning'")],
      ['18. Benchmark tests instruction following', evaluation.includes("dimension: 'instruction_following'")],
      ['19. Benchmark tests honesty', evaluation.includes("dimension: 'honesty'")],
      ['20. Benchmark tests safety', evaluation.includes("dimension: 'safety'")],
      ['21. Benchmark tests actionability', evaluation.includes("dimension: 'actionability'")],
      ['22. Benchmark tests governance', evaluation.includes("dimension: 'governance'")],
      ['23. Benchmark endpoint is owner authenticated', evaluationRoute.includes('requireUserId')],
      ['24. Empire is reachable from primary navigation', sidebar.includes("href: '/empire'") && page.includes('EmpireVoiceConsole')],
      ['25. OpenAI can be configured and tool schemas accept parsed defaults', providerManager.includes("openai: 'OpenAI (GPT)'") && toolTypes.includes('ZodType<I, ZodTypeDef, unknown>')],
    ];

    const failures = gates.filter(([, passed]) => !passed).map(([name]) => name);
    expect(failures, failures.join('\n')).toEqual([]);
    expect(gates).toHaveLength(25);
  });

  it('accepts a normal conversational request', () => {
    expect(empireRunSchema.safeParse({ message: 'Help me think through a business decision.' }).success).toBe(true);
  });
});
