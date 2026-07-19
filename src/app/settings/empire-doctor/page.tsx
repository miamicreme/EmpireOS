'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';

interface HealthCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
  recommendation?: string;
  severity: 'low' | 'medium' | 'high';
}

interface DoctorResult {
  checks: HealthCheck[];
  overallHealth: 'green' | 'yellow' | 'red';
  summary: {
    passing: number;
    warnings: number;
    failures: number;
  };
  timestamp: string;
}

function statusIcon(status: 'ok' | 'warning' | 'error' | 'green' | 'yellow' | 'red'): string {
  if (status === 'ok' || status === 'green') return '✅';
  if (status === 'warning' || status === 'yellow') return '⚠️';
  if (status === 'error' || status === 'red') return '❌';
  return '❓';
}

function statusColor(status: 'ok' | 'warning' | 'error'): string {
  if (status === 'ok') return 'text-green-500';
  if (status === 'warning') return 'text-yellow-500';
  if (status === 'error') return 'text-red-500';
  return 'text-gray-500';
}

function healthBadgeColor(health: 'green' | 'yellow' | 'red'): string {
  if (health === 'green') return 'bg-green-500/20 text-green-400 border-green-500/50';
  if (health === 'yellow') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
  if (health === 'red') return 'bg-red-500/20 text-red-400 border-red-500/50';
  return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
}

export default function EmpireDoctorPage() {
  const { success, error: showError } = useToast();
  const [doctor, setDoctor] = useState<DoctorResult | null>(null);
  const [loading, setLoading] = useState(true);

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    const res = await api.get<DoctorResult>('/api/health/doctor');
    if (res.ok) {
      setDoctor(res.data);
      success('Diagnostics complete');
    } else {
      showError('Failed to run diagnostics: ' + res.error.message);
    }
    setLoading(false);
  }, [success, showError]);

  useEffect(() => {
    void runDiagnostics();
  }, [runDiagnostics]);

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <PageHeader
        title="Empire Doctor"
        subtitle="Comprehensive system health check. Identifies configuration issues and missing dependencies."
      />

      <div className="space-y-6 max-w-3xl">
        {doctor && (
          <>
            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-100">Overall Status</h3>
                  <p className="text-sm text-empire-muted mt-1">
                    {doctor.summary.passing} passing · {doctor.summary.warnings} warnings ·{' '}
                    {doctor.summary.failures} failing
                  </p>
                </div>
                <div className={cn(
                  'px-4 py-2 rounded-lg border text-center font-medium text-sm',
                  healthBadgeColor(doctor.overallHealth)
                )}>
                  {doctor.overallHealth === 'green' ? '✅ Healthy' :
                   doctor.overallHealth === 'yellow' ? '⚠️ Issues' :
                   '❌ Critical'}
                </div>
              </div>

              <div className="mt-4 text-xs text-empire-muted">
                Last checked: {new Date(doctor.timestamp).toLocaleString()}
              </div>
            </Card>

            <Card>
              <CardHeader title="System Checks" subtitle={`${doctor.checks.length} total`} />
              <div className="divide-y divide-border">
                {doctor.checks.map((check, i) => (
                  <div key={i} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-lg">{statusIcon(check.status)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-100">{check.name}</p>
                        <p className={cn('text-sm mt-0.5', statusColor(check.status))}>
                          {check.message}
                        </p>
                        {check.details && (
                          <p className="text-xs text-empire-muted mt-1 font-mono break-all">
                            {check.details}
                          </p>
                        )}
                        {check.recommendation && (
                          <p className="text-xs text-empire-blue mt-1.5">
                            → {check.recommendation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex gap-2">
              <Button onClick={() => runDiagnostics()} loading={loading} variant="primary">
                Re-run Diagnostics
              </Button>
            </div>
          </>
        )}

        {loading && !doctor && (
          <Card className="p-8 text-center">
            <p className="text-empire-muted">Running diagnostics...</p>
          </Card>
        )}
      </div>
    </main>
  );
}
