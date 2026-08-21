'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';

type CheckStatus = 'healthy' | 'degraded' | 'blocked' | 'unknown' | 'not_configured';
type Severity = 'info' | 'warning' | 'critical';
type Category = 'platform' | 'database' | 'storage' | 'authentication' | 'intelligence' | 'voice' | 'recorder' | 'modules' | 'workers' | 'security';
type ViewMode = 'attention' | 'all';

interface HealthCheck {
  id: string;
  name: string;
  category: Category;
  status: CheckStatus;
  severity: Severity;
  message: string;
  details?: string;
  recommendation?: string;
  impact?: string;
  repairAvailable: boolean;
  repairMode?: 'automatic' | 'approval_required' | 'manual_only';
  actionHref?: string;
  dependency?: string;
  migration?: string;
  durationMs: number;
}

interface DoctorResult {
  version: string;
  checks: HealthCheck[];
  overallHealth: 'green' | 'yellow' | 'red';
  readinessScore: number;
  nextBestAction?: string;
  summary: {
    healthy: number;
    degraded: number;
    blocked: number;
    unknown: number;
    notConfigured: number;
  };
  environment: {
    canonicalOrigin: string | null;
    rpId: string | null;
    commitSha: string | null;
    nodeEnv: string;
  };
  timestamp: string;
}

const CATEGORY_ORDER: Category[] = ['platform', 'database', 'storage', 'authentication', 'security', 'intelligence', 'voice', 'recorder', 'modules', 'workers'];
const STATUS_RANK: Record<CheckStatus, number> = { blocked: 0, degraded: 1, unknown: 2, not_configured: 3, healthy: 4 };
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
const STALE_AFTER_MS = 5 * 60 * 1000;

function statusLabel(status: CheckStatus) {
  return status === 'not_configured' ? 'not configured' : status;
}

function statusClass(status: CheckStatus) {
  if (status === 'healthy') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';
  if (status === 'degraded') return 'border-amber-400/25 bg-amber-400/10 text-amber-200';
  if (status === 'blocked') return 'border-red-400/30 bg-red-400/10 text-red-300';
  if (status === 'unknown') return 'border-violet-400/25 bg-violet-400/10 text-violet-200';
  return 'border-border bg-surface-2 text-empire-muted';
}

function scoreTone(score: number) {
  if (score >= 90) return 'text-emerald-300';
  if (score >= 75) return 'text-amber-200';
  return 'text-red-300';
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-empire-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-100">{value}</p>
      {detail && <p className="mt-1 text-xs text-empire-muted">{detail}</p>}
    </div>
  );
}

function ageLabel(timestamp: string, now: number) {
  const age = Math.max(0, now - new Date(timestamp).getTime());
  if (age < 60_000) return 'just now';
  const minutes = Math.floor(age / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export default function EmpireDoctorPage() {
  const { success, error: showError } = useToast();
  const [doctor, setDoctor] = useState<DoctorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('attention');
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const initialRun = useRef(true);

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<DoctorResult>('/api/health/doctor');
      if (!res.ok) {
        setLoadError(res.error.message);
        showError(`Doctor could not complete: ${res.error.message}`);
        return;
      }
      setDoctor(res.data);
      setNow(Date.now());
      if (!initialRun.current) success('Verified system scan complete');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected diagnostic failure';
      setLoadError(message);
      showError(`Doctor could not complete: ${message}`);
    } finally {
      initialRun.current = false;
      setLoading(false);
    }
  }, [success, showError]);

  useEffect(() => {
    void runDiagnostics();
  }, [runDiagnostics]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const sortedChecks = useMemo(() => {
    if (!doctor) return [];
    return [...doctor.checks].sort((a, b) => {
      const status = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (status !== 0) return status;
      const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (severity !== 0) return severity;
      return a.name.localeCompare(b.name);
    });
  }, [doctor]);

  const visibleChecks = useMemo(() => sortedChecks.filter((check) => {
    if (activeCategory !== 'all' && check.category !== activeCategory) return false;
    if (viewMode === 'attention' && check.status === 'healthy') return false;
    return true;
  }), [activeCategory, sortedChecks, viewMode]);

  const grouped = useMemo(() => CATEGORY_ORDER.map((category) => {
    const all = sortedChecks.filter((check) => check.category === category);
    const checks = visibleChecks.filter((check) => check.category === category);
    return { category, all, checks };
  }).filter((group) => group.all.length > 0 && group.checks.length > 0), [sortedChecks, visibleChecks]);

  const blockers = sortedChecks.filter((check) => check.status === 'blocked');
  const totalDuration = doctor?.checks.reduce((sum, check) => sum + check.durationMs, 0) ?? 0;
  const isStale = doctor ? now - new Date(doctor.timestamp).getTime() > STALE_AFTER_MS : false;
  const nextActionCheck = sortedChecks.find((check) => check.recommendation && check.status !== 'healthy');

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <PageHeader
        title="Empire Doctor"
        subtitle="One source of truth for production readiness, risk, and the next verified repair."
      />

      <div className="mx-auto max-w-6xl space-y-6">
        {loading && !doctor && (
          <Card className="p-10 text-center" aria-live="polite">
            <p className="text-sm text-empire-muted">Running authenticated checks against the live environment…</p>
          </Card>
        )}

        {loadError && !doctor && (
          <Card className="border-red-400/25 p-6">
            <p className="text-sm font-medium text-red-300">Empire Doctor could not load</p>
            <p className="mt-2 text-sm text-empire-muted">{loadError}</p>
            <Button className="mt-4" onClick={() => void runDiagnostics()} loading={loading}>Try again</Button>
          </Card>
        )}

        {doctor && (
          <>
            <section className="rounded-3xl border border-border bg-surface-1 p-5 sm:p-6" aria-live="polite">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-empire-blue">System readiness</p>
                    {isStale && <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">scan stale</span>}
                    {loading && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-empire-muted">refreshing</span>}
                  </div>
                  <div className="mt-3 flex items-end gap-3">
                    <span className={cn('text-5xl font-semibold tracking-tight', scoreTone(doctor.readinessScore))}>{doctor.readinessScore}</span>
                    <span className="pb-1 text-lg text-empire-muted">/100</span>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="System readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={doctor.readinessScore}>
                    <div className="h-full rounded-full bg-empire-blue transition-all" style={{ width: `${doctor.readinessScore}%` }} />
                  </div>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-empire-muted">
                    {doctor.overallHealth === 'green'
                      ? 'All registered checks are verified healthy.'
                      : doctor.overallHealth === 'red'
                        ? 'Critical blockers require attention before Empire should be treated as production-ready.'
                        : 'Empire is usable, but one or more dependencies are degraded, unknown, or not configured.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void runDiagnostics()} loading={loading}>Run full diagnostic</Button>
                  <button type="button" onClick={() => setViewMode((value) => value === 'attention' ? 'all' : 'attention')} className="rounded-xl border border-border px-4 py-2 text-sm text-gray-300 hover:bg-surface-2">
                    {viewMode === 'attention' ? 'Show all checks' : 'Show attention only'}
                  </button>
                </div>
              </div>

              {(doctor.nextBestAction || nextActionCheck) && (
                <div className="mt-5 rounded-2xl border border-empire-blue/25 bg-empire-blue/10 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-empire-blue">Next best action</p>
                      <p className="mt-2 text-sm leading-6 text-gray-100">{doctor.nextBestAction ?? nextActionCheck?.recommendation}</p>
                    </div>
                    {nextActionCheck?.actionHref && <Link href={nextActionCheck.actionHref as Route} className="shrink-0 rounded-lg border border-empire-blue/30 px-3 py-2 text-xs text-empire-blue hover:bg-empire-blue/10">Open fix</Link>}
                  </div>
                </div>
              )}
            </section>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              <Metric label="Healthy" value={doctor.summary.healthy} />
              <Metric label="Blocked" value={doctor.summary.blocked} />
              <Metric label="Degraded" value={doctor.summary.degraded} />
              <Metric label="Unknown" value={doctor.summary.unknown} />
              <Metric label="Not configured" value={doctor.summary.notConfigured} />
              <Metric label="Scan work" value={`${totalDuration}ms`} detail={`${doctor.checks.length} checks`} />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
              <Card className="p-5">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-empire-muted">Environment proof</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4"><dt className="text-empire-muted">Canonical origin</dt><dd className="break-all text-right text-gray-100">{doctor.environment.canonicalOrigin ?? 'Not reported'}</dd></div>
                  <div className="flex items-start justify-between gap-4"><dt className="text-empire-muted">Passkey RP ID</dt><dd className="break-all text-right text-gray-100">{doctor.environment.rpId ?? 'Not reported'}</dd></div>
                  <div className="flex items-start justify-between gap-4"><dt className="text-empire-muted">Commit</dt><dd className="break-all text-right font-mono text-xs text-gray-100">{doctor.environment.commitSha?.slice(0, 12) ?? 'Unavailable'}</dd></div>
                  <div className="flex items-start justify-between gap-4"><dt className="text-empire-muted">Runtime</dt><dd className="text-gray-100">{doctor.environment.nodeEnv}</dd></div>
                  <div className="flex items-start justify-between gap-4"><dt className="text-empire-muted">Doctor contract</dt><dd className="text-gray-100">v{doctor.version}</dd></div>
                  <div className="flex items-start justify-between gap-4"><dt className="text-empire-muted">Last verified</dt><dd className={cn('text-right', isStale ? 'text-amber-200' : 'text-gray-100')}>{ageLabel(doctor.timestamp, now)}</dd></div>
                </dl>
              </Card>

              <Card className="p-5">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-empire-muted">Critical blockers</p>
                {blockers.length ? (
                  <div className="mt-4 space-y-3">
                    {blockers.slice(0, 5).map((check) => (
                      <div key={check.id} className="rounded-xl border border-red-400/25 bg-red-400/10 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-100">{check.name}</p>
                            <p className="mt-1 text-xs leading-5 text-red-200">{check.message}</p>
                            {check.recommendation && <p className="mt-2 text-xs leading-5 text-gray-300">{check.recommendation}</p>}
                          </div>
                          {check.actionHref && <Link href={check.actionHref as Route} className="shrink-0 text-xs text-red-200 underline underline-offset-4">Open</Link>}
                        </div>
                      </div>
                    ))}
                    {blockers.length > 5 && <p className="text-xs text-empire-muted">+{blockers.length - 5} more blockers below</p>}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-empire-muted">No critical blockers detected.</p>
                )}
              </Card>
            </section>

            <section className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter diagnostic categories">
              {(['all', ...CATEGORY_ORDER] as const).map((category) => {
                const count = category === 'all' ? sortedChecks.length : sortedChecks.filter((check) => check.category === category).length;
                return <button key={category} type="button" onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category} className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs capitalize', activeCategory === category ? 'border-empire-blue/40 bg-empire-blue/10 text-empire-blue' : 'border-border text-empire-muted hover:bg-surface-2')}>{category} · {count}</button>;
              })}
            </section>

            <section className="space-y-4">
              {grouped.length === 0 && (
                <Card className="p-8 text-center">
                  <p className="text-sm text-empire-muted">No checks in this view need attention.</p>
                  <button type="button" onClick={() => setViewMode('all')} className="mt-3 text-sm text-empire-blue">Show all checks</button>
                </Card>
              )}
              {grouped.map((group) => {
                const unhealthy = group.all.filter((check) => check.status !== 'healthy').length;
                return (
                  <Card key={group.category} className="overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                      <div>
                        <h2 className="text-base font-semibold capitalize text-gray-100">{group.category}</h2>
                        <p className="mt-1 text-xs text-empire-muted">{group.all.length - unhealthy} healthy · {unhealthy} need attention</p>
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {group.checks.map((check) => (
                        <article key={check.id} className="p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-medium text-gray-100">{check.name}</h3>
                                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide', statusClass(check.status))}>{statusLabel(check.status)}</span>
                                {check.severity === 'critical' && <span className="text-[10px] uppercase tracking-wide text-red-300">critical</span>}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-gray-300">{check.message}</p>
                              {check.impact && <p className="mt-2 text-xs leading-5 text-amber-200"><strong>Impact:</strong> {check.impact}</p>}
                              {check.details && <details className="mt-2"><summary className="cursor-pointer text-xs text-empire-muted">Technical evidence</summary><p className="mt-2 break-all font-mono text-[11px] leading-5 text-empire-muted">{check.details}</p></details>}
                              {check.recommendation && <p className="mt-3 text-xs leading-5 text-empire-blue">Recommended: {check.recommendation}</p>}
                              {(check.dependency || check.migration) && <p className="mt-2 font-mono text-[10px] leading-5 text-empire-muted">{check.dependency ? `Dependency: ${check.dependency}` : ''}{check.dependency && check.migration ? ' · ' : ''}{check.migration ? `Migration: ${check.migration}` : ''}</p>}
                              <p className="mt-2 text-[10px] text-empire-muted">Check ID: {check.id} · {check.durationMs}ms</p>
                            </div>
                            {check.actionHref && <Link href={check.actionHref as Route} className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs text-gray-300 hover:bg-surface-2">Open</Link>}
                          </div>
                        </article>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </section>

            <p className="pb-4 text-xs text-empire-muted">Last verified {new Date(doctor.timestamp).toLocaleString()}. A crashed check reports unknown; configured-only capabilities do not prove live execution.</p>
          </>
        )}
      </div>
    </main>
  );
}
