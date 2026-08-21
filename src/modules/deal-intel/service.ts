import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { logger } from '@/lib/logger';
import type { ModuleContract } from '@/spine/module-contract';
import type { ModuleHealthResult, ModuleMetric } from '@/spine/types';
import { syncModuleMetricsToSpine } from '@/spine/module-adapter';
import { emitSystemEvent } from '@/spine/events/event.service';
import type { CanonicalFact, DealBrief, DealFlowDealSummary, DealIntelDeal, EmpireOSDealSummary } from './types';
import { addDocumentSchema, analyzeDealSchema, createDealIntelDealSchema, startResearchRunSchema, type AddDocumentInput, type AnalyzeDealInput, type CreateDealIntelDealInput, type StartResearchRunInput } from './schemas';
import { buildBrief, classifyAsset, detectMissingInformation, extractFactCandidates, scoreDeal } from './engine';

export const manifest = { id: 'deal-intel', name: 'Deal Intelligence Engine', slug: 'deal-intel', description: 'Backend-first, evidence-backed wealth asset analysis engine.', phaseId: 'phase_2', route: '/api/deal-intel/deals', icon: 'target', capabilities: ['metrics', 'actions', 'decisions', 'events', 'health_check', 'sync'], priority: 65 };
const now = () => new Date().toISOString();

async function latestFacts(supabase: SupabaseClient, dealId: string): Promise<CanonicalFact[]> {
  const { data } = await supabase.from('deal_intel_canonical_facts').select('*').eq('deal_id', dealId).is('superseded_by_fact_id', null);
  return (data ?? []) as CanonicalFact[];
}

export async function createDealFromRawInput(supabase: SupabaseClient, userId: string, input: CreateDealIntelDealInput): Promise<AppResult<{ deal_id: string; status: string; detected_asset_class: string; missing_critical_fields: string[]; warnings?: string[] }>> {
  const parsed = createDealIntelDealSchema.safeParse(input); if (!parsed.success) return err(appError('validation', 'Invalid deal intake.', parsed.error.format()));
  const assetClass = classifyAsset(`${parsed.data.title}\n${parsed.data.raw_input}`);
  const { data: deal, error } = await supabase.from('deal_intel_deals').insert({ title: parsed.data.title, deal_type: parsed.data.deal_type, asset_class: assetClass, status: 'created', source_type: parsed.data.source_url ? 'web_page' : 'notes', source_url: parsed.data.source_url ?? null, currency: 'USD', summary: parsed.data.raw_input.slice(0, 1000), priority: 'medium', owner_user_id: userId }).select('*').single();
  if (error) return err(appError('db_error', error.message));
  const dealRow = deal as DealIntelDeal;

  // The deal row is already committed at this point, so a failure in one of these
  // enrichment writes shouldn't abort the whole intake (that would leave an orphaned
  // deal row with no cleanup path) — log and surface it as a warning instead.
  const warnings: string[] = [];
  const { data: asset, error: assetError } = await supabase.from('deal_intel_assets').insert({ deal_id: dealRow.id, asset_type: assetClass, name: parsed.data.title, description: parsed.data.raw_input.slice(0, 1000), included_in_sale: true }).select('*').single();
  if (assetError) { logger.warn('deal_intel_asset_insert_failed', { dealId: dealRow.id, error: assetError.message }); warnings.push('Could not save the primary asset record.'); }
  const { data: doc, error: docError } = await supabase.from('deal_intel_source_documents').insert({ deal_id: dealRow.id, document_type: 'listing', title: parsed.data.title, source_url: parsed.data.source_url ?? null, raw_text: parsed.data.raw_input, extracted_text: parsed.data.raw_input, uploaded_by: userId }).select('*').single();
  if (docError) { logger.warn('deal_intel_source_document_insert_failed', { dealId: dealRow.id, error: docError.message }); warnings.push('Could not save the source document.'); }
  const candidates = extractFactCandidates(parsed.data.raw_input);
  if (candidates.length) {
    const { error: factsError } = await supabase.from('deal_intel_canonical_facts').insert(candidates.map((f) => ({ deal_id: dealRow.id, asset_id: (asset as { id?: string } | null)?.id ?? null, fact_key: f.key, fact_value_json: f.value, fact_type: f.type, unit: f.unit ?? null, confidence_score: 0.68, source_document_id: (doc as { id?: string } | null)?.id ?? null, source_excerpt: f.excerpt, verification_status: 'broker_provided', created_by: 'intake_agent' })));
    if (factsError) { logger.warn('deal_intel_facts_insert_failed', { dealId: dealRow.id, error: factsError.message }); warnings.push('Could not save extracted facts.'); }
  }
  const facts = await latestFacts(supabase, dealRow.id); const missing = detectMissingInformation(facts, parsed.data.raw_input);
  const { error: runError } = await supabase.from('deal_intel_agent_runs').insert({ deal_id: dealRow.id, agent_name: 'Intake Agent', task_type: 'extract_and_classify', input_json: parsed.data, output_json: { assetClass, missing, facts: candidates.map((c) => c.key) }, status: 'completed', confidence_score: 0.68, started_at: now(), completed_at: now() });
  if (runError) { logger.warn('deal_intel_agent_run_insert_failed', { dealId: dealRow.id, error: runError.message }); warnings.push('Could not record the intake agent run.'); }
  return ok({ deal_id: dealRow.id, status: 'created', detected_asset_class: assetClass, missing_critical_fields: missing, ...(warnings.length ? { warnings } : {}) });
}

export async function addSourceDocument(supabase: SupabaseClient, userId: string, dealId: string, input: AddDocumentInput): Promise<AppResult<{ document_id: string }>> {
  const parsed = addDocumentSchema.safeParse(input); if (!parsed.success) return err(appError('validation', 'Invalid source document.', parsed.error.format()));
  const { data, error } = await supabase.from('deal_intel_source_documents').insert({ ...parsed.data, deal_id: dealId, uploaded_by: userId }).select('id').single();
  if (error) return err(appError('db_error', error.message));
  return ok({ document_id: (data as { id: string }).id });
}

export async function runDealAnalysis(supabase: SupabaseClient, dealId: string, input: AnalyzeDealInput): Promise<AppResult<{ analysis_run_id: string; status: string; estimated_steps: string[]; warnings?: string[] }>> {
  const parsed = analyzeDealSchema.safeParse(input); if (!parsed.success) return err(appError('validation', 'Invalid analysis request.', parsed.error.format()));
  const { data: deal, error } = await supabase.from('deal_intel_deals').select('*').eq('id', dealId).single(); if (error || !deal) return err(appError('not_found', 'Deal not found.'));
  // The agent-run row is the parent every downstream row (scores/reports) references
  // by analysis_run_id, so — unlike the enrichment writes below — a failure here must
  // abort the request rather than fabricate an analysisRunId nothing else points to.
  const { data: run, error: runInsertError } = await supabase.from('deal_intel_agent_runs').insert({ deal_id: dealId, agent_name: 'Recommendation Agent', task_type: 'full_analysis', input_json: parsed.data, output_json: {}, status: 'running', started_at: now() }).select('id').single();
  if (runInsertError || !run) return err(appError('db_error', runInsertError?.message ?? 'Could not start the analysis run.'));
  const analysisRunId = (run as { id: string }).id; const facts = await latestFacts(supabase, dealId); const missing = detectMissingInformation(facts, (deal as DealIntelDeal).summary ?? ''); const brief = buildBrief(dealId, (deal as DealIntelDeal).title, facts, missing); const score = scoreDeal(facts, missing);
  const warnings: string[] = [];
  const { error: scoresError } = await supabase.from('deal_intel_deal_scores').insert({ deal_id: dealId, analysis_run_id: analysisRunId, overall_score: score.overall, probability_of_success: score.probability, risk_score: score.riskBurden, upside_score: 65, data_quality_score: score.dataQuality, financing_score: score.financing, operator_fit_score: 60, market_score: 60, valuation_score: Math.round(score.valuation), exit_score: 65, explanation: brief.executive_summary });
  if (scoresError) { logger.warn('deal_intel_scores_insert_failed', { dealId, analysisRunId, error: scoresError.message }); warnings.push('Could not save the deal score.'); }
  const { error: risksError } = await supabase.from('deal_intel_risks').insert(missing.slice(0, 5).map((m) => ({ deal_id: dealId, risk_category: m.includes('lease') ? 'lease' : 'financial', title: m.replaceAll('_', ' '), description: `Unverified ${m.replaceAll('_', ' ')} may change the recommendation.`, severity: m.includes('tax') || m.includes('lease') ? 'high' : 'medium', likelihood: 'medium', mitigation: `Request and verify ${m.replaceAll('_', ' ')}.`, status: 'open' })));
  if (risksError) { logger.warn('deal_intel_risks_insert_failed', { dealId, analysisRunId, error: risksError.message }); warnings.push('Could not save identified risks.'); }
  const { error: scenariosError } = await supabase.from('deal_intel_scenarios').insert((brief.visual_payload.scenario_table as Array<{ scenario: string; projected_roi: number; notes: string }>).map((s) => ({ deal_id: dealId, scenario_name: s.scenario, assumptions_json: {}, projected_roi: s.projected_roi, risk_notes: s.notes })));
  if (scenariosError) { logger.warn('deal_intel_scenarios_insert_failed', { dealId, analysisRunId, error: scenariosError.message }); warnings.push('Could not save scenario projections.'); }
  const { error: reportError } = await supabase.from('deal_intel_analysis_reports').insert({ deal_id: dealId, analysis_run_id: analysisRunId, report_type: 'full_diligence', title: `${(deal as DealIntelDeal).title} Deal Intelligence Brief`, executive_summary: brief.executive_summary, full_report_markdown: brief.executive_summary, visual_payload_json: brief.visual_payload, recommendation: brief.recommendation, confidence_score: score.probability });
  if (reportError) { logger.warn('deal_intel_report_insert_failed', { dealId, analysisRunId, error: reportError.message }); warnings.push('Could not save the analysis report.'); }
  const { error: completeError } = await supabase.from('deal_intel_agent_runs').update({ status: 'completed', output_json: brief, completed_at: now(), confidence_score: score.probability }).eq('id', analysisRunId);
  if (completeError) { logger.warn('deal_intel_agent_run_complete_failed', { dealId, analysisRunId, error: completeError.message }); warnings.push('Could not mark the analysis run complete.'); }
  return ok({ analysis_run_id: analysisRunId, status: 'queued', estimated_steps: ['financial_analysis', 'valuation', 'risk_analysis', 'market_research', 'recommendation'], ...(warnings.length ? { warnings } : {}) });
}

export async function getDealBrief(supabase: SupabaseClient, dealId: string): Promise<AppResult<DealBrief>> { const { data: deal } = await supabase.from('deal_intel_deals').select('*').eq('id', dealId).single(); if (!deal) return err(appError('not_found', 'Deal not found.')); const facts = await latestFacts(supabase, dealId); return ok(buildBrief(dealId, (deal as DealIntelDeal).title, facts, detectMissingInformation(facts, (deal as DealIntelDeal).summary ?? ''))); }
export async function getCanonicalFacts(supabase: SupabaseClient, dealId: string) { return ok(await latestFacts(supabase, dealId)); }
export async function startResearchRun(supabase: SupabaseClient, dealId: string, input: StartResearchRunInput) { const parsed = startResearchRunSchema.safeParse(input); if (!parsed.success) return err(appError('validation', 'Invalid research request.', parsed.error.format())); const rows = parsed.data.research_types.map((research_type) => ({ deal_id: dealId, research_type, status: 'queued', priority: 'normal' })); const { data, error } = await supabase.from('deal_intel_research_runs').insert(rows).select('id,research_type,status'); if (error) return err(appError('db_error', error.message)); return ok({ research_runs: data ?? [] }); }
export async function getEmpireOSSummary(supabase: SupabaseClient, dealId: string): Promise<AppResult<EmpireOSDealSummary>> { const brief = await getDealBrief(supabase, dealId); if (!brief.ok) return brief; const { data: deal } = await supabase.from('deal_intel_deals').select('title,priority').eq('id', dealId).single(); return ok({ deal_id: dealId, title: (deal as { title: string }).title, recommendation: brief.data.recommendation, priority: (deal as { priority?: string }).priority ?? 'medium', probability_of_success: brief.data.probability_of_success, next_best_action: brief.data.next_actions[0] ?? 'Review deal.', due_today: true, risk_level: brief.data.missing_information.length > 5 ? 'medium_high' : 'medium', potential_value: brief.data.overall_score >= 70 ? 'high' : 'medium' }); }
export async function getDealFlowSummary(supabase: SupabaseClient, dealId: string): Promise<AppResult<DealFlowDealSummary>> { const brief = await getDealBrief(supabase, dealId); if (!brief.ok) return brief; return ok({ deal_id: dealId, buyer_match_recommendation: 'match_to_buyers', ideal_buyer_types: ['cash-flow buyer', 'owner-operator', '1031 buyer', 'seller-finance buyer'], deal_brief_status: 'ready', outreach_angle: `Evidence-backed ${brief.data.recommendation.replaceAll('_', ' ')} opportunity with diligence items clearly identified.`, suggested_followups: ['Send buyer brief', 'Call top 5 buyers', 'Ask broker if seller will carry financing'] }); }

/** Deals + a failed-run count for this user — the basis for real metrics/health. */
async function loadDealSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ deals: Array<{ id: string; status: string }>; failedRunCount: number }> {
  const { data: deals } = await supabase.from('deal_intel_deals').select('id,status').eq('owner_user_id', userId);
  const dealRows = (deals ?? []) as Array<{ id: string; status: string }>;
  const dealIds = dealRows.map((d) => d.id);
  if (dealIds.length === 0) return { deals: dealRows, failedRunCount: 0 };
  const { data: runs } = await supabase.from('deal_intel_agent_runs').select('id').in('deal_id', dealIds).eq('status', 'failed');
  return { deals: dealRows, failedRunCount: (runs ?? []).length };
}

export async function getMetrics(supabase: SupabaseClient, userId: string): Promise<ModuleMetric[]> {
  const { deals, failedRunCount } = await loadDealSummary(supabase, userId);
  const date = new Date().toISOString().slice(0, 10);
  const createdAt = new Date().toISOString();
  const base = { user_id: userId, module_id: manifest.id, metric_text: null, date, trend_direction: null, metadata: {}, created_at: createdAt };
  return [
    { ...base, id: `derived:deal_intel_total_deals:${date}`, metric_key: 'total_deals', metric_label: 'Deals Tracked', metric_value: deals.length, target_value: null, unit: 'deals' },
    { ...base, id: `derived:deal_intel_failed_runs:${date}`, metric_key: 'failed_analysis_runs', metric_label: 'Failed Analysis Runs', metric_value: failedRunCount, target_value: null, unit: 'runs' },
  ];
}

export async function getHealth(supabase: SupabaseClient, userId: string): Promise<ModuleHealthResult> {
  const { deals, failedRunCount } = await loadDealSummary(supabase, userId);
  if (deals.length === 0) return { moduleId: manifest.id, health: 'yellow', reason: 'No deals tracked yet.' };
  if (failedRunCount > 0) return { moduleId: manifest.id, health: 'red', reason: `${failedRunCount} analysis run(s) failed.` };
  return { moduleId: manifest.id, health: 'green', reason: `${deals.length} deal(s) tracked, no failed analysis runs.` };
}

export const dealIntelModule: ModuleContract = { manifest, getMetrics: (userId) => getMetrics(createClient(), userId), getActions: async () => [], getDecisionContext: async () => ({ moduleId: manifest.id, summary: 'Deal Intelligence Engine analyzes opportunities and emits evidence-backed recommendations.', facts: {}, risks: [], opportunities: ['Use Deal Intel briefs to prioritize pipeline decisions.'], recommendedActions: [] }), getHealth: (userId) => getHealth(createClient(), userId), syncToSpine: async (userId) => { const supabase = createClient(); await syncModuleMetricsToSpine(userId, manifest.id, []); await emitSystemEvent(supabase, userId, { event_name: 'deal_intel.synced', event_type: 'synced', module_id: manifest.id, payload: {} }); } };
