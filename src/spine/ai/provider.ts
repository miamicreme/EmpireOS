/**
 * AI provider abstraction layer.
 *
 * Selects the best available provider at runtime:
 *   Requesty → Anthropic → OpenAI → Google → LM Studio → free OpenAI-compatible providers → stub
 *
 * All external calls go through `callAI`. Context is always redacted before
 * reaching this layer — callers are responsible for that gate.
 */
import { aiKeys, hasLMStudioProvider, hasRequestyProvider, lmStudioConfig, requestyConfig } from '@/lib/env';

export type AIProvider =
  | 'requesty'
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'lmstudio'
  | 'groq'
  | 'cerebras'
  | 'openrouter'
  | 'mistral'
  | 'stub';

export const OPENAI_COMPATIBLE: Record<
  'groq' | 'cerebras' | 'openrouter' | 'mistral',
  { baseURL: string; defaultModel: string }
> = {
  groq: { baseURL: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
  cerebras: { baseURL: 'https://api.cerebras.ai/v1', defaultModel: 'llama-3.3-70b' },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
  },
  mistral: { baseURL: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest' },
};

type OpenAICompatibleProvider = keyof typeof OPENAI_COMPATIBLE;
type CallableProvider = Exclude<AIProvider, 'stub'>;

export interface AICredential {
  provider: CallableProvider;
  apiKey: string;
  model?: string;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AICallOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  credential?: AICredential;
}

export interface AIResponse {
  text: string;
  provider: AIProvider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export function activeProvider(): AIProvider {
  if (hasRequestyProvider()) return 'requesty';
  if (aiKeys.anthropic) return 'anthropic';
  if (aiKeys.openai) return 'openai';
  if (aiKeys.google) return 'google';
  if (hasLMStudioProvider()) return 'lmstudio';
  if (aiKeys.groq) return 'groq';
  if (aiKeys.cerebras) return 'cerebras';
  if (aiKeys.openrouter) return 'openrouter';
  if (aiKeys.mistral) return 'mistral';
  return 'stub';
}

export function envProviderChain(): CallableProvider[] {
  const chain: CallableProvider[] = [];
  if (hasRequestyProvider()) chain.push('requesty');
  if (aiKeys.anthropic) chain.push('anthropic');
  if (aiKeys.openai) chain.push('openai');
  if (aiKeys.google) chain.push('google');
  if (hasLMStudioProvider()) chain.push('lmstudio');
  if (aiKeys.groq) chain.push('groq');
  if (aiKeys.cerebras) chain.push('cerebras');
  if (aiKeys.openrouter) chain.push('openrouter');
  if (aiKeys.mistral) chain.push('mistral');
  return chain;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const a = parts[0] ?? -1;
  const b = parts[1] ?? -1;

  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/**
 * LM Studio is a local/private fallback, not a generic external proxy. Restrict
 * the server-side base URL to localhost/private-network hosts to reduce SSRF and
 * accidental public egress risk.
 */
export function isAllowedLMStudioBaseURL(baseURL: string): boolean {
  try {
    const url = new URL(baseURL);
    const host = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (host === 'localhost' || host.endsWith('.local')) return true;
    if (host === '::1' || host === '[::1]') return true;
    return isPrivateIpv4(host);
  } catch {
    return false;
  }
}

async function callAnthropic(
  messages: AIMessage[],
  opts: AICallOptions,
  apiKey: string,
): Promise<AIResponse> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const model = opts.model ?? 'claude-sonnet-4-6';
  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.3,
    ...(opts.systemPrompt ? { system: opts.systemPrompt } : {}),
    messages: messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content })),
  });

  const firstContent = response.content[0];
  return {
    text: firstContent?.type === 'text' ? firstContent.text : '',
    provider: 'anthropic',
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function callOpenAI(
  messages: AIMessage[],
  opts: AICallOptions,
  apiKey: string,
): Promise<AIResponse> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });

  const model = opts.model ?? 'gpt-4o-mini';
  const msgs = opts.systemPrompt ? [{ role: 'system' as const, content: opts.systemPrompt }, ...messages] : messages;
  const isOSeries = /^o\d/i.test(model);
  const maxTokens = opts.maxTokens ?? 1024;
  const response = await client.chat.completions.create({
    model,
    ...(isOSeries ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
    ...(isOSeries ? {} : { temperature: opts.temperature ?? 0.3 }),
    messages: msgs.map((message) => ({ role: message.role, content: message.content })),
  });

  return {
    text: response.choices[0]?.message.content ?? '',
    provider: 'openai',
    model,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

async function callRequesty(
  messages: AIMessage[],
  opts: AICallOptions,
  apiKey: string,
): Promise<AIResponse> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey, baseURL: requestyConfig.baseURL });

  const model =
    opts.model ??
    requestyConfig.defaultModel ??
    requestyConfig.standardModel ??
    requestyConfig.fastModel ??
    requestyConfig.deepModel ??
    requestyConfig.visionModel;
  if (!model) throw new Error('Requesty is configured without a REQUESTY_*_MODEL value.');

  const msgs = opts.systemPrompt ? [{ role: 'system' as const, content: opts.systemPrompt }, ...messages] : messages;
  const response = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.3,
    messages: msgs.map((message) => ({ role: message.role, content: message.content })),
  });

  return {
    text: response.choices[0]?.message.content ?? '',
    provider: 'requesty',
    model,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

async function callLMStudio(
  messages: AIMessage[],
  opts: AICallOptions,
  apiKey: string,
): Promise<AIResponse> {
  if (!isAllowedLMStudioBaseURL(lmStudioConfig.baseURL)) {
    throw new Error('LMSTUDIO_BASE_URL must point to localhost or a private-network host.');
  }

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey, baseURL: lmStudioConfig.baseURL });

  const model = opts.model ?? lmStudioConfig.defaultModel;
  if (!model) throw new Error('LM Studio is enabled without LMSTUDIO_DEFAULT_MODEL.');

  const msgs = opts.systemPrompt ? [{ role: 'system' as const, content: opts.systemPrompt }, ...messages] : messages;
  const response = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.3,
    messages: msgs.map((message) => ({ role: message.role, content: message.content })),
  });

  return {
    text: response.choices[0]?.message.content ?? '',
    provider: 'lmstudio',
    model,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

async function callGoogle(
  messages: AIMessage[],
  opts: AICallOptions,
  apiKey: string,
): Promise<AIResponse> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(apiKey);
  const model = opts.model ?? 'gemini-1.5-flash';
  const genModel = client.getGenerativeModel({ model });

  const parts: string[] = [];
  if (opts.systemPrompt) parts.push(opts.systemPrompt);
  for (const message of messages) parts.push(`${message.role.toUpperCase()}: ${message.content}`);

  const result = await genModel.generateContent(parts.join('\n\n'));
  return { text: result.response.text(), provider: 'google', model };
}

async function callOpenAICompatible(
  provider: OpenAICompatibleProvider,
  messages: AIMessage[],
  opts: AICallOptions,
  apiKey: string,
): Promise<AIResponse> {
  const { default: OpenAI } = await import('openai');
  const cfg = OPENAI_COMPATIBLE[provider];
  const client = new OpenAI({ apiKey, baseURL: cfg.baseURL });

  const model = opts.model ?? cfg.defaultModel;
  const msgs = opts.systemPrompt ? [{ role: 'system' as const, content: opts.systemPrompt }, ...messages] : messages;
  const response = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.3,
    messages: msgs.map((message) => ({ role: message.role, content: message.content })),
  });

  return {
    text: response.choices[0]?.message.content ?? '',
    provider,
    model,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

function callStub(messages: AIMessage[], _opts: AICallOptions): AIResponse {
  const last = messages[messages.length - 1]?.content ?? '';
  return {
    text: `[STUB] No AI provider configured. Received prompt: "${last.slice(0, 120)}..."`,
    provider: 'stub',
    model: 'stub',
  };
}

async function callProvider(
  provider: CallableProvider,
  messages: AIMessage[],
  opts: AICallOptions,
  apiKey: string,
): Promise<AIResponse> {
  switch (provider) {
    case 'requesty':
      return callRequesty(messages, opts, apiKey);
    case 'anthropic':
      return callAnthropic(messages, opts, apiKey);
    case 'openai':
      return callOpenAI(messages, opts, apiKey);
    case 'google':
      return callGoogle(messages, opts, apiKey);
    case 'lmstudio':
      return callLMStudio(messages, opts, apiKey);
    case 'groq':
    case 'cerebras':
    case 'openrouter':
    case 'mistral':
      return callOpenAICompatible(provider, messages, opts, apiKey);
  }
}

export async function callAI(
  messages: AIMessage[],
  opts: AICallOptions = {},
): Promise<AIResponse> {
  const credential = opts.credential;
  if (credential) return callProvider(credential.provider, messages, opts, credential.apiKey);

  const chain = envProviderChain();
  if (chain.length === 0) return callStub(messages, opts);

  let lastError: unknown;
  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    if (!provider) continue;
    const apiKey = aiKeys[provider];
    if (!apiKey) continue;
    const providerOpts = i === 0 ? opts : { ...opts, model: modelForAdvisor(undefined, provider) };
    try {
      return await callProvider(provider, messages, providerOpts, apiKey);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All configured AI providers failed.');
}

export function modelForAdvisor(preferredModel: string | undefined, provider: AIProvider): string {
  if (preferredModel && provider === 'anthropic') return preferredModel;
  if (preferredModel && provider === 'requesty') return preferredModel;
  if (preferredModel && provider === 'lmstudio') return preferredModel;

  switch (provider) {
    case 'anthropic':
      return 'claude-sonnet-4-6';
    case 'requesty':
      return (
        requestyConfig.defaultModel ??
        requestyConfig.standardModel ??
        requestyConfig.fastModel ??
        requestyConfig.deepModel ??
        requestyConfig.visionModel ??
        'requesty-unconfigured'
      );
    case 'openai':
      return 'gpt-4o-mini';
    case 'google':
      return 'gemini-2.5-flash';
    case 'lmstudio':
      return lmStudioConfig.defaultModel ?? 'lmstudio-unconfigured';
    case 'groq':
    case 'cerebras':
    case 'openrouter':
    case 'mistral':
      return OPENAI_COMPATIBLE[provider].defaultModel;
    default:
      return 'stub';
  }
}
