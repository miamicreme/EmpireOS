import type { SuggestedDraft } from '@/spine/ai/agent/agent.types';

export interface DocumentAnalysis {
  artifactType: 'document_analysis';
  title: string;
  summary: string;
  keyFacts: string[];
  risks: string[];
  opportunities: string[];
  recommendedActions: string[];
  confidence: number;
  suggestedDrafts: SuggestedDraft[];
}

export function analyzeDocument(input: { text: string; fileName?: string | null; inputType: string }): DocumentAnalysis {
  const text = input.text.trim();
  const lower = text.toLowerCase();
  const kind = /invoice|bill|amount due|payment due/.test(lower) ? 'bill' : /job description|responsibilities|salary|recruiter/.test(lower) ? 'job_description' : /credit report|tradeline|bureau|dispute/.test(lower) ? 'credit_report' : /offering memorandum|noi|cap rate|rent roll|property/.test(lower) ? 'real_estate_doc' : 'document';
  const sentences = text.split(/[.!?]\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 5);
  const recommendedActions = [
    kind === 'bill' ? 'Review bill and decide whether to pay, dispute, or schedule it.' : null,
    kind === 'job_description' ? 'Draft resume tailoring and recruiter follow-up actions.' : null,
    kind === 'credit_report' ? 'Review credit report items and draft dispute actions where appropriate.' : null,
    kind === 'real_estate_doc' ? 'Draft underwriting and seller/broker follow-up actions.' : null,
  ].filter(Boolean) as string[];
  return {
    artifactType: 'document_analysis',
    title: input.fileName ? `Document analysis: ${input.fileName}` : 'Document analysis',
    summary: sentences[0] ?? `Analyzed ${input.inputType} document content.`,
    keyFacts: sentences.length ? sentences : ['Document text extracted locally.'],
    risks: /deadline|due|past due|lawsuit|default|foreclosure/.test(lower) ? ['Document appears to contain time-sensitive or high-stakes language.'] : [],
    opportunities: recommendedActions.length ? recommendedActions : ['Use this document summary as agent context.'],
    recommendedActions,
    confidence: text.length ? 0.78 : 0.4,
    suggestedDrafts: recommendedActions.map((title) => ({ title, description: `Suggested from ${kind} document analysis.`, category: kind === 'bill' ? 'cash' : kind === 'job_description' ? 'jobs' : kind === 'credit_report' ? 'credit' : 'general', priority: /due|deadline|past due/.test(lower) ? 'high' : 'medium', reason: 'Document intelligence identified approval-gated work.', confidenceScore: 0.76 })),
  };
}
