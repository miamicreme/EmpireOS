'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';

type CheckStatus = 'healthy' | 'degraded' | 'blocked' | 'unknown' | 'not_configured';
type Severity = 'info' | 'warning' | 'critical';
type Category = 'platform' | 'database' | 'storage' | 'authentication' | 'intelligence' | 'voice' | 'recorder' | 'modules' | 'workers' | 'security';

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

function statusLabel(status: CheckStatus) {
  return status.replace('_', ' ');
}

function statusClass(status: CheckStatus) {
  if (status === 'healthy') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';
  if (status === 'degraded') return 'border-amber-400/25 bg-amber-400/10 text-amber-200';
  if (status === 'blocked') return 'border-red-400/30 bg-red-400/10 text-red-300';
  if (status === 'unknown') return 'border-violet-400/25 bg-violet-400/10 text-violet-200';
  return 'border-border bg-surface-2 text-empire-muted';
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

export default function EmpireDoctorPage() {
  const { success, error: showError } = useToast();
  const [doctor, setDoctor] = useState<DoctorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHealthy, setShowHealthy] = useState(false);

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    const res = await api.get<DoctorResult>('/api/health/doctor');
    if (res.ok) {
      setDoctor(res.data);
      success('Verified system scan complete');
    } else {
      showError(`Doctor could not complete: ${res.error.message}`);
    }
    setLoading(false);
  }, [success, showError]);

  useEffect(() => {
    void runDiagnostics();
  }, [runDiagnostics]);

  const grouped = useMemo(() => {
    if (!doctor) return [];
    return CATEGORY_ORDER.map((category) => ({
      category,
      checks: doctor.checks.filter((check) => check.category === category && (showHealthy || check.status !== 'healthy')),
      all: doctor.checks.filter((check) => check.category === category),
    })).filter((group) => group.all.length > 0 && group.checks.length > 0);
  }, [doctor, showHealthy]);

  const blockers = doctor?.checks.filter((check) => check.status === 'blocked') ?? [];

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <PageHeader
        title="Empire Doctor"
        subtitle="Verified operational truth for the database, authentication, intelligence, storage, modules, and runtime."
      />

      <div className="mx-auto max-w-6xl space-y-6">
        {loading && !doctor && (
          <Card className="p-10 text-center">
            <p className="text-sm text-empire-muted">Running authenticated checks against the live environment…</p>
          </Card>
        )}

        {doctor && (
          <>
            <section className="rounded-3xl border border-border bg-surface-1 p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-empire-blue">System readiness</p>
                  <div className="mt-3 flex items-end gap-3">
                    <span className="text-5xl font-semibold tracking-tight text-gray-100">{doctor.readinessScore}</span>
                    <span className="pb-1 text-lg text-empire-muted">/100</span>
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
                  <button
                    type="button"
                    onClick={() => setShowHealthy((value) => !value)}
                    className="rounded-xl border border-border px-4 py-2 text-sm text-gray-300 hover:bg-surface-2"
                  >
                    {showHealthy ? 'Hide healthy checks' : 'Show healthy checks'}
                  </button>
                </div>
              </div>

              {doctor.nextBestAction && (
                <div className="mt-5 rounded-2xl border border-empire-blue/25 bg-empire-blue/10 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-empire-blue">Next best action</p>
                  <p className="mt-2 text-sm leading-6 text-gray-100">{doctor.nextBestAction}</p>
                </div>
              )}
            </section>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Metric label="Healthy" value={doctor.summary.healthy} />
              <Metric label="Blocked" value={doctor.summary.blocked} />
              <Metric label="Degraded" value={doctor.summary.degraded} />
              <Metric label="Unknown" value={doctor.summary.unknown} />
              <Metric label="Not configured" value={doctor.summary.notConfigured} />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Card className="p-5">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-empire-muted">Environment proof</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4"><dt className="text-empire-muted">Canonical origin</dt><dd className="break-all text-right text-gray-100">{doctor.environment.canonicalOrigin ?? 'Not reported'}</dd></div>
                  <div className="flex items-start justify-between gap-4"><dt className="text-empire-muted">Passkey RP ID</dt><dd className="break-all text-right text-gray-100">{doctor.environment.rpId ?? 'Not reported'}</dd></div>
                  <div className="flex items-start justify-between gap-4"><dt className="text-empire-muted">Commit</dt><dd className="break-all text-right font-mono text-xs text-gray-100">{doctor.environment.commitSha ?? 'Unavailable'}</dd></div>
                  <div className="flex items-start justify-between gap-4"><dt className="text-empire-muted">Runtime</dt><dd className="text-gray-100">{doctor.environment.nodeEnv}</dd></div>
                  <div className="flex items-start justify-between gap-4"><dt className="text-empire-muted">Doctor contract</dt><dd className="text-gray-100">v{doctor.version}</dd></div>
                </dl>
              </Card>

              <Card className="p-5">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-empire-muted">Critical blockers</p>
                {blockers.length ? (
                  <div className="mt-4 space-y-3">
                    {blockers.slice(0, 5).map((check) => (
                      <div key={check.id} className="rounded-xl border border-red-400/25 bg-red-400/10 p-3">
                        <p className="text-sm font-medium text-gray-100">{check.name}</p>
                        <p className="mt-1 text-xs leading-5 text-red-200">{check.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-empire-muted">No critical blockers detected.</p>
                )}
              </Card>
            </section>

            <section className="space-y-4">
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
                                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide', statusClass(check.status))}>
                                  {statusLabel(check.status)}
                                </span>
                                {check.severity === 'critical' && <span className="text-[10px] uppercase tracking-wide text-red-300">critical</span>}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-gray-300">{check.message}</p>
                              {check.impact && <p className="mt-2 text-xs leading-5 text-amber-200"><strong>Impact:</strong> {check.impact}</p>}
                              {check.details && <p className="mt-2 break-all font-mono text-[11px] leading-5 text-empire-muted">{check.details}</p>}
                              {check.recommendation && <p className="mt-3 text-xs leading-5 text-empire-blue">Recommended: {check.recommendation}</p>}
                              {(check.dependency || check.migration) && (
                                <p className="mt-2 font-mono text-[10px] leading-5 text-empire-muted">
                                  {check.dependency ? `Dependency: ${check.dependency}` : ''}{check.dependency && check.migration ? ' · ' : ''}{check.migration ? `Migration: ${check.migration}` : ''}
                                </p>
                              )}
                            </div>
                            {check.actionHref && (
                              <Link href={check.actionHref as Route} className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs text-gray-300 hover:bg-surface-2">
                                Open
                              </Link>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </section>

            <p className="pb-4 text-xs text-empire-muted">
              Last verified {new Date(doctor.timestamp).toLocaleString()}. A crashed check reports unknown; it never reports healthy by default.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
