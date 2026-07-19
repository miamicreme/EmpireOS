/**
 * Universal input intelligence.
 *
 * Normalizes owner-selected inputs into compact agent artifacts. When a
 * documentId is present, the original private file, extraction, analysis,
 * routing proposal, and artifact remain linked under one durable record.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, type AppResult } from '@/lib/result';
import { normalizeRawInput } from '@/spine/agent/input/file-ingestion.service';
import { analyzeDocument } from '@/spine/agent/input/document-intelligence.service';
import { analyzeSpreadsheet } from '@/spine/agent/input/spreadsheet-intelligence.service';
import { analyzeVision } from '@/spine/agent/input/vision-intelligence.service';
import { createActionDrafts, saveArtifact } from './agent-repository.service';
import type { ArtifactType, SuggestedDraft } from './agent.types';
import type { UniversalInputAnalyzeDTO } from './agent.schemas';

const MAX_VIDEO_FRAMES = 10;

function toAgentArtifactType(type: string): ArtifactType {
  if (type === 'camera_analysis') return 'camera_analysis';
  if (type === 'video_frame_analysis') return 'video_frame_analysis';
  if (type === 'vision_analysis') return 'vision_analysis';
  if (type === 'spreadsheet_analysis') return 'spreadsheet_analysis';
  return 'document_analysis';
}

function highStakesNeedsResearch(text: string, inputType: string) {
  return /legal|lawsuit|foreclosure|default|credit|tradeline|trading|investment|offering memorandum|purchase agreement|loan/i.test(text) || inputType === 'xlsx';
}

type RouteProposal = {
  destinationModule: string;
  targetEntityType: string;
  confidence: number;
  reason: string;
  proposedActions: string[];
};

function classifyDestination(text: string, fileName = ''): RouteProposal {
  const source = `${fileName} ${text}`.toLowerCase();
  if (/offering memorandum|rent roll|noi|cap rate|property|parcel|tenant|lease|broker|real estate/.test(source)) {
    return { destinationModule: 'real_estate', targetEntityType: 'deal_or_property', confidence: 0.92, reason: 'The document contains real-estate deal, property, tenant, or underwriting language.', proposedActions: ['Create or update a deal record', 'Save extracted financial and property facts', 'Create an underwriting review draft'] };
  }
  if (/invoice|receipt|bank statement|balance|transaction|expense|revenue|cash flow|payment due/.test(source)) {
    return { destinationModule: 'finances', targetEntityType: 'financial_document', confidence: 0.9, reason: 'The document contains transaction, billing, statement, or cash-flow language.', proposedActions: ['Save the source under Finances', 'Extract amounts, dates, counterparties, and due dates', 'Create review drafts for unresolved items'] };
  }
  if (/resume|curriculum vitae|job description|candidate|interview|salary|skills/.test(source)) {
    return { destinationModule: 'career', targetEntityType: 'career_document', confidence: 0.88, reason: 'The document appears related to a role, resume, candidate, or job search.', proposedActions: ['Save under Career', 'Extract qualifications, gaps, and next actions', 'Create application or preparation drafts'] };
  }
  if (/agreement|contract|policy|terms|indemnity|liability|shall|governing law/.test(source)) {
    return { destinationModule: 'decisions', targetEntityType: 'agreement_or_policy', confidence: 0.87, reason: 'The document contains contract, policy, or legal-decision language.', proposedActions: ['Save under Decisions', 'Extract obligations, dates, risks, and unresolved terms', 'Create a review decision draft'] };
  }
  if (/meeting|minutes|agenda|follow up|owner:|assigned to|action item/.test(source)) {
    return { destinationModule: 'actions', targetEntityType: 'meeting_or_action_source', confidence: 0.84, reason: 'The document contains meeting, ownership, or action-item language.', proposedActions: ['Save as an action source', 'Extract owners and due dates', 'Create approval-gated action drafts'] };
  }
  if (/architecture|api|database|deployment|incident|system|integration|service|technical/.test(source)) {
    return { destinationModule: 'modules', targetEntityType: 'technical_document', confidence: 0.82, reason: 'The document contains technical system, architecture, integration, or incident language.', proposedActions: ['Save under Modules', 'Extract components, dependencies, risks, and decisions', 'Create implementation or recovery drafts'] };
  }
  if (/newsletter|article|blog|linkedin|publication|content strategy|editorial/.test(source)) {
    return { destinationModule: 'builders_desk', targetEntityType: 'content_source', confidence: 0.82, reason: 'The document appears to be publication or content material.', proposedActions: ['Save under Builder’s Desk', 'Extract themes, claims, and reusable insights', 'Create editorial drafts'] };
  }
  return { destinationModule: 'inputs', targetEntityType: 'general_document', confidence: 0.55, reason: 'No specialized destination reached the confidence threshold.', proposedActions: ['Keep in the Universal Input inbox', 'Review the extracted facts and recommendations', 'Approve a destination after owner review'] };
}

export interface UniversalInputArtifactResult {
  artifactId: string;
  documentId?: string;
  analysisId?: string;
  routeId?: string;
  destinationModule?: string;
  routingConfidence?: number;
  routingReason?: string;
  proposedRouteActions?: string[];
  artifactType: ArtifactType;
  summary: string;
  keyFacts: string[];
  risks: string[];
  opportunities: string[];
  recommendedActions: string[];
  actionDraftIds: string[];
  provider: string | null;
  nextCommandHint: string;
}

export async function analyzeUniversalInput(
  supabase: SupabaseClient,
  userId: string,
  input: UniversalInputAnalyzeDTO,
): Promise<AppResult<UniversalInputArtifactResult>> {
  if (input.documentId) {
    const { data: document } = await supabase
      .from('empire_documents')
      .select('id,original_filename,status')
      .eq('id', input.documentId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!document) return { ok: false, error: { code: 'not_found', message: 'Document not found.' } };
    await supabase.from('empire_documents').update({ status: 'analyzing', updated_at: new Date().toISOString() }).eq('id', input.documentId).eq('user_id', userId);
  }

  const normalized = normalizeRawInput({ ...input, allowDeepAnalysis: input.allowDeepAnalysis });
  if (!normalized.ok) return normalized;
  const data = normalized.data;
  const imageDescriptions = input.inputType === 'video_frames' ? data.imageDescriptions.slice(0, MAX_VIDEO_FRAMES) : data.imageDescriptions;
  const analysis = data.rows.length > 0 || input.inputType === 'csv' || input.inputType === 'xlsx'
    ? ok(analyzeSpreadsheet(data.rows, data.fileName))
    : input.inputType === 'image' || input.inputType === 'screenshot' || input.inputType === 'camera_snapshot' || input.inputType === 'video_frames'
      ? await analyzeVision({ descriptions: imageDescriptions, images: data.imageInputs, kind: input.inputType, allowVision: input.allowVision })
      : ok(analyzeDocument({ text: data.extractedText, fileName: data.fileName, inputType: input.inputType }));
  if (!analysis.ok) return analysis;

  const a = analysis.data;
  const requiresResearch = highStakesNeedsResearch(data.extractedText, input.inputType);
  const artifactType = requiresResearch && !input.allowDeepAnalysis ? 'research_needed' : toAgentArtifactType(a.artifactType);
  const route = classifyDestination(data.extractedText, data.fileName ?? undefined);
  const provider = 'provider' in a ? a.provider : null;
  const contentJson = {
    artifactType, title: a.title, summary: a.summary, keyFacts: a.keyFacts, risks: a.risks, opportunities: a.opportunities, recommendedActions: a.recommendedActions, confidence: a.confidence, sourceReferences: data.sourceRefs,
    input: {
      documentId: input.documentId ?? null,
      inputType: input.inputType,
      fileName: data.fileName,
      mimeType: data.mimeType,
      textPreview: data.extractedText.slice(0, 2000),
      rowsPreview: data.rows.slice(0, 5),
      imageDescriptions,
      imageByteMetadata: data.imageInputs.map((image) => ({
        mediaType: image.mediaType,
        format: image.format,
        byteLength: image.byteLength,
        sha256: image.sha256,
        width: image.width,
        height: image.height,
        sourceName: image.sourceName,
      })),
      transcriptPreview: data.transcript?.slice(0, 2000) ?? null,
    },
    routing: { provider, highStakes: requiresResearch, researchRequired: artifactType === 'research_needed', cost: data.cost, proposedDestination: route.destinationModule, routingConfidence: route.confidence },
    safety: { redactionChecked: data.redactionChecked, highRiskSecretsRedacted: data.highRiskSecretsRedacted, cameraActivatedServerSide: false, videoStreamStored: false, hiddenChainOfThoughtStored: false },
  };

  const artifact = await saveArtifact(supabase, userId, null, { artifactType, title: a.title, summary: artifactType === 'research_needed' ? `${a.summary} Research/deep review is required before final advice.` : a.summary, contentJson, sourceRefs: data.sourceRefs, confidence: a.confidence, riskLevel: requiresResearch ? 'high' : a.risks.length ? 'medium' : 'low' });
  if (!artifact.ok) return artifact;

  const drafts: SuggestedDraft[] = input.createDrafts === false ? [] : a.suggestedDrafts;
  const draftResult = await createActionDrafts(supabase, userId, null, artifact.data.id, drafts);
  if (!draftResult.ok) return draftResult;

  let analysisId: string | undefined;
  let routeId: string | undefined;
  if (input.documentId) {
    const { count } = await supabase.from('empire_document_analyses').select('*', { count: 'exact', head: true }).eq('document_id', input.documentId);
    const analysisInsert = await supabase.from('empire_document_analyses').insert({
      document_id: input.documentId, user_id: userId, artifact_id: artifact.data.id, analysis_version: (count ?? 0) + 1, purpose: input.purpose ?? 'general_review', summary: artifact.data.summary ?? a.summary, key_facts: a.keyFacts, risks: a.risks, opportunities: a.opportunities, recommendations: a.recommendedActions, confidence: a.confidence, provider,
    }).select('id').single();
    if (analysisInsert.data?.id) analysisId = analysisInsert.data.id;

    const routeInsert = await supabase.from('empire_document_routes').insert({
      document_id: input.documentId, analysis_id: analysisId ?? null, user_id: userId, destination_module: route.destinationModule, target_entity_type: route.targetEntityType, confidence: route.confidence, reason: route.reason, proposed_actions: route.proposedActions, status: 'proposed',
    }).select('id').single();
    if (routeInsert.data?.id) routeId = routeInsert.data.id;

    await supabase.from('empire_document_links').upsert({ document_id: input.documentId, user_id: userId, target_module: 'ai', target_entity_type: 'artifact', target_entity_id: artifact.data.id, relationship: 'analyzed_as' }, { onConflict: 'document_id,target_module,target_entity_type,target_entity_id' });
    await supabase.from('empire_documents').update({ status: 'routing_pending', updated_at: new Date().toISOString() }).eq('id', input.documentId).eq('user_id', userId);
  }

  return ok({
    artifactId: artifact.data.id, documentId: input.documentId, analysisId, routeId, destinationModule: route.destinationModule, routingConfidence: route.confidence, routingReason: route.reason, proposedRouteActions: route.proposedActions,
    artifactType, summary: artifact.data.summary ?? a.summary, keyFacts: a.keyFacts, risks: a.risks, opportunities: a.opportunities, recommendedActions: a.recommendedActions, actionDraftIds: draftResult.data.map((draft) => draft.id), provider,
    nextCommandHint: `Review artifact ${artifact.data.id} from document ${input.documentId ?? 'pasted input'} and recommend whether to approve routing to ${route.destinationModule}.`,
  });
}
