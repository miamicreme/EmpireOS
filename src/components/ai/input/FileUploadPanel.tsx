'use client';

import { Button } from '@/components/ui/Button';

const PURPOSE_OPTIONS = [
  { value: 'general', label: 'General review' },
  { value: 'finance', label: 'Finance / cash' },
  { value: 'deal', label: 'Deal / document' },
  { value: 'camera', label: 'Camera / visual' },
  { value: 'research', label: 'Research needed' },
] as const;

export function FileUploadPanel({
  file,
  detectedKind,
  text,
  purpose,
  status,
  busy,
  onFileChange,
  onTextChange,
  onPurposeChange,
  onAnalyze,
  onClearFile,
}: {
  file: File | null;
  detectedKind: string;
  text: string;
  purpose: string;
  status: string;
  busy: boolean;
  onFileChange: (file: File | null) => void;
  onTextChange: (value: string) => void;
  onPurposeChange: (value: string) => void;
  onAnalyze: () => void;
  onClearFile: () => void;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface-1/80 p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Universal input</p>
          <h2 className="mt-2 text-xl font-semibold text-gray-100">Drop anything here, then route it through the one AI command path.</h2>
        </div>
        <div className="text-right text-xs font-mono text-empire-muted">
          <div>Status: {status}</div>
          <div>Detected kind: {detectedKind}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <label className="flex min-h-40 cursor-pointer flex-col justify-center rounded-2xl border border-dashed border-empire-blue/50 bg-surface-0 p-5 text-center text-sm text-empire-muted">
          <span className="text-base font-semibold text-gray-100">Drop anything here</span>
          <span className="mt-2">
            PDF, DOCX, TXT/MD, CSV/XLSX, screenshots, images, camera frames, or voice transcripts.
          </span>
          <span className="mt-2 text-xs font-mono text-empire-muted/80">
            Browser file selection is deliberate. No public file URLs are created.
          </span>
          <input
            className="sr-only"
            type="file"
            accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.png,.jpg,.jpeg,.webp,text/*,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="space-y-3 rounded-2xl border border-border bg-surface-0 p-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Current file</p>
            <p className="mt-1 break-words text-sm text-gray-100">
              {file ? file.name : 'No file selected'}
            </p>
            {file && (
              <p className="mt-1 text-xs font-mono text-empire-muted">
                {file.type || 'unknown type'} · {Math.max(1, Math.round(file.size / 1024))} KB
              </p>
            )}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Purpose</span>
            <select
              className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-sm text-gray-100 outline-none focus:border-empire-blue"
              value={purpose}
              onChange={(event) => onPurposeChange(event.target.value)}
            >
              {PURPOSE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-widest text-empire-muted" htmlFor="ai-input-text">
              Paste text
            </label>
            <textarea
              id="ai-input-text"
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              rows={10}
              placeholder="Paste extracted text, notes, CSV rows, transcript text, or screenshot description here."
              className="mt-1 w-full resize-y rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder:text-empire-muted/70 focus:border-empire-blue"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={onAnalyze} loading={busy}>
              Analyze input
            </Button>
            {file && (
              <Button variant="ghost" onClick={onClearFile} disabled={busy}>
                Clear file
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

