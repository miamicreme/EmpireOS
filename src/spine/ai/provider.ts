/**
 * AI provider abstraction layer.
 *
 * Selects the best available provider at runtime:
 *   Requesty → Anthropic → OpenAI → Google → free OpenAI-compatible providers → stub
 *
 * All external calls go through `callAI`. Context is always redacted before
 * reaching this layer — callers are responsible for that gate.
 */
import { aiKeys, hasRequestyProvider, requestyConfig } from '@/lib/env';

export type AIProvider =
  | 'requesty'
  | 'anthropic'
  | 'openai'
  | 'google'
  // OpenAI-API-compatible providers with generous free tiers (see
  // OPENAI_COMPATIBLE below). Reached through the OpenAI SDK + a base URL.
  | 'groq'
  | 'cerebras'
  | 'openrouter'
  | 'mistral'
  | 'stub';

/**
 * OpenAI-API-compatible free-tier providers: base URL + a sensible free default
 * model. Any of these works via the OpenAI SDK by swapping the base URL, so
 * they share one implementation. The model can still be overridden per config.
 */
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

/** A resolved, ready-to-use credential — a provider + the key to call it with. */
export interface AICredential {
  provider: CallableProvider;
  apiKey: string;
  /** The user-selected model for this provider (honored for any provider). */
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
  /**
   * Explicit credential (a user-configured provider). When present it overrides
   * the env-based provider selection. Absent → fall back to env keys.
   */
  credential?: AICredential;
}

export interface AIResponse {
  text: string;
  provider: AIProvider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** Preferred provider from env keys (router first, paid direct keys second, then free tiers). */
export function activeProvider(): AIProvider {
  if (hasRequestyProvider()) return 'requesty';
  if (aiKeys.anthropic) return 'anthropic';
  if (aiKeys.openai) return 'openai';
  if (aiKeys.google) return 'google';
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
  if (aiKeys.groq) chain.push('groq');
  if (aiKeys.cerebras) chain.push('cerebras');
  if (aiKeys.openrouter) chain.push('openrouter');
  if (aiKeys.mistral) chain.push('mistral');
  return chain;
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

async function callAnthropic(
  messages: AIMessage[],
  opts: AICallOptions,
  apiKey: string,
): Promise<AIResponse> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const model = opts.model ?? 'claude-sonnet-4-6';
  const systemPrompt = opts.systemPrompt;

  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.3,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      })),
  });

  const firstContent = response.content[0];
  const text = firstContent?.type === 'text' ? firstContent.text : '';

  return {
    text,
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
  const msgs = opts.systemPrompt
    ? [{ role: 'system' as const, content: opts.systemPrompt }, ...messages]
    : messages;

  // o-series reasoning models (o1/o3/o4-…) reject `max_tokens` (require
  // `max_completion_tokens`) and only accept the default temperature, so omit
  // it. Chat-completions models use the classic params.
  const isOSeries = /^o\d/i.test(model);
  const maxTokens = opts.maxTokens ?? 1024;
  const tokenParam = isOSeries
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
  const tempParam = isOSeries ? {} : { temperature: opts.temperature ?? 0.3 };

  const response = await client.chat.completions.create({
    model,
    ...tokenParam,
    ...tempParam,
    messages: msgs.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  });

  const text = response.choices[0]?.message.content ?? '';

  return {
    text,
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
  if (!model) {
    throw new Error('Requesty is configured without a REQUESTY_*_MODEL value.');
  }

  const msgs = opts.systemPrompt
    ? [{ role: 'system' as const, content: opts.systemPrompt }, ...messages]
    : messages;

  const response = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.3,
    messages: msgs.map((message) => ({ role: message.role, content: message.content })),
  });

  const text = response.choices[0]?.message.content ?? '';

  return {
    text,
    provider: 'requesty',
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
  for (const message of messages) {
    parts.push(`${message.role.toUpperCase()}: ${message.content}`);
  }

  const result = await genModel.generateContent(parts.join('\n\n'));
  const text = result.response.text();

  return { text, provider: 'google', model };
}

/**
 * Call any OpenAI-API-compatible provider (Groq / Cerebras / OpenRouter /
 * Mistral) via the OpenAI SDK with a swapped base URL. These are the free-tier
 * fallbacks — each has independent rate limits, so failing over across them
 * multiplies free capacity.
 */
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
  const msgs = opts.systemPrompt
    ? [{ role: 'system' as const, content: opts.systemPrompt }, ...messages]
    : messages;

  const response = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.3,
    messages: msgs.map((message) => ({ role: message.role, content: message.content })),
  });

  const text = response.choices[0]?.message.content ?? '';

  return {
    text,
    provider,
    model,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

/** Deterministic stub — returns when no provider is configured. */
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
    case 'groq':
    case 'cerebras':
    case 'openrouter':
    case 'mistral':
      return callOpenAICompatible(provider, messages, opts, apiKey);
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Call the best available AI provider with a conversation.
 *
 * An explicit `opts.credential` (a user-configured provider) takes precedence;
 * otherwise the env keys pick the provider. Context MUST already be redacted
 * before reaching this function.
 */
export async function callAI(
  messages: AIMessage[],
  opts: AICallOptions = {},
): Promise<AIResponse> {
  const credential = opts.credential;
  if (credential) {
    return callProvider(credential.provider, messages, opts, credential.apiKey);
  }

  const chain = envProviderChain();
  if (chain.length === 0) return callStub(messages, opts);

  let lastError: unknown;
  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    if (!provider) continue;
    const apiKey = aiKeys[provider];
    if (!apiKey) continue;
    const providerOpts =
      i === 0 ? opts : { ...opts, model: modelForAdvisor(undefined, provider) };
    try {
      return await callProvider(provider, messages, providerOpts, apiKey);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All configured AI providers failed.');
}

/** Model name to use for a given advisor role and provider. */
export function modelForAdvisor(
  preferredModel: string | undefined,
  provider: AIProvider,
): string {
  if (preferredModel && provider === 'anthropic') return preferredModel;
  if (preferredModel && provider === 'requesty') return preferredModel;

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
    case 'groq':
    case 'cerebras':
    case 'openrouter':
    case 'mistral':
      return OPENAI_COMPATIBLE[provider].defaultModel;
    default:
      return 'stub';
  }
}
