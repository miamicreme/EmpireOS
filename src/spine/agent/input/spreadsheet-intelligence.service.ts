import type { SuggestedDraft } from '@/spine/ai/agent/agent.types';

export type SpreadsheetPurpose = 'transactions' | 'contacts' | 'deals' | 'jobs' | 'credit_accounts' | 'funding_options' | 'unknown';

export interface SpreadsheetAnalysis {
  artifactType: 'spreadsheet_analysis';
  title: string;
  summary: string;
  keyFacts: string[];
  risks: string[];
  opportunities: string[];
  recommendedActions: string[];
  purpose: SpreadsheetPurpose;
  rowCount: number;
  columns: string[];
  totals: Record<string, number>;
  dateRange: { start: string | null; end: string | null };
  outliers: string[];
  duplicates: number;
  missingValues: Record<string, number>;
  confidence: number;
  suggestedDrafts: SuggestedDraft[];
}

function inferPurpose(columns: string[]): SpreadsheetPurpose {
  const c = columns.join(' ').toLowerCase();
  if (/amount|transaction|merchant|balance|debit|credit/.test(c)) return 'transactions';
  if (/email|phone|contact|company/.test(c)) return 'contacts';
  if (/deal|noi|cap|rent|property|address/.test(c)) return 'deals';
  if (/job|company|salary|application|recruiter/.test(c)) return 'jobs';
  if (/score|tradeline|bureau|account|utilization/.test(c)) return 'credit_accounts';
  if (/fund|lender|apr|term|loan/.test(c)) return 'funding_options';
  return 'unknown';
}

export function analyzeSpreadsheet(rows: Array<Record<string, string | number | boolean | null>>, fileName?: string | null): SpreadsheetAnalysis {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const purpose = inferPurpose(columns);
  const totals: Record<string, number> = {};
  const missingValues: Record<string, number> = {};
  const dates: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (const row of rows) {
    const signature = JSON.stringify(row);
    if (seen.has(signature)) duplicates += 1;
    seen.add(signature);
    for (const column of columns) {
      const value = row[column];
      if (value === null || value === undefined || value === '') missingValues[column] = (missingValues[column] ?? 0) + 1;
      if (typeof value === 'number') totals[column] = (totals[column] ?? 0) + value;
      if (typeof value === 'string' && /date|created|due|posted/i.test(column) && !Number.isNaN(Date.parse(value))) dates.push(new Date(value).toISOString().slice(0, 10));
    }
  }
  const outliers = Object.entries(totals)
    .filter(([, total]) => Math.abs(total) > 10_000)
    .map(([column, total]) => `${column} total is ${total.toFixed(2)}`);
  const recommendedActions = [
    purpose === 'transactions' ? 'Review large charges and missing categories.' : null,
    purpose === 'jobs' ? 'Draft follow-ups for high-fit job rows.' : null,
    purpose === 'deals' ? 'Create underwriting follow-up actions for incomplete deal rows.' : null,
    duplicates ? `Resolve ${duplicates} duplicate row(s).` : null,
  ].filter(Boolean) as string[];

  return {
    artifactType: 'spreadsheet_analysis',
    title: fileName ? `Spreadsheet analysis: ${fileName}` : 'Spreadsheet analysis',
    summary: `Spreadsheet analyzed locally: ${rows.length} rows, ${columns.length} columns, purpose ${purpose}.`,
    keyFacts: [`Rows: ${rows.length}`, `Columns: ${columns.join(', ') || 'none'}`, `Purpose: ${purpose}`],
    risks: [...outliers, ...Object.entries(missingValues).filter(([, n]) => n > 0).map(([c, n]) => `${c} has ${n} missing value(s)`)],
    opportunities: recommendedActions.length ? recommendedActions : ['Use this spreadsheet as context for the next agent run.'],
    recommendedActions,
    purpose,
    rowCount: rows.length,
    columns,
    totals,
    dateRange: { start: dates.sort()[0] ?? null, end: dates.sort().at(-1) ?? null },
    outliers,
    duplicates,
    missingValues,
    confidence: rows.length ? 0.86 : 0.45,
    suggestedDrafts: recommendedActions.map((title) => ({ title, description: `Suggested from ${purpose} spreadsheet analysis.`, category: purpose === 'jobs' ? 'jobs' : purpose === 'transactions' ? 'cash' : 'general', priority: 'medium', reason: 'Deterministic spreadsheet intelligence found follow-up work.', confidenceScore: 0.74 })),
  };
}
