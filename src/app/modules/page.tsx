'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, healthVariant, statusVariant } from '@/components/ui/Badge';
import { Field, Select } from '@/components/ui/Field';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import type { GlobalAction, ModuleManifest, ModuleMetric } from '@/spine/types';
import type { AgentRunOutput, RunStatus } from '@/spine/ai/agent/agent.types';

type ModuleHealth = {
  moduleId: string;
  health: 'green' | 'yellow' | 'red' | 'unknown';
  summary: string;
  issues: string[];
  lastSyncedAt?: string;
};

type DailyRun = {
  id: string;
  status: RunStatus;
  intent: string | null;
  finalSummary: string | null;
  confidence: number | null;
  riskLevel: string | null;
  createdAt: string;
  completedAt: string | null;
};

type RunStatusResponse = { run: DailyRun | null };

const MODULE_COMMANDS: Record<string, string> = {
  'cash-engine': 'Review Cash Engine for today. Check cash target progress, risks, and the next best cash actions.',
  finances: 'Review Finances for today. Check net worth, burn, runway, cash risk, and the next best financial moves.',
  'job-hunt': 'Review Job Hunt for today. Check pipeline health, follow-ups, role quality, and the next best career actions.',
  'followup-crm': 'Review Follow-up CRM for today. Identify who needs contact and the highest-leverage follow-up actions.',
  'credit-funding': 'Review Credit and Funding for today. Check open credit items, funding readiness, and next best actions.',
  projects: 'Review Projects for today. Check focus risk, blockers, revenue potential, and which projects to push or pause.',
  acquisitions: 'Review Acquisitions for today. Check target quality, deal risks, and the highest-leverage acquisition actions.',
  'deal-intel': 'Review Deal Intelligence for today. Check deal evidence, missing facts, risk, and the next diligence move.',
};

function localDateKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dailyRunKey(moduleId: string) {
  return `module-daily-check:${moduleId}:${localDateKey()}`;
}

function formatNumber(value: number | null, unit: string | null) {
  if (value == null) return 'not set';
  if (unit === 'usd') {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  return `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`;
}

function moduleNeedsCheck(health?: ModuleHealth, run?: DailyRun | null) {
  return !run || health?.health === 'red' || health?.health === 'yellow';
}

function moduleIndicator(health?: ModuleHealth, run?: DailyRun | null) {
  if (!run) return { label: 'AI check due', variant: 'yellow' as const };
  if (health?.health === 'red') return { label: 'Check module', variant: 'red' as const };
  if (health?.health === 'yellow') return { label: 'Review soon', variant: 'yellow' as const };
  return { label: 'Checked today', variant: 'green' as const };
}

export default function ModulesPage() {
  const { success, error } = useToast();
  const [modules, setModules] = useState<ModuleManifest[]>([]);
  const [health, setHealth] = useState<ModuleHealth[]>([]);
  const [metrics, setMetrics] = useState<ModuleMetric[]>([]);
  const [actions, setActions] = useState<GlobalAction[]>([]);
  const [dailyRuns, setDailyRuns] = useState<Record<string, DailyRun | null>>({});
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [running, setRunning] = useState(false);
  const [agentOutput, setAgentOutput] = useState<AgentRunOutput | null>(null);

  const loadDailyRuns = useCallback(async (items: ModuleManifest[]) => {
    const entries = await Promise.all(
      items.map(async (module) => {
        const key = dailyRunKey(module.id);
        const res = await api.get<RunStatusResponse>(`/api/ai/agent/run?idempotency=${encodeURIComponent(key)}`);
        return [module.id, res.ok ? res.data.run : null] as const;
      }),
    );
    setDailyRuns(Object.fromEntries(entries));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [modulesRes, healthRes, metricsRes, actionsRes] = await Promise.all([
      api.get<ModuleManifest[]>('/api/modules'),
      api.get<{ health: ModuleHealth[] }>('/api/modules/health'),
      api.get<{ metrics: ModuleMetric[] }>('/api/modules/metrics'),
      api.get<{ actions: GlobalAction[] }>('/api/modules/actions'),
    ]);

    if (modulesRes.ok) {
      const sorted = [...modulesRes.data].sort((a, b) => a.priority - b.priority);
      setModules(sorted);
      setSelectedId((current) => current || sorted[0]?.id || '');
      await loadDailyRuns(sorted);
    } else {
      error(modulesRes.error.message);
    }
    if (healthRes.ok) setHealth(healthRes.data.health);
    else error(healthRes.error.message);
    if (metricsRes.ok) setMetrics(metricsRes.data.metrics);
    else error(metricsRes.error.message);
    if (actionsRes.ok) setActions(actionsRes.data.actions);
    else error(actionsRes.error.message);
    setLoading(false);
  }, [error, loadDailyRuns]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = modules.find((module) => module.id === selectedId) ?? modules[0];
  const healthByModule = useMemo(
    () => Object.fromEntries(health.map((item) => [item.moduleId, item] as const)),
    [health],
  );
  const selectedHealth = selected ? healthByModule[selected.id] : undefined;
  const selectedRun = selected ? dailyRuns[selected.id] : null;
  const selectedMetrics = metrics.filter((metric) => metric.module_id === selected?.id).slice(0, 8);
  const selectedActions = actions.filter((action) => action.module_id === selected?.id).slice(0, 8);
  const indicator = moduleIndicator(selectedHealth, selectedRun);
  const checkCount = modules.filter((module) => moduleNeedsCheck(healthByModule[module.id], dailyRuns[module.id])).length;

  async function syncModules() {
    setSyncing(true);
    const res = await api.post<{ synced: boolean; health: ModuleHealth[] }>('/api/modules/sync', {});
    setSyncing(false);
    if (res.ok) {
      setHealth(res.data.health);
      success('Modules synced to the Spine');
      void load();
    } else {
      error(res.error.message);
    }
  }

  async function runModuleAi(force = false) {
    if (!selected) return;
    setRunning(true);
    const idempotency = force
      ? `${dailyRunKey(selected.id)}:rerun:${Date.now()}`
      : dailyRunKey(selected.id);
    const res = await api.post<AgentRunOutput>('/api/ai/agent/run', {
      command: MODULE_COMMANDS[selected.id] ?? `Review ${selected.name} for today and recommend the next best actions.`,
      modeHint: 'module_daily_check',
      moduleHint: selected.id,
      artifactTypeHint: 'action_plan',
      runtimePreference: 'standard',
      idempotency,
    });
    setRunning(false);

    if (res.ok) {
      setAgentOutput(res.data);
      setDailyRuns((current) => ({
        ...current,
        [selected.id]: {
          id: res.data.runId,
          status: res.data.status,
          intent: res.data.intent,
          finalSummary: res.data.answer,
          confidence: res.data.confidence,
          riskLevel: res.data.riskLevel,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      }));
      success(force ? 'Module AI reran' : 'Module AI check complete');
    } else {
      error(res.error.message);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <PageHeader
        title="Modules"
        subtitle="One control surface for module health, metrics, actions, and daily AI checks."
        action={
          <Button variant="secondary" onClick={syncModules} loading={syncing}>
            Sync Spine
          </Button>
        }
      />

      {loading ? (
        <SkeletonRows rows={8} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
          <aside className="space-y-3">
            <div className="sm:hidden">
              <Field label="Select module">
                <Select value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)}>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Card>
              <CardHeader
                title="Module Stack"
                subtitle={`${checkCount} module${checkCount === 1 ? '' : 's'} need attention`}
              />
              <div className="hidden p-2 sm:block">
                {modules.map((module) => {
                  const moduleHealth = healthByModule[module.id];
                  const run = dailyRuns[module.id];
                  const itemIndicator = moduleIndicator(moduleHealth, run);
                  const active = module.id === selected?.id;
                  return (
                    <button
                      key={module.id}
                      onClick={() => {
                        setSelectedId(module.id);
                        setAgentOutput(null);
                      }}
                      className={cn(
                        'mb-1 flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                        active ? 'bg-surface-3 text-gray-100' : 'text-gray-300 hover:bg-surface-2',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{module.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-empire-muted">{module.description}</span>
                      </span>
                      <Badge variant={itemIndicator.variant}>{itemIndicator.label}</Badge>
                    </button>
                  );
                })}
              </div>
            </Card>
          </aside>

          {selected ? (
            <section className="space-y-5">
              <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-100">{selected.name}</h2>
                    <Badge variant={healthVariant(selectedHealth?.health ?? 'unknown')}>
                      {selectedHealth?.health ?? 'unknown'}
                    </Badge>
                    <Badge variant={indicator.variant}>{indicator.label}</Badge>
                  </div>
                  <p className="mt-1 max-w-3xl text-sm text-empire-muted">{selected.description}</p>
                  {selectedHealth?.summary && (
                    <p className="mt-2 text-sm text-gray-300">{selectedHealth.summary}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => runModuleAi(false)} loading={running} disabled={!selected}>
                    {selectedRun ? 'Show Today' : 'Run Today'}
                  </Button>
                  <Button variant="subtle" onClick={() => runModuleAi(true)} loading={running} disabled={!selected}>
                    Rerun AI
                  </Button>
                  <Link href={selected.route as Route}>
                    <Button variant="ghost">Data Page</Button>
                  </Link>
                </div>
              </div>

              {selectedRun && !agentOutput && (
                <Card className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-100">Today&apos;s AI check already ran</div>
                      <p className="mt-1 text-sm text-empire-muted">
                        {selectedRun.finalSummary ?? 'Open the run detail or rerun AI for a fresh pass.'}
                      </p>
                    </div>
                    <Link href={`/ai/runs/${selectedRun.id}` as Route}>
                      <Button variant="secondary">Open Run</Button>
                    </Link>
                  </div>
                </Card>
              )}

              {agentOutput && (
                <Card>
                  <CardHeader
                    title="AI Module Check"
                    subtitle={`${agentOutput.status.replaceAll('_', ' ')} - confidence ${Math.round(agentOutput.confidence * 100)}%`}
                    action={
                      <Link href={`/ai/runs/${agentOutput.runId}` as Route}>
                        <Button size="sm" variant="secondary">Trace</Button>
                      </Link>
                    }
                  />
                  <div className="space-y-4 p-4">
                    <p className="text-sm leading-relaxed text-gray-200">{agentOutput.answer}</p>
                    {agentOutput.nextActions.length > 0 && (
                      <div>
                        <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-empire-muted">
                          Next actions
                        </div>
                        <div className="space-y-2">
                          {agentOutput.nextActions.map((action, index) => (
                            <div key={`${action.title}-${index}`} className="rounded-lg border border-border bg-surface-2 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-gray-100">{action.title}</p>
                                <Badge variant={statusVariant(action.priority)}>{action.priority}</Badge>
                              </div>
                              {action.reason && <p className="mt-1 text-xs text-empire-muted">{action.reason}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Metrics" subtitle="Module signals synced into the Spine" />
                  <div className="p-4">
                    {selectedMetrics.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {selectedMetrics.map((metric) => (
                          <div key={metric.id} className="rounded-lg border border-border bg-surface-2 p-3">
                            <div className="text-xs text-empire-muted">{metric.metric_label}</div>
                            <div className="mt-1 text-lg font-semibold text-gray-100">
                              {formatNumber(metric.metric_value, metric.unit)}
                            </div>
                            {metric.target_value != null && (
                              <div className="mt-1 text-xs text-empire-muted">
                                Target {formatNumber(metric.target_value, metric.unit)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState message="No metrics reported by this module yet." />
                    )}
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Open Actions" subtitle="Ranked work this module contributes" />
                  <div className="p-4">
                    {selectedActions.length > 0 ? (
                      <div className="space-y-2">
                        {selectedActions.map((action) => (
                          <div key={action.id} className="rounded-lg border border-border bg-surface-2 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-gray-100">{action.title}</p>
                              <Badge variant={statusVariant(action.priority)}>{action.priority}</Badge>
                            </div>
                            {action.description && (
                              <p className="mt-1 text-xs text-empire-muted">{action.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState message="No open actions from this module." />
                    )}
                  </div>
                </Card>
              </div>
            </section>
          ) : (
            <EmptyState message="No modules are registered." />
          )}
        </div>
      )}
    </main>
  );
}
