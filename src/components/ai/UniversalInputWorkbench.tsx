'use client';

import { DragEvent, useMemo, useRef, useState } from 'react';
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

type Purpose = 'general_review' | 'extract_actions' | 'risk_review' | 'decision_support';
type InputKind = 'none' | 'paste' | 'pdf' | 'docx' | 'md' | 'txt' | 'csv' | 'xlsx' | 'image';
type WorkbenchState = 'idle' | 'analyzing' | 'ready' | 'sending' | 'sent' | 'error';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const supportedTextExtensions = ['.txt', '.md', '.csv'];

function detectKind(file: File | null, text: string): InputKind {
  if (!file) return text.trim() ? 'paste' : 'none';
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
  const headers = headerLine.split(',').map((header) => header.trim());
  return lines.slice(0, 500).map((line) => Object.fromEntries(line.split(',').map((value, index) => {
    const raw = value.trim();
    const numeric = Number(raw);
    return [headers[index] ?? `column_${index + 1}`, Number.isFinite(numeric) && raw !== '' ? numeric : raw];
  })));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ListBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-0 p-4">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-empire-muted">{title}</p>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-gray-200">
          {items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-empire-blue" />{item}</li>)}
        </ul>
      ) : <p className="mt-3 text-sm text-empire-muted">{empty}</p>}
    </div>
  );
}

export function UniversalInputWorkbench() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [purpose, setPurpose] = useState<Purpose>('general_review');
  const [goDeeper, setGoDeeper] = useState(false);
  const [createDrafts, setCreateDrafts] = useState(true);
  const [state, setState] = useState<WorkbenchState>('idle');
  const [status, setStatus] = useState('Ready for an owner-only input.');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [agentResult, setAgentResult] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const kind = useMemo(() => detectKind(file, text), [file, text]);
  const hasInput = Boolean(file || text.trim());
  const requiresPastedExtraction = Boolean(file && ['pdf', 'docx', 'xlsx', 'image'].includes(kind));
  const canAnalyze = hasInput && (!requiresPastedExtraction || Boolean(text.trim())) && !['analyzing', 'sending'].includes(state);

  function selectFile(selected: File | null) {
    setResult(null);
    setAgentResult(null);
    setState('idle');
    if (!selected) {
      setFile(null);
      setStatus('Ready for an owner-only input.');
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFile(null);
      setState('error');
      setStatus('That file is larger than the 20 MB intake limit.');
      return;
    }
    setFile(selected);
    const selectedKind = detectKind(selected, '');
    if (['pdf', 'docx', 'xlsx', 'image'].includes(selectedKind)) {
      setStatus('File selected. Paste extracted text or a faithful description before analysis.');
    } else {
      setStatus('File selected and ready to analyze.');
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function readFileText(selected: File) {
    const lower = selected.name.toLowerCase();
    if (supportedTextExtensions.some((extension) => lower.endsWith(extension))) return selected.text();
    return text.trim();
  }

  async function analyze() {
    if (!canAnalyze) {
      setState('error');
      setStatus(requiresPastedExtraction
        ? 'Paste extracted text or an image description before analyzing this file type.'
        : 'Add a file or paste text before analyzing.');
      return;
    }

    setState('analyzing');
    setStatus('Analyzing input and creating a safe artifact…');
    setResult(null);
    setAgentResult(null);

    try {
      const contentText = file ? await readFileText(file) : text.trim();
      const payload = {
        inputType: kind === 'paste' ? 'txt' : kind,
        fileName: file?.name,
        mimeType: file?.type,
        contentText,
        rows: kind === 'csv' ? rowsFromCsv(contentText) : undefined,
        imageDescription: kind === 'image' ? text.trim() : undefined,
        purpose,
        createDrafts,
        allowVision: false,
        allowDeepAnalysis: goDeeper,
      };
      const response = await api.post<AnalyzeResult>('/api/ai/input/analyze', payload);
      if (!response.ok) {
        setState('error');
        setStatus(response.error.message);
        return;
      }
      setResult(response.data);
      setState('ready');
      setStatus(response.data.artifactType === 'research_needed'
        ? 'Artifact created. Research is recommended before a final decision.'
        : 'Artifact created and ready for owner review.');
    } catch (error) {
      setState('error');
      setStatus(error instanceof Error ? error.message : 'Input analysis failed. Please try again.');
    }
  }

  async function sendToAgent() {
    if (!result || state === 'sending') return;
    setState('sending');
    setStatus('Sending the reviewed artifact through the single agent path…');
    setAgentResult(null);

    try {
      const response = await api.post<{ answer?: string; runId?: string }>('/api/ai/agent/run', {
        command: result.nextCommandHint || `Review this artifact and recommend the best next move: ${result.summary}`,
        inputArtifactIds: [result.artifactId],
        goDeeper,
        useResearch: result.artifactType === 'research_needed',
        createDrafts,
      });
      if (!response.ok) {
        setState('error');
        setStatus(response.error.message);
        return;
      }
      setAgentResult(response.data.answer ?? `Agent run created: ${response.data.runId ?? 'pending'}`);
      setState('sent');
      setStatus('Artifact sent to the agent. No external action was executed.');
    } catch (error) {
      setState('error');
      setStatus(error instanceof Error ? error.message : 'Agent handoff failed. Please try again.');
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="rounded-3xl border border-border bg-surface-2/75 p-5 shadow-xl shadow-black/10 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-empire-blue">Step 1 · Intake</p>
              <h2 className="mt-2 text-xl font-semibold text-gray-100">Add one trusted input</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-empire-muted">Nothing uploads automatically. Select or drop one file, or paste the exact text you want Empire to review.</p>
            </div>
            <span className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${state === 'error' ? 'border-red-400/30 bg-red-400/10 text-red-300' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'}`}>
              {state === 'error' ? 'Needs attention' : 'Owner-only'}
            </span>
          </div>

          <label
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center transition ${dragging ? 'border-empire-blue bg-empire-blue/10' : 'border-empire-blue/40 bg-surface-0 hover:border-empire-blue/70'}`}
          >
            <span className="text-base font-semibold text-gray-100">Drop a file here or browse</span>
            <span className="mt-2 max-w-xl text-sm leading-6 text-empire-muted">TXT, MD, and CSV can be read directly. For PDF, DOCX, XLSX, screenshots, and images, paste extracted text or a faithful description below.</span>
            <span className="mt-3 rounded-full border border-border px-3 py-1 text-xs text-empire-muted">20 MB maximum</span>
            <input ref={fileInputRef} className="sr-only" type="file" accept=".pdf,.docx,.txt,.md,.csv,.xlsx,image/*" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
          </label>

          <div className="mt-4 rounded-2xl border border-border bg-surface-0 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-empire-muted">Current file</p>
                <p className="mt-1 text-sm font-medium text-gray-100">{file?.name ?? 'No file selected'}</p>
                {file && <p className="mt-1 text-xs text-empire-muted">{formatBytes(file.size)} · {kind}</p>}
              </div>
              {file && <button type="button" onClick={() => { selectFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-sm font-medium text-empire-blue hover:text-white">Remove file</button>}
            </div>
          </div>

          <label className="mt-4 block text-sm font-medium text-gray-200">
            Purpose
            <select value={purpose} onChange={(event) => setPurpose(event.target.value as Purpose)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface-0 px-3 text-sm text-gray-100 outline-none focus:border-empire-blue">
              <option value="general_review">General review</option>
              <option value="extract_actions">Extract actions and owners</option>
              <option value="risk_review">Find risks and missing controls</option>
              <option value="decision_support">Decision support</option>
            </select>
          </label>

          <label className="mt-4 block text-sm font-medium text-gray-200">
            Paste text or extraction
            <textarea
              value={text}
              onChange={(event) => { setText(event.target.value); setResult(null); setAgentResult(null); setState('idle'); setStatus('Input changed. Analyze when ready.'); }}
              placeholder="Paste notes, extracted document text, CSV rows, a transcript, or a screenshot description…"
              className="mt-2 min-h-40 w-full rounded-2xl border border-border bg-surface-0 p-4 text-sm leading-6 text-gray-100 outline-none transition placeholder:text-empire-muted/70 focus:border-empire-blue focus:ring-4 focus:ring-empire-blue/10"
            />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-0 p-3 text-sm text-gray-200"><input className="mt-1" type="checkbox" checked={goDeeper} onChange={(event) => setGoDeeper(event.target.checked)} /><span><strong className="block">Go deeper</strong><span className="text-xs leading-5 text-empire-muted">Allow more analysis when the artifact needs it.</span></span></label>
            <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-0 p-3 text-sm text-gray-200"><input className="mt-1" type="checkbox" checked={createDrafts} onChange={(event) => setCreateDrafts(event.target.checked)} /><span><strong className="block">Create safe drafts</strong><span className="text-xs leading-5 text-empire-muted">Draft recommendations only; no external execution.</span></span></label>
          </div>

          {requiresPastedExtraction && !text.trim() && <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-200">This file type is not read directly in the browser. Paste extracted text or a faithful image description before analysis.</p>}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={analyze} disabled={!canAnalyze}>{state === 'analyzing' ? 'Analyzing…' : 'Analyze input'}</Button>
            <p className={`text-xs font-mono ${state === 'error' ? 'text-red-300' : 'text-empire-blue'}`}>{status}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-surface-2/75 p-5 shadow-xl shadow-black/10 md:p-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-empire-blue">Step 2 · Review</p>
          <h2 className="mt-2 text-xl font-semibold text-gray-100">Artifact intelligence</h2>
          <p className="mt-2 text-sm leading-6 text-empire-muted">Review what Empire extracted before you hand anything to the agent.</p>

          {!result ? (
            <div className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-0 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-xl text-empire-muted">◌</div>
              <p className="mt-4 font-medium text-gray-200">No artifact yet</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-empire-muted">Analyze an input to see the summary, facts, risks, opportunities, recommended actions, and draft count.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-empire-blue/25 bg-empire-blue/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-empire-blue">{result.artifactType}</p>
                  <span className="text-xs text-empire-muted">{result.provider ?? 'system analysis'}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-gray-100">{result.summary}</p>
                <p className="mt-3 break-all font-mono text-[11px] text-empire-muted">Artifact {result.artifactId}</p>
              </div>

              {result.artifactType === 'research_needed' && <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-200">Research is recommended before relying on this artifact for a final decision.</p>}

              <div className="grid gap-3 md:grid-cols-2">
                <ListBlock title="Key facts" items={result.keyFacts} empty="No key facts extracted." />
                <ListBlock title="Risks" items={result.risks} empty="No material risks identified." />
                <ListBlock title="Opportunities" items={result.opportunities} empty="No opportunities identified." />
                <ListBlock title="Recommended actions" items={result.recommendedActions} empty="No actions recommended." />
              </div>

              <div className="rounded-xl border border-border bg-surface-0 p-4 text-sm text-gray-200">
                Safe action drafts awaiting owner approval: <strong>{result.actionDraftIds.length}</strong>
              </div>

              {agentResult && <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4"><p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-300">Agent result</p><p className="mt-2 text-sm leading-6 text-gray-100">{agentResult}</p></div>}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-border bg-surface-2/75 p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-empire-blue">Step 3 · Governed handoff</p>
            <h2 className="mt-2 text-xl font-semibold text-gray-100">Send the reviewed artifact to the agent</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-empire-muted">This uses the single <code className="text-gray-300">POST /api/ai/agent/run</code> path with the artifact ID. It may create drafts for review, but it does not approve or execute external actions.</p>
          </div>
          <Button variant="secondary" onClick={sendToAgent} disabled={!result || state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send to Agent'}</Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-0 p-4">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-empire-muted">Safety contract</p>
        <div className="mt-3 grid gap-2 text-sm text-gray-300 md:grid-cols-2 xl:grid-cols-4">
          <p>• No public file URLs are returned.</p>
          <p>• Nothing uploads without deliberate selection.</p>
          <p>• Unsupported files require pasted extraction.</p>
          <p>• External actions remain approval-gated.</p>
        </div>
      </section>
    </div>
  );
}
