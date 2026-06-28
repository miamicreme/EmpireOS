'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AnalyzeButton({
  decisionId,
  className = '',
}: {
  decisionId: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/decisions/${decisionId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createActions: true }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? 'Analysis failed');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="px-4 py-2 bg-empire-blue text-white text-sm rounded-lg hover:bg-empire-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-mono whitespace-nowrap"
      >
        {loading ? 'Analyzing…' : '▶ Run Analysis'}
      </button>
      {error && (
        <p className="text-xs text-empire-red font-mono mt-1">{error}</p>
      )}
    </div>
  );
}
