'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewActionPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [impact, setImpact] = useState(5);
  const [urgency, setUrgency] = useState(5);
  const [effort, setEffort] = useState(5);
  const [dueAt, setDueAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          category,
          priority,
          impact_score: impact,
          urgency_score: urgency,
          effort_score: effort,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? 'Failed to create action');
        return;
      }
      router.push('/actions');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  function ScoreSlider({
    label,
    value,
    onChange,
    description: desc,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    description: string;
  }) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-mono text-empire-muted uppercase tracking-wider">{label}</label>
          <span className="text-sm font-mono text-gray-200">{value}</span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-empire-blue"
        />
        <p className="text-xs text-empire-muted mt-0.5">{desc}</p>
      </div>
    );
  }

  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-100">New Action</h1>
          <p className="text-sm text-empire-muted">Add an item to the action queue.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="px-3 py-2 bg-empire-red/10 border border-empire-red/20 rounded text-sm text-empire-red font-mono">
              {error}
            </div>
          )}

          <div className="bg-surface-1 border border-border rounded-lg p-5 space-y-4">
            <div>
              <label className="block text-xs font-mono text-empire-muted mb-1.5 uppercase tracking-wider">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={300}
                placeholder="What needs to be done?"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-empire-muted focus:outline-none focus:border-empire-blue transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-empire-muted mb-1.5 uppercase tracking-wider">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional detail"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-empire-muted focus:outline-none focus:border-empire-blue transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-empire-muted mb-1.5 uppercase tracking-wider">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-empire-blue"
                >
                  {['cash','job','followup','credit','project','acquisition','review','admin','general'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-empire-muted mb-1.5 uppercase tracking-wider">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-empire-blue"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-empire-muted mb-1.5 uppercase tracking-wider">Due Date</label>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-empire-blue"
              />
            </div>
          </div>

          <div className="bg-surface-1 border border-border rounded-lg p-5 space-y-5">
            <p className="text-xs font-mono text-empire-muted uppercase tracking-wider">Rank Inputs</p>
            <ScoreSlider
              label="Impact (0–10)"
              value={impact}
              onChange={setImpact}
              description="How much does this move the needle?"
            />
            <ScoreSlider
              label="Urgency (0–10)"
              value={urgency}
              onChange={setUrgency}
              description="How time-sensitive is this?"
            />
            <ScoreSlider
              label="Effort (0–10)"
              value={effort}
              onChange={setEffort}
              description="How much work does this require? (higher = harder)"
            />
            <p className="text-xs font-mono text-empire-muted">
              Rank = impact + urgency + confidence − effort
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-empire-blue text-white text-sm rounded-lg hover:bg-empire-blue/90 disabled:opacity-50 transition-colors font-mono"
            >
              {loading ? 'Creating…' : 'Create Action'}
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
