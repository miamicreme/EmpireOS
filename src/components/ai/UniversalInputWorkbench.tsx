'use client';

import { DragEvent, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';

type Purpose = 'general_review' | 'extract_actions' | 'risk_review' | 'decision_support';
type InputKind = 'none' | 'paste' | 'pdf' | 'docx' | 'md' | 'txt' | 'csv' | 'xlsx' | 'image';
type WorkbenchState = 'idle' | 'saving' | 'analyzing' | 'ready' | 'routing' | 'routed' | 'sending' | 'sent' | 'error';

type IngestResult = {
  documentId: string;
  duplicate: boolean;
  status: string;
  fileName: string;
  kind?: InputKind;
  extractedText: string;
  extractionStatus: string;
  extractionMethod: string | null;
  wordCount: number;
};

type AnalyzeResult = {
  artifactId: string;
  documentId?: string;
  analysisId?: string;
  routeId?: string;
  destinationModule?: string;
  routingConfidence?: number;
  routingReason?: string;
  proposedRouteActions?: string[];
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

const MAX_FILE_BYTES = 20 * 1024 * 1024;

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
      {items.length ? <ul className="mt-3 space-y-2 text-sm text-gray-200">{items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-empire-blue" />{item}</li>)}</ul> : <p className="mt-3 text-sm text-empire-muted">{empty}</p>}
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
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<string | null>(null);

  const kind = useMemo(() => detectKind(file, text), [file, text]);
  const hasInput = Boolean(file || text.trim());
  const busy = ['saving', 'analyzing', 'routing', 'sending'].includes(state);

  function resetForInputChange() {
    setResult(null);
    setAgentResult(null);
    setDocumentId(null);
    setExtractionStatus(null);
    setState('idle');
  }

  function selectFile(selected: File | null) {
    resetForInputChange();
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
    setStatus('File selected. Save and extract it before analysis.');
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function saveAndExtract() {
    if (!file || busy) return;
    setState('saving');
    setStatus('Saving the original file privately and extracting its contents…');
    try {
      const form = new FormData();
      form.set('file', file);
      const response = await fetch('/api/ai/input/ingest', { method: 'POST', body: form });
      const payload = await response.json() as { data?: IngestResult; error?: { message?: string }; message?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message || payload.message || 'Document ingestion failed.');
      setDocumentId(payload.data.documentId);
      setExtractionStatus(payload.data.extractionStatus);
      if (payload.data.extractedText) setText(payload.data.extractedText);
      setState('idle');
      setStatus(payload.data.duplicate
        ? 'This file already existed. The saved document and latest extraction were reused.'
        : payload.data.extractionStatus === 'completed'
          ? `Private document saved. ${payload.data.wordCount} words extracted.`
          : 'Private document saved. This file needs a specialized extractor or OCR before analysis.');
    } catch (error) {
      setState('error');
      setStatus(error instanceof Error ? error.message : 'Document ingestion failed.');
    }
  }

  async function analyze() {
    if (!hasInput || busy) return;
    if (file && !documentId) {
      setState('error');
      setStatus('Save and extract the selected file before analysis.');
      return;
    }
    if (!text.trim()) {
      setState('error');
      setStatus('No readable extracted text is available yet. Add text, OCR output, or a faithful image description.');
      return;
    }

    setState('analyzing');
    setStatus('Analyzing the saved document and preparing a routing proposal…');
    setResult(null);
    setAgentResult(null);
    const contentText = text.trim();
    const response = await api.post<AnalyzeResult>('/api/ai/input/analyze', {
      documentId: documentId ?? undefined,
      purpose,
      inputType: kind === 'paste' ? 'txt' : kind,
      fileName: file?.name,
      mimeType: file?.type,
      contentText,
      rows: kind === 'csv' ? rowsFromCsv(contentText) : undefined,
      imageDescription: kind === 'image' ? contentText : undefined,
      createDrafts,
      allowVision: false,
      allowDeepAnalysis: goDeeper,
    });
    if (!response.ok) {
      setState('error');
      setStatus(response.error.message);
      return;
    }
    setResult(response.data);
    setState('ready');
    setStatus(`Analysis saved. Proposed destination: ${response.data.destinationModule ?? 'inputs'}.`);
  }

  async function approveRoute() {
    if (!result?.routeId || busy) return;
    setState('routing');
    setStatus('Approving and filing the document in the proposed Empire area…');
    const response = await api.post<{ destinationModule: string; status: string }>(`/api/ai/input/routes/${result.routeId}/approve`, {});
    if (!response.ok) {
      setState('error');
      setStatus(response.error.message);
      return;
    }
    setState('routed');
    setStatus(`Document filed in ${response.data.destinationModule}.`);
  }

  async function sendToAgent() {
    if (!result || busy) return;
    setState('sending');
    setStatus('Sending the reviewed artifact through the single agent path…');
    const response = await api.post<{ answer?: string; runId?: string }>('/api/ai/agent/run', {
      command: result.nextCommandHint,
      inputArtifactIds: [result.artifactId],
      goDeeper,
      useResearch: result.artifactType === 'research_needed',
    });
    if (!response.ok) {
      setState('error');
      setStatus(response.error.message);
      return;
    }
    setAgentResult(response.data.answer ?? `Agent run created: ${response.data.runId ?? 'pending'}`);
    setState('sent');
    setStatus('Artifact sent to the agent. No external action was executed.');
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="rounded-3xl border border-border bg-surface-2/75 p-5 shadow-xl shadow-black/10 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-empire-blue">Step 1 · Save and extract</p>
              <h2 className="mt-2 text-xl font-semibold text-gray-100">Create one durable source record</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-empire-muted">The original file is stored privately, duplicate-checked, extracted, analyzed, and linked to every artifact or module record created from it.</p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">Private storage</span>
          </div>

          <label onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={onDrop} className={`mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center transition ${dragging ? 'border-empire-blue bg-empire-blue/10' : 'border-empire-blue/40 bg-surface-0 hover:border-empire-blue/70'}`}>
            <span className="text-base font-semibold text-gray-100">Drop a document here or browse</span>
            <span className="mt-2 max-w-xl text-sm leading-6 text-empire-muted">PDF, DOCX, TXT, MD, CSV, XLSX, screenshots, and images. PDF/TXT/MD/CSV extraction runs now; specialized DOCX/XLSX/OCR processing remains explicitly flagged when required.</span>
            <span className="mt-3 rounded-full border border-border px-3 py-1 text-xs text-empire-muted">20 MB maximum</span>
            <input ref={fileInputRef} className="sr-only" type="file" accept=".pdf,.docx,.txt,.md,.csv,.xlsx,image/*" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
          </label>

          <div className="mt-4 rounded-2xl border border-border bg-surface-0 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-empire-muted">Current source</p>
                <p className="mt-1 text-sm font-medium text-gray-100">{file?.name ?? 'Pasted text only'}</p>
                {file && <p className="mt-1 text-xs text-empire-muted">{formatBytes(file.size)} · {kind}</p>}
                {documentId && <p className="mt-2 break-all font-mono text-[11px] text-empire-blue">Document {documentId}</p>}
                {extractionStatus && <p className="mt-1 text-xs text-empire-muted">Extraction: {extractionStatus}</p>}
              </div>
              {file && <Button variant="secondary" onClick={saveAndExtract} disabled={busy || Boolean(documentId)}>{state === 'saving' ? 'Saving…' : documentId ? 'Saved' : 'Save & extract'}</Button>}
            </div>
          </div>

          <label className="mt-4 block text-sm font-medium text-gray-200">Purpose
            <select value={purpose} onChange={(event) => setPurpose(event.target.value as Purpose)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface-0 px-3 text-sm text-gray-100 outline-none focus:border-empire-blue">
              <option value="general_review">General review</option><option value="extract_actions">Extract actions and owners</option><option value="risk_review">Find risks and missing controls</option><option value="decision_support">Decision support</option>
            </select>
          </label>

          <label className="mt-4 block text-sm font-medium text-gray-200">Extracted or pasted content
            <textarea value={text} onChange={(event) => { setText(event.target.value); setResult(null); setAgentResult(null); setState('idle'); }} placeholder="Extracted document text, notes, transcript, CSV rows, OCR output, or image description…" className="mt-2 min-h-44 w-full rounded-2xl border border-border bg-surface-0 p-4 text-sm leading-6 text-gray-100 outline-none transition placeholder:text-empire-muted/70 focus:border-empire-blue focus:ring-4 focus:ring-empire-blue/10" />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-0 p-3 text-sm text-gray-200"><input className="mt-1" type="checkbox" checked={goDeeper} onChange={(event) => setGoDeeper(event.target.checked)} /><span><strong className="block">Go deeper</strong><span className="text-xs leading-5 text-empire-muted">Allow deeper analysis for high-stakes documents.</span></span></label>
            <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-0 p-3 text-sm text-gray-200"><input className="mt-1" type="checkbox" checked={createDrafts} onChange={(event) => setCreateDrafts(event.target.checked)} /><span><strong className="block">Create safe drafts</strong><span className="text-xs leading-5 text-empire-muted">Recommendations remain approval-gated.</span></span></label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"><Button onClick={analyze} disabled={!hasInput || busy || Boolean(file && !documentId)}>{state === 'analyzing' ? 'Analyzing…' : 'Analyze & route'}</Button><p className={`text-xs font-mono ${state === 'error' ? 'text-red-300' : 'text-empire-blue'}`}>{status}</p></div>
        </section>

        <section className="rounded-3xl border border-border bg-surface-2/75 p-5 shadow-xl shadow-black/10 md:p-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-empire-blue">Step 2 · Review intelligence</p>
          <h2 className="mt-2 text-xl font-semibold text-gray-100">Analysis and proposed destination</h2>
          {!result ? <div className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-0 px-6 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-xl text-empire-muted">◌</div><p className="mt-4 font-medium text-gray-200">No analysis yet</p><p className="mt-2 max-w-sm text-sm leading-6 text-empire-muted">Save the source, extract its contents, then analyze it to create a durable artifact and routing proposal.</p></div> : <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-empire-blue/25 bg-empire-blue/10 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-mono text-xs uppercase tracking-[0.16em] text-empire-blue">{result.artifactType}</p><span className="text-xs text-empire-muted">{result.provider ?? 'system analysis'}</span></div><p className="mt-3 text-sm leading-6 text-gray-100">{result.summary}</p></div>
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4"><p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-300">Proposed destination</p><p className="mt-2 text-lg font-semibold text-gray-100">{result.destinationModule ?? 'inputs'}</p><p className="mt-2 text-sm leading-6 text-gray-300">{result.routingReason}</p><p className="mt-2 text-xs text-empire-muted">Confidence: {Math.round((result.routingConfidence ?? 0) * 100)}%</p>{result.proposedRouteActions?.length ? <ul className="mt-3 space-y-1 text-sm text-gray-200">{result.proposedRouteActions.map((item) => <li key={item}>• {item}</li>)}</ul> : null}<Button onClick={approveRoute} disabled={!result.routeId || busy || state === 'routed'}>{state === 'routing' ? 'Filing…' : state === 'routed' ? 'Filed' : 'Approve destination'}</Button></div>
            <div className="grid gap-3 md:grid-cols-2"><ListBlock title="Key facts" items={result.keyFacts} empty="No key facts extracted." /><ListBlock title="Risks" items={result.risks} empty="No material risks identified." /><ListBlock title="Opportunities" items={result.opportunities} empty="No opportunities identified." /><ListBlock title="Recommended actions" items={result.recommendedActions} empty="No actions recommended." /></div>
            <div className="rounded-xl border border-border bg-surface-0 p-4 text-sm text-gray-200">Safe action drafts awaiting owner approval: <strong>{result.actionDraftIds.length}</strong></div>
            {agentResult && <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4"><p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-300">Agent result</p><p className="mt-2 text-sm leading-6 text-gray-100">{agentResult}</p></div>}
          </div>}
        </section>
      </div>

      <section className="rounded-3xl border border-border bg-surface-2/75 p-5 md:p-6"><div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-empire-blue">Step 3 · Governed handoff</p><h2 className="mt-2 text-xl font-semibold text-gray-100">Send the linked artifact to the agent</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-empire-muted">The original file, extraction, analysis, route, artifact, drafts, and agent run stay linked. External actions remain approval-gated.</p></div><Button variant="secondary" onClick={sendToAgent} disabled={!result || busy}>{state === 'sending' ? 'Sending…' : 'Send to Agent'}</Button></div></section>
    </div>
  );
}
