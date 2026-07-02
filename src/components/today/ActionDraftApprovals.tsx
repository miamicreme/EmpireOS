'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import type { AgentActionDraftRow } from '@/spine/ai/agent/agent-repository.service';

interface DraftEditState {
  title: string;
  description: string;
  category: string;
  priority: string;
}

const CATEGORIES = ['cash', 'job', 'followup', 'credit', 'project', 'acquisition', 'review', 'admin', 'general'];
const PRIORITIES = ['critical', 'high', 'medium', 'low'];

function initialEdits(drafts: AgentActionDraftRow[]): Record<string, DraftEditState> {
  return Object.fromEntries(
    drafts.map((d) => [
      d.id,
      {
        title: d.title,
        description: d.description ?? '',
        category: d.category,
        priority: d.priority,
      },
    ]),
  );
}

export function ActionDraftApprovals({ drafts }: { drafts: AgentActionDraftRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, DraftEditState>>(() => initialEdits(drafts));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pendingCount = useMemo(() => drafts.length, [drafts.length]);

  function updateEdit(id: string, patch: Partial<DraftEditState>) {
    const draft = drafts.find((d) => d.id === id);
    if (!draft) return;
    const fallback: DraftEditState = {
      title: draft.title,
      description: draft.description ?? '',
      category: draft.category,
      priority: draft.priority,
    };
    setEdits((current) => ({
      ...current,
      [id]: { ...(current[id] ?? fallback), ...patch },
    }));
  }

  function decide(id: string, action: 'approve' | 'reject') {
    const current = edits[id];
    setBusyId(id);
    setMessage(null);
    startTransition(async () => {
      const result = await api.post(`/api/ai/agent/action-drafts/${id}/approve`, {
        action,
        edits:
          action === 'approve' && current
            ? {
                title: current.title,
                description: current.description || null,
                category: current.category,
                priority: current.priority,
              }
            : undefined,
      });
      setBusyId(null);
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  if (pendingCount === 0) {
    return <p className="text-sm text-empire-muted">No AI drafts are pending. Ask the command bar for a next-action plan to generate approval-gated drafts.</p>;
  }

  return (
    <div className="space-y-3">
      {drafts.map((draft) => {
        const current = edits[draft.id] ?? {
          title: draft.title,
          description: draft.description ?? '',
          category: draft.category,
          priority: draft.priority,
        };
        const isEditing = editing === draft.id;

        return (
          <div key={draft.id} className="rounded-xl border border-border bg-surface-2/70 p-3">
            {isEditing ? (
              <div className="space-y-2">
                <input
                  value={current.title}
                  onChange={(event) => updateEdit(draft.id, { title: event.target.value })}
                  className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-gray-100 outline-none focus:border-empire-blue"
                  aria-label="Draft title"
                />
                <textarea
                  value={current.description}
                  onChange={(event) => updateEdit(draft.id, { description: event.target.value })}
                  className="min-h-20 w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-gray-100 outline-none focus:border-empire-blue"
                  aria-label="Draft description"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={current.category}
                    onChange={(event) => updateEdit(draft.id, { category: event.target.value })}
                    className="rounded-lg border border-border bg-surface-0 px-3 py-2 text-xs font-mono text-gray-100 outline-none focus:border-empire-blue"
                    aria-label="Draft category"
                  >
                    {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <select
                    value={current.priority}
                    onChange={(event) => updateEdit(draft.id, { priority: event.target.value })}
                    className="rounded-lg border border-border bg-surface-0 px-3 py-2 text-xs font-mono text-gray-100 outline-none focus:border-empire-blue"
                    aria-label="Draft priority"
                  >
                    {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-gray-100">{current.title}</h3>
                <p className="mt-1 text-xs text-empire-muted">{draft.reason ?? (current.description || 'AI drafted this action from the compact agent runtime.')}</p>
              </>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface-3 px-2 py-1 text-[10px] font-mono uppercase text-gray-300">{current.category}</span>
              <span className="rounded-full bg-surface-3 px-2 py-1 text-[10px] font-mono uppercase text-gray-300">{current.priority}</span>
              <Button size="sm" onClick={() => decide(draft.id, 'approve')} loading={isPending && busyId === draft.id}>Approve</Button>
              <Button size="sm" variant="danger" onClick={() => decide(draft.id, 'reject')} loading={isPending && busyId === draft.id}>Reject</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(isEditing ? null : draft.id)}>Edit</Button>
            </div>
          </div>
        );
      })}
      {message && <p className="text-xs font-mono text-empire-red">{message}</p>}
    </div>
  );
}
