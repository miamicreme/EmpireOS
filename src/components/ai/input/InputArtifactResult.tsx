'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Badge } from '@/components/ui/Badge';
import { Card, EmptyState } from '@/components/ui/Card';

export interface InputAnalyzeResult {
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
}

export interface InputUploadResult {
  uploadAccepted: boolean;
  fileId: string;
  publicUrl: null;
  maxBytes: number;
}

export function InputArtifactResult({
  fileName,
  detectedKind,
  uploadResult,
  analysis,
  error,
}: {
  fileName: string;
  detectedKind: string;
  uploadResult: InputUploadResult | null;
  analysis: InputAnalyzeResult | null;
  error: string | null;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface-1/80 p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Analysis result</p>
          <h2 className="mt-2 text-xl font-semibold text-gray-100">Artifact summary and recommended actions</h2>
        </div>
        <div className="text-right text-xs font-mono text-empire-muted">
          <div>File: {fileName || 'No file selected'}</div>
          <div>Detected kind: {detectedKind}</div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {error && (
          <div className="rounded-2xl border border-empire-red/30 bg-empire-red/10 p-4 text-sm text-empire-red">
            {error}
          </div>
        )}

        {!analysis ? (
          <EmptyState
            icon="◌"
            message="Analyze an input to see the created artifact, safe summary, recommended actions, and draft IDs."
          />
        ) : (
          <Card className="border-border">
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="blue">{analysis.artifactType}</Badge>
                <Badge variant="muted">{analysis.artifactId}</Badge>
                {uploadResult?.uploadAccepted && <Badge variant="green">upload validated</Badge>}
              </div>

              <div className="rounded-2xl border border-border bg-surface-0 p-4">
                <p className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Summary</p>
                <p className="mt-2 text-sm leading-6 text-gray-100">{analysis.summary}</p>
              </div>

              {analysis.keyFacts.length > 0 && (
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Key facts</p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-200">
                    {analysis.keyFacts.map((fact) => (
                      <li key={fact} className="rounded-xl border border-border bg-surface-0 px-3 py-2">
                        {fact}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.recommendedActions.length > 0 && (
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Recommended actions</p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-200">
                    {analysis.recommendedActions.map((action) => (
                      <li key={action} className="rounded-xl border border-border bg-surface-0 px-3 py-2">
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-surface-0 p-4">
                  <p className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Artifact + upload</p>
                  <p className="mt-2 text-sm text-gray-100">Artifact ID: {analysis.artifactId}</p>
                  <p className="mt-1 text-sm text-gray-100">Artifact type: {analysis.artifactType}</p>
                  <p className="mt-1 text-xs font-mono text-empire-muted">
                    Upload validated: {uploadResult?.fileId ?? 'not uploaded yet'}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-surface-0 p-4">
                  <p className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Drafts returned</p>
                  {analysis.actionDraftIds.length === 0 ? (
                    <p className="mt-2 text-sm text-empire-muted">No action drafts were returned for this analysis.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm text-gray-200">
                      {analysis.actionDraftIds.map((id) => (
                        <li key={id} className="rounded-xl border border-border bg-surface-1 px-3 py-2">
                          {id}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <p className="text-xs font-mono text-empire-muted">{analysis.nextCommandHint}</p>
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}

export function RunLink({ runId }: { runId: string | null }) {
  if (!runId) return null;
  return (
    <Link
      href={`/ai/runs/${runId}` as Route}
      className="inline-flex items-center gap-2 rounded-lg border border-empire-blue/30 bg-empire-blue/10 px-3 py-2 text-sm text-empire-blue"
    >
      Open run detail
    </Link>
  );
}

