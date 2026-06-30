/**
 * AI provider abstraction layer.
 *
 * Selects the best available provider at runtime:
 *   Anthropic → OpenAI → Google → stub (no key)
 *
 * All external calls go through `callAI`. Context is always redacted before
 * reaching this layer — callers are responsible for that gate.
 */
import { aiKeys } from '@/lib/env';

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'stub';

/** A resolved, ready-to-use credential — a provider + the key to call it with. */
export interface AICredential {
  provider: Exclude<AIProvider, 'stub'>;
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

/** Preferred provider, checked at module load time. */
export function activeProvider(): AIProvider {
  if (aiKeys.anthropic) return 'anthropic';
  if (aiKeys.openai) return 'openai';
  if (aiKeys.google) return 'google';
  return 'stub';
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

/** Deterministic stub — returns when no provider is configured. */
function callStub(messages: AIMessage[], _opts: AICallOptions): AIResponse {
  const last = messages[messages.length - 1]?.content ?? '';

  return {
    text: `[STUB] No AI provider configured. Received prompt: "${last.slice(0, 120)}..."`,
    provider: 'stub',
    model: 'stub',
  };
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
  const provider = credential?.provider ?? activeProvider();
  switch (provider) {
    case 'anthropic':
      return callAnthropic(messages, opts, credential?.apiKey ?? aiKeys.anthropic!);
    case 'openai':
      return callOpenAI(messages, opts, credential?.apiKey ?? aiKeys.openai!);
    case 'google':
      return callGoogle(messages, opts, credential?.apiKey ?? aiKeys.google!);
    default:
      return callStub(messages, opts);
  }
}

/** Model name to use for a given advisor role and provider. */
export function modelForAdvisor(
  preferredModel: string | undefined,
  provider: AIProvider,
): string {
  if (preferredModel && provider === 'anthropic') return preferredModel;

  switch (provider) {
    case 'anthropic':
      return 'claude-sonnet-4-6';
    case 'openai':
      return 'gpt-4o-mini';
    case 'google':
      return 'gemini-2.5-flash';
    default:
      return 'stub';
  }
}
