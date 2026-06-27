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

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AICallOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
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
): Promise<AIResponse> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: aiKeys.anthropic! });

  const model = opts.model ?? 'claude-sonnet-4-6';
  const systemPrompt = opts.systemPrompt;

  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.3,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text : '';
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
): Promise<AIResponse> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: aiKeys.openai! });

  const model = opts.model ?? 'gpt-4o-mini';
  const msgs = opts.systemPrompt
    ? [{ role: 'system' as const, content: opts.systemPrompt }, ...messages]
    : messages;

  const response = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.3,
    messages: msgs.map((m) => ({ role: m.role, content: m.content })),
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
): Promise<AIResponse> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(aiKeys.google!);
  const model = opts.model ?? 'gemini-1.5-flash';
  const genModel = client.getGenerativeModel({ model });

  // Combine system + user messages into a single prompt for Google's API
  const parts: string[] = [];
  if (opts.systemPrompt) parts.push(opts.systemPrompt);
  for (const m of messages) {
    parts.push(`${m.role.toUpperCase()}: ${m.content}`);
  }

  const result = await genModel.generateContent(parts.join('\n\n'));
  const text = result.response.text();
  return { text, provider: 'google', model };
}

/** Deterministic stub — returns when no provider is configured. */
function callStub(messages: AIMessage[], opts: AICallOptions): AIResponse {
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
 * Context MUST already be redacted before reaching this function.
 */
export async function callAI(
  messages: AIMessage[],
  opts: AICallOptions = {},
): Promise<AIResponse> {
  const provider = activeProvider();
  switch (provider) {
    case 'anthropic':
      return callAnthropic(messages, opts);
    case 'openai':
      return callOpenAI(messages, opts);
    case 'google':
      return callGoogle(messages, opts);
    default:
      return callStub(messages, opts);
  }
}

/** Model name to use for a given advisor role and provider. */
export function modelForAdvisor(
  preferredModel: string | undefined,
  provider: AIProvider,
): string {
  // preferredModel values are Anthropic model IDs — only honour them when
  // Anthropic is the active provider; otherwise fall through to provider defaults.
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
