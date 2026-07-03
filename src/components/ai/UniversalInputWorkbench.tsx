'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';

type AnalyzeResult = {
  artifactId: string;
  artifactType: string;
  summary: string;
  keyFacts: string[];
  risks: string[];
  opportunities: string[];
  recommendedActions: string[];
  actionDraftIds: string[];
  provider: string | null;
  nextCommandHint: string;
};

function detectKind(file: File | null, text: string) {
  if (!file) return text.trim() ? 'paste' : 'text';
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.md')) return 'md';
  if (name.endsWith('.txt')) return 'txt';
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.xlsx')) return 'xlsx';
  if (file.type.startsWith('image/')) return 'image';
  return 'txt';
}

function rowsFromCsv(text: string) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/).filter(Boolean);
  if (!headerLine) return [];
  const headers = headerLine.split(',').map((h) => h.trim());
  return lines.slice(0, 500).map((line) => Object.fromEntries(line.split(',').map((value, index) => {
    const raw = value.trim();
    const n = Number(raw);
    return [headers[index] ?? `column_${index + 1}`, Number.isFinite(n) && raw !== '' ? n : raw];
  })));
}

export function UniversalInputWorkbench() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [goDeeper, setGoDeeper] = useState(false);
  const [createDrafts, setCreateDrafts] = useState(true);
  const [status, setStatus] = useState('Ready');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [agentResult, setAgentResult] = useState<string | null>(null);

  const kind = useMemo(() => detectKind(file, text), [file, text]);

  async function readFileText(selected: File) {
    if (selected.type.startsWith('image/')) return '';
    if (selected.name.toLowerCase().endsWith('.pdf')) return `PDF selected: ${selected.name}. Use extract route or paste extracted text for local proof.`;
    if (selected.name.toLowerCase().endsWith('.docx')) return `DOCX selected: ${selected.name}. Use extract route or paste extracted text for local proof.`;
    return selected.text();
  }

  async function analyze() {
    setStatus('Analyzing input...');
    setAgentResult(null);
    const contentText = file ? await readFileText(file) : text;
    const payload = {
      inputType: kind === 'paste' ? 'txt' : kind,
      fileName: file?.name,
      mimeType: file?.type,
      contentText,
      rows: kind === 'csv' ? rowsFromCsv(contentText) : undefined,
      imageDescription: kind === 'image' ? 'Owner-selected image or screenshot awaiting vision provider analysis.' : undefined,
      createDrafts,
      allowVision: kind === 'image',
      allowDeepAnalysis: goDeeper,
    };
    const response = await api.post<AnalyzeResult>('/api/ai/input/analyze', payload);
    if (!response.ok) {
      setStatus(response.error.message);
      return;
    }
    setResult(response.data);
    setStatus(response.data.artifactType === 'research_needed' ? 'Research needed before final advice' : 'Artifact created');
  }

  async function sendToAgent() {
    if (!result) return;
    setStatus('Sending artifact to agent...');
    const response = await api.post<{ answer?: string; runId?: string }>('/api/ai/agent/run', {
      command: `Use this input artifact and tell me the best next move: ${result.summary}`,
      inputArtifactIds: [result.artifactId],
      goDeeper,
      useResearch: result.artifactType === 'research_needed',
    });
    if (!response.ok) {
      setStatus(response.error.message);
      return;
    }
    setAgentResult(response.data.answer ?? `Run created: ${response.data.runId}`);
    setStatus('Sent to agent');
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-2xl border border-border bg-surface-2/70 p-5">
        <h2 className="text-lg font-semibold text-gray-100">Drop, paste, or attach</h2>
        <label className="mt-4 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-empire-blue/50 bg-surface-0 p-6 text-center text-sm text-empire-muted">
          <span className="text-base font-semibold text-gray-100">Drop anything here</span>
          <span className="mt-2">PDF, DOCX, TXT/MD, CSV/XLSX, image, screenshot, or transcript</span>
          <input className="sr-only" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        {file && <p className="mt-3 text-sm text-gray-300">Current file status: selected <span className="font-mono text-empire-blue">{file.name}</span></p>}
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste extracted text, transcript, CSV, notes, or screenshot description..."
          className="mt-4 min-h-32 w-full rounded-xl border border-border bg-surface-0 p-3 text-sm text-gray-100 outline-none focus:border-empire-blue"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-empire-muted">
          <span>Detected input kind: <span className="font-mono text-gray-100">{kind}</span></span>
          <label className="flex items-center gap-2"><input type="checkbox" checked={goDeeper} onChange={(e) => setGoDeeper(e.target.checked)} /> Go deeper</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={createDrafts} onChange={(e) => setCreateDrafts(e.target.checked)} /> Create drafts</label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={analyze}>Analyze input</Button>
          <Button variant="secondary" onClick={sendToAgent} disabled={!result}>Send to Agent</Button>
        </div>
        <p className="mt-3 text-xs font-mono text-empire-blue">{status}</p>
      </section>

      <section className="rounded-2xl border border-border bg-surface-2/70 p-5">
        <h2 className="text-lg font-semibold text-gray-100">Extracted summary + next actions</h2>
        {!result ? (
          <p className="mt-3 text-sm text-empire-muted">Analyze an input to see created artifact, recommended actions, and approval-gated drafts.</p>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <div className="rounded-xl border border-border bg-surface-0 p-3">
              <p className="font-mono text-xs uppercase text-empire-muted">Created artifact</p>
              <p className="mt-1 text-gray-100">{result.artifactType} — {result.artifactId}</p>
              <p className="mt-2 text-empire-muted">{result.summary}</p>
            </div>
            {result.artifactType === 'research_needed' && <p className="rounded-xl border border-empire-yellow/30 bg-empire-yellow/10 p-3 text-empire-yellow">Research needed: use Go deeper or connect research before final advice.</p>}
            <div>
              <p className="font-mono text-xs uppercase text-empire-muted">Recommended next actions</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-200">{result.recommendedActions.map((action) => <li key={action}>{action}</li>)}</ul>
            </div>
            <p className="text-empire-muted">Action drafts awaiting approval: <span className="text-gray-100">{result.actionDraftIds.length}</span></p>
            {agentResult && <p className="rounded-xl border border-border bg-surface-0 p-3 text-gray-200">Agent result: {agentResult}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
