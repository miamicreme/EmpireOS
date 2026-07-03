export interface ProviderCapability {
  provider: string;
  configured: boolean;
  enabled: boolean;
  text: boolean;
  vision: boolean;
  longContext: boolean;
  jsonMode: boolean;
  cheap: boolean;
  deepReasoning: boolean;
}

export type ProviderTask = 'text' | 'vision' | 'long_context' | 'deep_reasoning';

export function getProviderCapabilities(env: NodeJS.ProcessEnv = process.env): ProviderCapability[] {
  return [
    {
      provider: 'openai',
      configured: Boolean(env.OPENAI_API_KEY),
      enabled: env.OPENAI_DISABLED !== 'true',
      text: true,
      vision: true,
      longContext: true,
      jsonMode: true,
      cheap: true,
      deepReasoning: true,
    },
    {
      provider: 'anthropic',
      configured: Boolean(env.ANTHROPIC_API_KEY),
      enabled: env.ANTHROPIC_DISABLED !== 'true',
      text: true,
      vision: true,
      longContext: true,
      jsonMode: false,
      cheap: false,
      deepReasoning: true,
    },
  ];
}

export function routeProviderForTask(task: ProviderTask, env: NodeJS.ProcessEnv = process.env) {
  const candidates = getProviderCapabilities(env).filter((p) => p.configured && p.enabled);
  const match = candidates.find((p) =>
    task === 'vision' ? p.vision :
    task === 'long_context' ? p.longContext :
    task === 'deep_reasoning' ? p.deepReasoning : p.text,
  );
  if (!match && task === 'vision') return { ok: false as const, code: 'vision_provider_required' };
  if (!match) return { ok: false as const, code: 'provider_required' };
  return { ok: true as const, provider: match.provider, capabilities: match };
}
