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
  routePurpose?: 'router' | 'direct';
  models?: Array<{ purpose: 'default' | 'fast' | 'standard' | 'deep' | 'vision'; model: string; enabled: boolean }>;
}

export type ProviderTask = 'text' | 'vision' | 'long_context' | 'deep_reasoning';
type RequestyRoutePurpose = 'default' | 'fast' | 'standard' | 'deep' | 'vision';

export function getProviderCapabilities(env: NodeJS.ProcessEnv = process.env): ProviderCapability[] {
  return [
    {
      provider: 'requesty',
      configured: Boolean(
        env.REQUESTY_API_KEY &&
          (env.REQUESTY_BASE_URL || 'https://router.requesty.ai/v1') &&
          (env.REQUESTY_DEFAULT_MODEL ||
            env.REQUESTY_FAST_MODEL ||
            env.REQUESTY_STANDARD_MODEL ||
            env.REQUESTY_DEEP_MODEL ||
            env.REQUESTY_VISION_MODEL),
      ),
      enabled: env.REQUESTY_DISABLED !== 'true',
      text: true,
      vision: Boolean(env.REQUESTY_VISION_MODEL || env.REQUESTY_DEFAULT_MODEL),
      longContext: true,
      jsonMode: true,
      cheap: Boolean(env.REQUESTY_FAST_MODEL),
      deepReasoning: Boolean(env.REQUESTY_DEEP_MODEL || env.REQUESTY_DEFAULT_MODEL),
      routePurpose: 'router',
      models: ([
        { purpose: 'default', model: env.REQUESTY_DEFAULT_MODEL ?? '', enabled: Boolean(env.REQUESTY_DEFAULT_MODEL) },
        { purpose: 'fast', model: env.REQUESTY_FAST_MODEL ?? '', enabled: Boolean(env.REQUESTY_FAST_MODEL) },
        { purpose: 'standard', model: env.REQUESTY_STANDARD_MODEL ?? '', enabled: Boolean(env.REQUESTY_STANDARD_MODEL) },
        { purpose: 'deep', model: env.REQUESTY_DEEP_MODEL ?? '', enabled: Boolean(env.REQUESTY_DEEP_MODEL) },
        { purpose: 'vision', model: env.REQUESTY_VISION_MODEL ?? '', enabled: Boolean(env.REQUESTY_VISION_MODEL) },
      ] satisfies Array<{ purpose: RequestyRoutePurpose; model: string; enabled: boolean }>).filter((model) => model.enabled),
    },
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
      routePurpose: 'direct',
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
      routePurpose: 'direct',
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
