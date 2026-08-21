import type { JobApplication, JobStatus } from '@/spine/types';

const ACTIVE_STATUSES: JobStatus[] = ['applied', 'interviewing', 'offer'];
const CLOSED_STATUSES: JobStatus[] = ['rejected', 'accepted'];

export type JobFitVerdict = 'Strong Fit' | 'Good Fit' | 'Moderate Fit' | 'Weak Fit' | 'Poor Fit';
export type ApplicationStage = 'capture' | 'apply' | 'follow_up' | 'interview_prep' | 'offer_decision' | 'closed';

export interface JobApplicationIntelligence {
  applicationId: string;
  company: string;
  role: string;
  stage: ApplicationStage;
  score: number;
  verdict: JobFitVerdict;
  salaryUpside: 'unknown' | 'low' | 'solid' | 'high';
  nextBestMove: string;
  risks: string[];
  strengths: string[];
  gaps: string[];
  reviewerChecklist: string[];
  interviewPrepFocus: string[];
}

export interface JobPipelineIntelligence {
  total: number;
  active: number;
  interviewing: number;
  offers: number;
  strongFitCount: number;
  missingNextActions: number;
  missingSalary: number;
  topOpportunity: JobApplicationIntelligence | null;
  recommendations: string[];
  risks: string[];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stageForStatus(status: JobStatus): ApplicationStage {
  switch (status) {
    case 'saved':
      return 'capture';
    case 'applied':
      return 'follow_up';
    case 'interviewing':
      return 'interview_prep';
    case 'offer':
      return 'offer_decision';
    case 'accepted':
    case 'rejected':
      return 'closed';
    default:
      return 'capture';
  }
}

function verdictForScore(score: number): JobFitVerdict {
  if (score >= 75) return 'Strong Fit';
  if (score >= 60) return 'Good Fit';
  if (score >= 45) return 'Moderate Fit';
  if (score >= 30) return 'Weak Fit';
  return 'Poor Fit';
}

function salaryUpside(app: JobApplication): JobApplicationIntelligence['salaryUpside'] {
  const maxSalary = app.salary_max ?? app.salary_min;
  if (!maxSalary) return 'unknown';
  if (maxSalary >= 150_000) return 'high';
  if (maxSalary >= 110_000) return 'solid';
  return 'low';
}

function scoreSalary(app: JobApplication): number {
  const maxSalary = app.salary_max ?? app.salary_min;
  if (!maxSalary) return 45;
  if (maxSalary >= 170_000) return 100;
  if (maxSalary >= 150_000) return 90;
  if (maxSalary >= 125_000) return 75;
  if (maxSalary >= 100_000) return 60;
  return 35;
}

function scoreStage(app: JobApplication): number {
  switch (app.status) {
    case 'offer':
      return 100;
    case 'interviewing':
      return 90;
    case 'applied':
      return 70;
    case 'saved':
      return 50;
    case 'accepted':
      return 100;
    case 'rejected':
      return 10;
    default:
      return 40;
  }
}

function noteIncludes(app: JobApplication, terms: string[]): boolean {
  const notes = `${app.notes ?? ''} ${app.role ?? ''}`.toLowerCase();
  return terms.some((term) => notes.includes(term));
}

export function evaluateJobApplication(app: JobApplication): JobApplicationIntelligence {
  const priorityScore = clampScore((app.priority_score ?? 5) * 10);
  const salaryScore = scoreSalary(app);
  const stageScore = scoreStage(app);
  const hasRecruiter = Boolean(app.recruiter_name || app.recruiter_email);
  const hasResumeVersion = Boolean(app.resume_version);
  const hasNextAction = Boolean(app.next_action);
  const hasJobUrl = Boolean(app.job_url);

  const score = clampScore(priorityScore * 0.45 + salaryScore * 0.25 + stageScore * 0.2 + (hasRecruiter ? 5 : 0) + (hasNextAction ? 5 : 0));
  const stage = stageForStatus(app.status);
  const risks: string[] = [];
  const strengths: string[] = [];
  const gaps: string[] = [];

  if (salaryUpside(app) === 'high') strengths.push('High-income upside is visible.');
  if (app.status === 'interviewing') strengths.push('Live interview process.');
  if (app.status === 'offer') strengths.push('Offer-stage opportunity.');
  if (hasRecruiter) strengths.push('Recruiter/contact path exists.');
  if (hasResumeVersion) strengths.push('Resume version is tracked.');
  if (noteIncludes(app, ['ai', 'genai', 'automation', 'architect', 'typescript', 'supabase', 'workflow'])) {
    strengths.push('Role appears to connect to AI/software/operator positioning.');
  }

  if (!app.salary_min && !app.salary_max) gaps.push('Salary range missing.');
  if (!hasJobUrl) gaps.push('Job posting/source URL missing.');
  if (!hasResumeVersion) gaps.push('Tailored resume version not tracked.');
  if (!hasNextAction) gaps.push('Next action missing.');
  if (!hasRecruiter && app.status !== 'saved') gaps.push('No recruiter/contact captured.');

  if (!hasNextAction && ACTIVE_STATUSES.includes(app.status)) risks.push('Active role has no explicit next move.');
  if (!app.salary_min && !app.salary_max) risks.push('Cannot judge money leverage without compensation data.');
  if (app.status === 'saved' && score >= 60) risks.push('Good lead is still only saved; it may go stale.');
  if (CLOSED_STATUSES.includes(app.status) && app.status !== 'accepted') risks.push('Closed as rejected; use it for calibration, not active focus.');

  const reviewerChecklist = [
    'Extract hard requirements and keywords from the posting before drafting.',
    'Score technical fit, experience fit, behavioral fit, logistics, and career alignment.',
    'Tailor resume bullets by relevance to the posting, not by recency alone.',
    'Write cover letter claims only from defensible experience; no invented wins.',
    'Run a reviewer pass for clarity, proof, gaps, and voice before sending.',
  ];

  const interviewPrepFocus = [
    'Prepare honest bridge answers for gaps: acknowledge, show adjacent proof, explain learning path.',
    'Map likely questions to STAR stories and numbers already claimed in the resume/cover letter.',
    'Create 4-6 smart questions about team, success metrics, stack, leadership, and growth path.',
    'Keep interview talking points consistent with the submitted resume and cover letter.',
  ];

  let nextBestMove = 'Evaluate the posting, score fit, and decide whether this deserves a tailored application.';
  if (app.status === 'saved') nextBestMove = 'Run fit score, capture salary/source, then tailor resume and cover letter if score is 60+.';
  if (app.status === 'applied') nextBestMove = app.follow_up_at ? 'Prepare follow-up and recruiter touchpoint.' : 'Set follow-up date and draft recruiter message.';
  if (app.status === 'interviewing') nextBestMove = 'Build interview prep pack: likely questions, STAR stories, gap bridges, and questions to ask.';
  if (app.status === 'offer') nextBestMove = 'Compare compensation, risk, upside, and negotiation angle before accepting.';
  if (app.status === 'rejected') nextBestMove = 'Log rejection reason and update fit-calibration notes.';
  if (app.status === 'accepted') nextBestMove = 'Archive win, capture lessons, and convert start-date tasks into actions.';

  return {
    applicationId: app.id,
    company: app.company,
    role: app.role,
    stage,
    score,
    verdict: verdictForScore(score),
    salaryUpside: salaryUpside(app),
    nextBestMove,
    risks,
    strengths,
    gaps,
    reviewerChecklist,
    interviewPrepFocus,
  };
}

export function getPipelineIntelligence(apps: JobApplication[]): JobPipelineIntelligence {
  const evaluations = apps.map(evaluateJobApplication);
  const activeApps = apps.filter((app) => ACTIVE_STATUSES.includes(app.status));
  const topOpportunity = evaluations
    .filter((item) => item.stage !== 'closed')
    .sort((a, b) => b.score - a.score)[0] ?? null;

  const missingNextActions = activeApps.filter((app) => !app.next_action).length;
  const missingSalary = apps.filter((app) => app.salary_min == null && app.salary_max == null).length;
  const interviewing = apps.filter((app) => app.status === 'interviewing').length;
  const offers = apps.filter((app) => app.status === 'offer').length;
  const recommendations: string[] = [];
  const risks: string[] = [];

  if (apps.length === 0) {
    recommendations.push('Add 3 target roles and score them before applying.');
    risks.push('No job pipeline exists.');
  }
  if (activeApps.length < 5) recommendations.push('Build toward at least 5 active high-income opportunities.');
  if (missingNextActions > 0) recommendations.push('Fill next_action for every active role so the Spine can rank work.');
  if (missingSalary > 0) recommendations.push('Capture compensation range or target value for each role.');
  if (interviewing > 0) recommendations.push('Convert every interview into a prep pack with STAR stories and gap bridges.');
  if (offers > 0) recommendations.push('Run offer decision analysis before accepting or negotiating.');

  if (activeApps.length === 0 && apps.length > 0) risks.push('Pipeline exists but has no active applied/interviewing/offer roles.');
  if (missingNextActions > 0) risks.push('Active applications are not action-ready.');
  if (missingSalary > Math.max(1, Math.floor(apps.length / 2))) risks.push('Money upside is under-instrumented.');

  return {
    total: apps.length,
    active: activeApps.length,
    interviewing,
    offers,
    strongFitCount: evaluations.filter((item) => item.verdict === 'Strong Fit').length,
    missingNextActions,
    missingSalary,
    topOpportunity,
    recommendations,
    risks,
  };
}
