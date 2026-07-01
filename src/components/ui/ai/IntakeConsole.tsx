'use client';

/**
 * Document intake surface. Paste any document; the agent reviews it, decides
 * which module it belongs to, extracts the key fields, and drafts next actions.
 * Talks to POST /api/ai/intake.
 */
import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { postJson } from '@/lib/http';

interface ExtractedField {
  label: string;
  value: string;
}

interface SuggestedAction {
  title: string;
  description: string;
  priority: string;
}

interface IntakeOutput {
  destinationModule: string;
  documentType: string;
  title: string;
  summary: string;
  extractedFields: ExtractedField[];
  suggestedActions: SuggestedAction[];
  sensitive: boolean;
  reasoning: string;
  confidence: number;
}

interface IntakeResponse {
  output: IntakeOutput;
  documentId: string | null;
  drafts: Array<{ id: string; title: string }>;
}

const MODULE_LABELS: Record<string, string> = {
  'cash-engine': 'Cash Engine',
  'job-hunt': 'Job Hunt',
  'followup-crm': 'Follow-ups',
  'credit-funding': 'Credit & Funding',
  projects: 'Projects',
  acquisitions: 'Acquisitions',
  none: 'No module (kept as a general document)',
};

function confidenceTone(n: number): 'green' | 'yellow' | 'red' {
  if (n >= 0.66) return 'green';
  if (n >= 0.4) return 'yellow';
  return 'red';
}

export function IntakeConsole() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeResponse | null>(null);

  async function submit() {
    if (!content.trim()) {
      setError('Paste a document to review.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await postJson<IntakeResponse>('/api/ai/intake', {
        title: title.trim() || undefined,
        content: content.trim(),
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Intake failed.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setTitle('');
    setContent('');
    setError(null);
  }

  const out = result?.output;

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader
          title="Document intake"
          subtitle="Paste anything — the agent decides where it belongs and drafts the work"
        />
        <div className="p-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional title (e.g. 'Chase statement — June')"
            className="w-full h-9 px-3 rounded-lg bg-surface-2 border border-border text-sm text-gray-100 placeholder:text-empire-muted focus:outline-none focus:border-empire-blue"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            placeholder="Paste the document text here — an invoice, job posting, credit report, deal memo, contact details, project notes…"
            className="w-full resize-y rounded-lg bg-surface-2 border border-border px-3 py-2.5 text-sm text-gray-100 placeholder:text-empire-muted/70 focus:outline-none focus:border-empire-blue"
          />
          <div className="flex items-center gap-2">
            <Button onClick={submit} loading={busy} disabled={!content.trim()} size="lg">
              Review &amp; route
            </Button>
            {result && (
              <Button onClick={reset} variant="ghost">
                New document
              </Button>
            )}
          </div>
          {error && <p className="text-xs text-empire-red font-mono">{error}</p>}
        </div>
      </Card>

      {out && (
        <Card>
          <CardHeader
            title={out.title || 'Reviewed'}
            subtitle={`${out.documentType} · ${result?.documentId ? 'saved' : 'not saved'}`}
          />
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="green">→ {MODULE_LABELS[out.destinationModule] ?? out.destinationModule}</Badge>
              <Badge variant={confidenceTone(out.confidence)}>{Math.round(out.confidence * 100)}% confident</Badge>
              {out.sensitive && <Badge variant="red">sensitive</Badge>}
            </div>

            {out.summary && <p className="text-sm text-gray-200 leading-relaxed">{out.summary}</p>}
            {out.reasoning && <p className="text-xs text-empire-muted leading-relaxed">Why: {out.reasoning}</p>}

            {out.extractedFields.length > 0 && (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-empire-muted mb-2">
                  Extracted
                </p>
                <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                  {out.extractedFields.map((f, i) => (
                    <div key={i} className="flex gap-3 px-3 py-2 text-sm">
                      <span className="w-40 shrink-0 text-empire-muted">{f.label}</span>
                      <span className="text-gray-200 break-words">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result && result.drafts.length > 0 && (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-empire-muted mb-2">
                  Drafted actions (pending approval)
                </p>
                <ul className="space-y-1.5">
                  {result.drafts.map((d) => (
                    <li key={d.id} className="text-sm text-gray-200 flex items-start gap-2">
                      <span className="text-empire-blue">▹</span>
                      {d.title}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-empire-muted mt-2">
                  Review and approve these in <span className="text-gray-300">Actions</span>.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
