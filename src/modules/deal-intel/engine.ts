import type { CanonicalFact, DealAssetClass, DealBrief, DealRecommendation } from './types';

const money = String.raw`(?:\$|USD\s*)?([0-9][0-9,]*(?:\.\d+)?)\s*(m|million|k|thousand)?`;
const critical = ['tax_returns', 'trailing_12_month_p_and_l', 'lease_agreement', 'payroll_detail', 'customer_concentration', 'seller_financing_terms', 'equipment_list', 'reason_for_sale'];

function parseMoney(value: string): number {
  const [, n = '0', suffix = ''] = value.match(new RegExp(money, 'i')) ?? [];
  const base = Number(n.replace(/,/g, ''));
  return /m|million/i.test(suffix) ? base * 1_000_000 : /k|thousand/i.test(suffix) ? base * 1_000 : base;
}

export function classifyAsset(text: string): DealAssetClass {
  const t = text.toLowerCase();
  if (/saas|website|e-?commerce|digital/.test(t)) return 'digital_business';
  if (/franchise/.test(t)) return 'franchise';
  if (/note|debt|loan/.test(t)) return 'debt_note';
  if (/laundromat|car wash|route|vending|agency|business|sde|ebitda/.test(t)) return /building|real estate|property/.test(t) ? 'business_with_real_estate' : 'business';
  if (/multifamily|commercial|noi|cap rate|property|building|units/.test(t)) return 'real_estate';
  return 'unknown';
}

export function extractFactCandidates(raw: string): Array<{ key: string; value: unknown; type: string; unit?: string; excerpt: string }> {
  const patterns: Array<[string, RegExp, string, string?]> = [
    ['asking_price', new RegExp(`(?:asking|price|listed at|purchase price)[^\n]{0,30}${money}`, 'i'), 'currency', 'USD'],
    ['revenue', new RegExp(`(?:revenue|sales)[^\n]{0,30}${money}`, 'i'), 'currency', 'USD'],
    ['sde', new RegExp(`(?:sde|seller discretionary earnings)[^\n]{0,30}${money}`, 'i'), 'currency', 'USD'],
    ['ebitda', new RegExp(`ebitda[^\n]{0,30}${money}`, 'i'), 'currency', 'USD'],
    ['noi', new RegExp(`noi|net operating income[^\n]{0,30}${money}`, 'i'), 'currency', 'USD'],
    ['cap_rate', /cap rate[^\n]{0,20}([0-9]+(?:\.[0-9]+)?)%/i, 'percent', '%'],
    ['seller_financing_available', /seller financing|owner financing|seller will carry/i, 'boolean'],
    ['lease_expiration', /lease (?:expires|expiration)[^\n.]{0,80}/i, 'text'],
    ['reason_for_sale', /reason for sale[^\n.]{0,120}/i, 'text'],
  ];
  return patterns.flatMap(([key, re, type, unit]) => {
    const m = raw.match(re); if (!m) return [];
    const value = type === 'currency' ? parseMoney(m[0]) : type === 'percent' ? Number(m[1]) : type === 'boolean' ? true : m[0];
    return [{ key, value, type, unit, excerpt: m[0].slice(0, 500) }];
  });
}

export function detectMissingInformation(facts: Array<{ fact_key: string }>, raw: string): string[] {
  const keys = new Set(facts.map((f) => f.fact_key));
  return critical.filter((item) => !keys.has(item) && !raw.toLowerCase().includes(item.replaceAll('_', ' ')));
}

export function scoreDeal(facts: CanonicalFact[], missing: string[]) {
  const get = (k: string) => Number(facts.find((f) => f.fact_key === k && !f.superseded_by_fact_id)?.fact_value_json ?? 0);
  const asking = get('asking_price'), sde = get('sde'), ebitda = get('ebitda'), noi = get('noi');
  const earnings = sde || ebitda || noi;
  const multiple = asking && earnings ? asking / earnings : null;
  const dataQuality = Math.max(20, 100 - missing.length * 8);
  const valuation = multiple ? Math.max(20, Math.min(95, 100 - Math.abs(multiple - 3.5) * 12)) : 45;
  const financing = facts.some((f) => f.fact_key === 'seller_financing_available') ? 80 : 50;
  const riskBurden = Math.max(20, 90 - missing.length * 7 - (multiple && multiple > 5 ? 15 : 0));
  const overall = Math.round((dataQuality + valuation + financing + riskBurden + 60 + 65 + 60) / 7);
  return { overall, probability: Number((overall / 100).toFixed(2)), dataQuality, valuation, financing, riskBurden, multiple };
}

export function recommendationFor(score: number, missing: string[]): DealRecommendation {
  if (score >= 82 && missing.length <= 3) return 'strong_pursue';
  if (score >= 68) return 'pursue_with_conditions';
  if (score >= 58) return 'negotiate_hard';
  if (missing.length >= 6) return 'watch';
  return 'pass';
}

export function buildBrief(dealId: string, title: string, facts: CanonicalFact[], missing: string[]): DealBrief {
  const s = scoreDeal(facts, missing); const recommendation = recommendationFor(s.overall, missing);
  const next = missing.length ? `Request ${missing.slice(0, 4).map((x) => x.replaceAll('_', ' ')).join(', ')}.` : 'Prepare an LOI with verification contingencies.';
  return { deal_id: dealId, recommendation, overall_score: s.overall, probability_of_success: s.probability, executive_summary: `${title} scores ${s.overall}/100. The current decision is ${recommendation.replaceAll('_', ' ')} because data quality, valuation, financing, and risk burden were scored from canonical facts and missing diligence items.`, visual_payload: { score_gauge: { score: s.overall, recommendation }, score_breakdown: [{ label: 'Data Quality', score: s.dataQuality }, { label: 'Valuation', score: Math.round(s.valuation) }, { label: 'Financing', score: s.financing }, { label: 'Risk Burden', score: s.riskBurden }], risk_matrix: missing.map((m) => ({ title: m.replaceAll('_', ' '), likelihood: 'medium', severity: m.includes('tax') || m.includes('lease') ? 'high' : 'medium' })), scenario_table: ['worst_case', 'base_case', 'best_case'].map((name, i) => ({ scenario: name, projected_roi: [-8, 12, 32][i], notes: ['Needs downside protection', 'Works if verified', 'Upside exists'][i] })), financial_waterfall: ['revenue', 'gross_profit', 'operating_expenses', 'adjusted_ebitda_or_sde', 'debt_service', 'cash_flow_to_owner'], capital_stack: [{ label: 'Buyer Cash', percent: 20 }, { label: 'Seller Financing', percent: 50 }, { label: 'Bank Debt', percent: 30 }], missing_information: missing, timeline: ['Day 0 Add Deal', 'Day 1 Request Financials', 'Day 3 Verify Lease', 'Day 10 LOI', 'Day 30 Due Diligence'], deal_thesis_map: { could_work: ['Seller financing may reduce capital need', 'Operator upside may exist'], could_fail: missing.slice(0, 4) } }, next_actions: [next, 'Verify facts before offer terms become binding.'], missing_information: missing };
}
