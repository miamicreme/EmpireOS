'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';

interface CaseResult {
  id: string;
  title: string;
  dimension: string;
  score: number;
  passed: boolean;
  answer: string;
  error?: string;
}

interface BenchmarkResult {
  benchmarkVersion: string;
  generatedAt: string;
  overallScore: number;
  rating: string;
  dimensionScores: Record<string, number>;
  passed: number;
  total: number;
  cases: CaseResult[];
}

export function EmpireIntelligenceBenchmark() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runBenchmark() {
    setRunning(true);
    setError(null);
    const response = await api.post<BenchmarkResult>('/api/empire/evaluate', {});
    setRunning(false);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setResult(response.data);
  }

  return (
    <Card>
      <CardHeader
        title="Empire Intelligence Benchmark"
        subtitle="Repeatable scoring for reasoning, instruction following, honesty, safety, actionability, and governance."
      />
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={runBenchmark} loading={running}>
            Run intelligence test
          </Button>
          <p className="text-xs text-empire-muted">
            Runs six live AI cases against the active provider chain and may take several minutes.
          </p>
        </div>

        {error && <div className="rounded-lg border border-empire-red/30 bg-empire-red/10 p-3 text-sm text-empire-red">{error}</div>}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Overall" value={`${result.overallScore}/100`} />
              <Metric label="Rating" value={result.rating} />
              <Metric label="Passed" value={`${result.passed}/${result.total}`} />
              <Metric label="Version" value={result.benchmarkVersion} />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(result.dimensionScores).map(([dimension, score]) => (
                <div key={dimension} className="rounded-lg border border-border bg-surface-2 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-empire-muted">{dimension.replaceAll('_', ' ')}</div>
                  <div className="mt-1 text-xl font-semibold text-gray-100">{score}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {result.cases.map((test) => (
                <details key={test.id} className="rounded-lg border border-border bg-surface-2 p-3">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-gray-100">{test.title}</div>
                        <div className="text-xs text-empire-muted">{test.dimension}</div>
                      </div>
                      <span className={test.passed ? 'text-empire-green' : 'text-empire-red'}>{test.score}/100</span>
                    </div>
                  </summary>
                  <div className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm text-gray-300">
                    {test.error || test.answer}
                  </div>
                </details>
              ))}
            </div>

            <p className="text-[11px] text-empire-muted">
              Last run: {new Date(result.generatedAt).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="text-[10px] uppercase tracking-wider text-empire-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold capitalize text-gray-100">{value}</div>
    </div>
  );
}
