import type { SuggestedDraft } from '@/spine/ai/agent/agent.types';
import { routeProviderForTask } from '@/spine/ai/provider-capabilities';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { aiKeys, requestyConfig } from '@/lib/env';
import type { NormalizedImageInput } from './file-ingestion.service';
import { z } from 'zod';

export interface VisionAnalysis {
  artifactType: 'vision_analysis' | 'camera_analysis' | 'video_frame_analysis';
  title: string;
  summary: string;
  keyFacts: string[];
  risks: string[];
  opportunities: string[];
  recommendedActions: string[];
  confidence: number;
  provider: string;
  suggestedDrafts: SuggestedDraft[];
}

const visionProviderOutputSchema = z.object({
  summary: z.string().max(2000).default('Vision provider analyzed the submitted image bytes.'),
  keyFacts: z.array(z.string().max(1000)).max(12).default([]),
  risks: z.array(z.string().max(1000)).max(8).default([]),
  opportunities: z.array(z.string().max(1000)).max(8).default([]),
  recommendedActions: z.array(z.string().max(1000)).max(8).default([]),
  confidence: z.coerce.number().min(0).max(1).catch(0.7),
});

type VisionProviderOutput = z.infer<typeof visionProviderOutputSchema>;
type RoutedVisionProvider = 'requesty' | 'openai' | 'anthropic';

function parseVisionJson(raw: string): VisionProviderOutput {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return visionProviderOutputSchema.parse(JSON.parse(cleaned));
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return visionProviderOutputSchema.parse(JSON.parse(cleaned.slice(start, end + 1)));
      } catch {
        return visionProviderOutputSchema.parse({});
      }
    }
    return visionProviderOutputSchema.parse({});
  }
}

function visionPrompt(kind: string, descriptions: string[], imageFacts: string[]) {
  return `Analyze the actual submitted image bytes for EmpireOS universal input.
Return ONLY JSON with keys: summary, keyFacts, risks, opportunities, recommendedActions, confidence.
Input kind: ${kind}
User-provided context, which may be incomplete and must not replace visual analysis:
${descriptions.length ? descriptions.join('\n') : 'None'}
Server-verified image metadata:
${imageFacts.join('\n')}`;
}

async function callOpenAICompatibleVision(
  provider: 'requesty' | 'openai',
  images: NormalizedImageInput[],
  prompt: string,
): Promise<VisionProviderOutput> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey: provider === 'requesty' ? aiKeys.requesty : aiKeys.openai,
    ...(provider === 'requesty' ? { baseURL: requestyConfig.baseURL } : {}),
  });
  const model = provider === 'requesty'
    ? requestyConfig.visionModel ?? requestyConfig.defaultModel ?? requestyConfig.standardModel ?? 'requesty-vision-unconfigured'
    : process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  const response = await client.chat.completions.create({
    model,
    max_tokens: 900,
    temperature: 0.2,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        ...images.map((image) => ({
          type: 'image_url',
          image_url: { url: `data:${image.mediaType};base64,${image.dataBase64}` },
        })),
      ],
    }] as never,
  });

  return parseVisionJson(response.choices[0]?.message.content ?? '{}');
}

async function callAnthropicVision(images: NormalizedImageInput[], prompt: string): Promise<VisionProviderOutput> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: aiKeys.anthropic });
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_VISION_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 900,
    temperature: 0.2,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        ...images.map((image) => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: image.mediaType,
            data: image.dataBase64,
          },
        })),
      ],
    }],
  });
  const text = response.content.find((part) => part.type === 'text')?.text ?? '{}';
  return parseVisionJson(text);
}

async function defaultVisionProviderExecutor(input: {
  provider: string;
  kind: string;
  descriptions: string[];
  images: NormalizedImageInput[];
  imageFacts: string[];
}): Promise<VisionProviderOutput> {
  const prompt = visionPrompt(input.kind, input.descriptions, input.imageFacts);
  if (input.provider === 'requesty' || input.provider === 'openai') {
    return callOpenAICompatibleVision(input.provider, input.images, prompt);
  }
  if (input.provider === 'anthropic') return callAnthropicVision(input.images, prompt);
  throw new Error(`Unsupported vision provider: ${input.provider}`);
}

export async function analyzeVision(input: {
  descriptions: string[];
  images: NormalizedImageInput[];
  kind: 'image' | 'screenshot' | 'camera_snapshot' | 'video_frames';
  allowVision?: boolean;
  env?: NodeJS.ProcessEnv;
  providerExecutor?: typeof defaultVisionProviderExecutor;
}): Promise<AppResult<VisionAnalysis>> {
  if (input.allowVision === false) return err(appError('validation', 'Vision analysis requires allowVision.'));
  if (input.images.length === 0) return err(appError('validation', 'image_bytes_required'));
  const provider = routeProviderForTask('vision', input.env);
  if (!provider.ok) return err(appError('validation', provider.code));
  const text = input.descriptions.join('\n').toLowerCase();
  const screenshot = input.kind === 'screenshot' || /error|bug|screen|ui|login|console/.test(text);
  const imageFacts = input.images.map((image, index) => {
    const label = input.kind === 'video_frames' ? `Frame ${index + 1}` : index === 0 ? 'Image' : `Image ${index + 1}`;
    const size = image.width && image.height ? `${image.width}x${image.height}` : 'unknown dimensions';
    return `${label}: ${image.format.toUpperCase()} ${size}, ${image.byteLength} bytes, sha256 ${image.sha256.slice(0, 16)}.`;
  });
  const recommendedActions = [
    screenshot ? 'Create troubleshoot/fix/research draft for the screenshot issue.' : null,
    input.kind === 'camera_snapshot' ? 'Clarify, recapture, analyze, or save this camera observation.' : null,
    input.kind === 'video_frames' ? 'Review sampled frames and decide whether deeper visual analysis is needed.' : null,
  ].filter(Boolean) as string[];
  const executor = input.providerExecutor ?? defaultVisionProviderExecutor;
  let providerOutput: VisionProviderOutput;
  try {
    providerOutput = await executor({
      provider: provider.provider as RoutedVisionProvider,
      kind: input.kind,
      descriptions: input.descriptions,
      images: input.images,
      imageFacts,
    });
  } catch (error) {
    return err(appError('ai_provider_error', error instanceof Error ? error.message : 'Vision provider failed.'));
  }
  const providerActions = providerOutput.recommendedActions.length ? providerOutput.recommendedActions : recommendedActions;
  return ok({
    artifactType: input.kind === 'camera_snapshot' ? 'camera_analysis' : input.kind === 'video_frames' ? 'video_frame_analysis' : 'vision_analysis',
    title: input.kind === 'camera_snapshot' ? 'Camera analysis' : input.kind === 'video_frames' ? 'Video frame analysis' : 'Vision analysis',
    summary: providerOutput.summary,
    keyFacts: [...providerOutput.keyFacts, ...imageFacts],
    risks: providerOutput.risks,
    opportunities: providerOutput.opportunities.length ? providerOutput.opportunities : ['Use visual artifact as context for the next agent run.'],
    recommendedActions: providerActions,
    confidence: providerOutput.confidence,
    provider: provider.provider,
    suggestedDrafts: providerActions.map((title) => ({ title, description: `Suggested from ${input.kind} visual analysis.`, category: screenshot ? 'projects' : 'general', priority: screenshot ? 'medium' : 'low', reason: 'Vision intelligence identified approval-gated work.', confidenceScore: 0.68 })),
  });
}
