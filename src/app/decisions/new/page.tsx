'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewDecisionPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState('');
  const [type, setType] = useState('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, question, context: context || null, decision_type: type }),
      });
      const json = (await res.json()) as { ok: boolean; data?: { id: string }; error?: { message: string } };
      if (!json.ok || !json.data) {
        setError(json.error?.message ?? 'Failed to create decision');
        return;
      }
      router.push(`/decisions/${json.data.id}`);
    } catch {
      setError('Network error — check your connection');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-100">New Decision</h1>
          <p className="text-sm text-empire-muted">Define the question you need answered.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-1 border border-border rounded-lg p-5 space-y-5">
          {error && (
            <div className="px-3 py-2 bg-empire-red/10 border border-empire-red/20 rounded text-sm text-empire-red font-mono">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-empire-muted mb-1.5 uppercase tracking-wider">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={300}
              placeholder="e.g. Should I take the offer?"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-empire-muted focus:outline-none focus:border-empire-blue transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-empire-muted mb-1.5 uppercase tracking-wider">
              Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
              maxLength={2000}
              rows={3}
              placeholder="What specifically do you need decided? Be concrete."
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-empire-muted focus:outline-none focus:border-empire-blue transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-empire-muted mb-1.5 uppercase tracking-wider">
              Context <span className="text-empire-muted normal-case font-sans">(optional)</span>
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              maxLength={20000}
              rows={5}
              placeholder="Background, facts, constraints, numbers. No SSNs, EINs, or account numbers — these are blocked before AI analysis."
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-empire-muted focus:outline-none focus:border-empire-blue transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-empire-muted mb-1.5 uppercase tracking-wider">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-empire-blue transition-colors"
            >
              <option value="general">General</option>
              <option value="cash">Cash</option>
              <option value="career">Career</option>
              <option value="deal">Deal</option>
              <option value="risk">Risk</option>
              <option value="strategic">Strategic</option>
            </select>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-empire-blue text-white text-sm rounded-lg hover:bg-empire-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-mono"
            >
              {loading ? 'Creating…' : 'Create Decision'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2 text-sm text-empire-muted hover:text-gray-100 transition-colors font-mono"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
