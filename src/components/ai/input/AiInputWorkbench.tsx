'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { FileUploadPanel } from './FileUploadPanel';
import { InputArtifactResult, type InputAnalyzeResult, type InputUploadResult, RunLink } from './InputArtifactResult';
import { SendToAgentPanel } from './SendToAgentPanel';

type Phase = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';

type AgentRunResult = {
  runId: string;
  threadId: string;
  status: string;
  answer: string;
  reasoningSummary: string;
  confidence: number;
  riskLevel: string;
  actionDrafts: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    priority: string;
    approvalStatus: string;
  }>;
  providerSummary: { providersUsed: string[]; fallbackUsed: boolean; latencyMs: number };
};

function detectKind(file: File | null, text: string): string {
  if (!file) return text.trim() ? 'txt' : 'txt';
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.md')) return 'md';
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.xlsx')) return 'xlsx';
  if (name.endsWith('.txt')) return 'txt';
  if (file.type.startsWith('image/')) return name.includes('screen') ? 'screenshot' : 'image';
  return 'txt';
}

function parseCsvRows(text: string): Array<Record<string, string | number | boolean | null>> {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length < 2) return [];
  const headers = rows[0]!.split(',').map((value) => value.trim());
  return rows.slice(1, 501).map((row) =>
    Object.fromEntries(
      row.split(',').map((value, index) => {
        const raw = value.trim();
        const numeric = Number(raw);
        return [headers[index] ?? `column_${index + 1}`, raw === '' ? null : Number.isFinite(numeric) ? numeric : raw];
      }),
    ),
  );
}

async function extractTextFromFile(file: File): Promise<string | null> {
  const lower = file.name.toLowerCase();
  if (file.type.startsWith('text/') || /\.(txt|md|csv|json|log|rtf|html?)$/i.test(lower)) {
    return file.text();
  }

  if (lower.endsWith('.pdf')) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/ai/intake/extract', { method: 'POST', body: form });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error?.message ?? `Could not extract PDF text (${res.status}).`);
    }
    return (json.data as { text: string }).text;
  }

  return null;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image bytes.'));
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? value.split(',')[1] ?? '' : value);
    };
    reader.readAsDataURL(file);
  });
}

async function buildAnalyzePayload(file: File | null, text: string, purpose: string) {
  const kind = detectKind(file, text);
  if (!file) {
    const payload: Record<string, unknown> = {
      inputType: text.trim() ? 'txt' : 'txt',
      contentText: text.trim(),
      createDrafts: true,
      allowDeepAnalysis: purpose === 'research',
    };
    return payload;
  }

  const fileName = file.name;
  const mimeType = file.type || undefined;
  const lower = file.name.toLowerCase();
  const payload: Record<string, unknown> = {
    inputType: kind,
    fileName,
    mimeType,
    createDrafts: true,
    allowDeepAnalysis: purpose === 'research',
  };

  if (kind === 'csv') {
    const csvSource = text.trim() || '';
    payload.rows = parseCsvRows(csvSource);
    payload.contentText = csvSource || `CSV file ${fileName} was selected for browser analysis.`;
  } else if (kind === 'pdf' || kind === 'txt' || kind === 'md') {
    payload.contentText = text.trim();
  } else if (kind === 'docx') {
    payload.contentText = text.trim() || `DOCX file ${fileName} was selected. Paste extracted text for richer analysis.`;
  } else if (kind === 'xlsx') {
    payload.contentText = `Spreadsheet file ${fileName} was selected. Browser-side XLSX parsing is not wired in this pass; upload metadata is validated and summary will be metadata-safe.`;
  } else if (kind === 'image' || kind === 'screenshot') {
    payload.imageDescription = text.trim() || `User-selected ${kind} file ${fileName}.`;
    payload.imageBase64 = await fileToBase64(file);
    payload.allowVision = true;
  }

  if (lower.endsWith('.xlsx')) payload.inputType = 'xlsx';
  return payload;
}

function isUnavailable(err: string) {
  return /\(404\)|not wired|unexpected response/i.test(err);
}

export function AiInputWorkbench() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [purpose, setPurpose] = useState('general');
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('Ready for an owner-only input.');
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<InputUploadResult | null>(null);
  const [analysis, setAnalysis] = useState<InputAnalyzeResult | null>(null);
  const [runResult, setRunResult] = useState<AgentRunResult | null>(null);
  const [notWired, setNotWired] = useState(false);

  const detectedKind = useMemo(() => detectKind(file, text), [file, text]);
  const fileName = file?.name ?? 'No file selected';

  async function uploadSelectedFile(selected: File) {
    const response = await api.post<InputUploadResult>('/api/ai/input/upload', {
      fileName: selected.name,
      mimeType: selected.type || 'application/octet-stream',
      sizeBytes: selected.size,
    });
    if (!response.ok) throw new Error(response.error.message);
    setUploadResult(response.data);
  }

  async function analyzeInput() {
    if (!file && !text.trim()) {
      setPhase('error');
      setError('Select a file or paste text before analyzing.');
      return;
    }

    setError(null);
    setNotWired(false);
    setAnalysis(null);
    setRunResult(null);

    try {
      let extractedText: string | null = text.trim() || null;
      if (file) {
        setPhase('uploading');
        setMessage('Uploading file metadata...');
        await uploadSelectedFile(file);
        extractedText = await extractTextFromFile(file);
        if (extractedText !== null) setText(extractedText);
      }

      setPhase('analyzing');
      setMessage('Analyzing input artifact...');
      const payload = await buildAnalyzePayload(file, extractedText ?? text, purpose);
      const response = await api.post<InputAnalyzeResult>('/api/ai/input/analyze', payload);
      if (!response.ok) throw new Error(response.error.message);

      setAnalysis(response.data);
      setPhase('complete');
      setMessage('Analysis complete. Send the artifact to the agent when you are ready.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Input analysis failed.';
      setError(msg);
      setPhase('error');
      setMessage(msg);
      setNotWired(isUnavailable(msg) ? true : false);
    }
  }

  async function sendToAgent() {
    if (!analysis) return;
    setError(null);
    setMessage('Sending artifact to the agent...');
    try {
      const response = await api.post<AgentRunResult>('/api/ai/agent/run', {
        command: `Review this input artifact and produce the next owner action. Purpose: ${purpose}. Summary: ${analysis.summary}`,
        inputArtifactIds: [analysis.artifactId],
        createActionDrafts: true,
        goDeeper: purpose === 'research',
        modeHint: purpose,
      });
      if (!response.ok) throw new Error(response.error.message);
      setRunResult(response.data);
      setMessage(`Agent run created: ${response.data.runId}`);
      setPhase('complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not send the artifact to the agent.';
      setError(msg);
      setMessage(msg);
      setPhase('error');
    }
  }

  function clearFile() {
    setFile(null);
    setUploadResult(null);
    setAnalysis(null);
    setRunResult(null);
    setPhase('idle');
    setMessage('File cleared.');
    setError(null);
    setNotWired(false);
  }

  return (
    <div className="space-y-5">
      <FileUploadPanel
        file={file}
        detectedKind={detectedKind}
        text={text}
        purpose={purpose}
        status={message}
        busy={phase === 'uploading' || phase === 'analyzing'}
        onFileChange={(next) => {
          setFile(next);
          setUploadResult(null);
          setAnalysis(null);
          setRunResult(null);
          setError(null);
          setPhase('idle');
          setMessage(next ? `Selected ${next.name}` : 'Ready for an owner-only input.');
        }}
        onTextChange={(value) => {
          setText(value);
          setAnalysis(null);
          setRunResult(null);
        }}
        onPurposeChange={setPurpose}
        onAnalyze={() => void analyzeInput()}
        onClearFile={clearFile}
      />

      <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <InputArtifactResult
          fileName={fileName}
          detectedKind={detectedKind}
          uploadResult={uploadResult}
          analysis={analysis}
          error={error}
        />

        <div className="space-y-5">
          <SendToAgentPanel
            canSend={Boolean(analysis)}
            sending={phase === 'uploading' || phase === 'analyzing'}
            runId={runResult?.runId ?? null}
            onSend={() => void sendToAgent()}
          />

          <section className="rounded-3xl border border-border bg-surface-1/80 p-5 shadow-xl">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Safety contract</p>
            <ul className="mt-3 space-y-2 text-sm text-empire-muted">
              <li>No public file URLs are returned or rendered.</li>
              <li>Browser file selection is explicit; nothing auto-uploads.</li>
              <li>Upload metadata is validated before analysis.</li>
              <li>Deep review remains on the single agent run path.</li>
              {notWired && <li>One route in the requested flow is not wired yet and surfaced a safe error.</li>}
            </ul>
          </section>

          {runResult && (
            <section className="rounded-3xl border border-border bg-surface-1/80 p-5 shadow-xl">
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Agent run</p>
              <p className="mt-2 text-sm text-gray-100">Run ID: {runResult.runId}</p>
              <p className="mt-1 text-sm text-gray-100">Status: {runResult.status}</p>
              <p className="mt-2 text-sm text-empire-muted">{runResult.answer}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <RunLink runId={runResult.runId} />
              </div>
              {runResult.actionDrafts.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm text-gray-200">
                  {runResult.actionDrafts.map((draft) => (
                    <li key={draft.id} className="rounded-xl border border-border bg-surface-0 px-3 py-2">
                      {draft.title} · {draft.category} · {draft.priority}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
