'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import type { AgentActionDraftRow } from '@/spine/ai/agent/agent-repository.service';

export function ActionDraftApprovals({ drafts }: { drafts: AgentActionDraftRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<
    Record<string, { title: string; description: string; category: string; priority: string }>
  >(() =>
    Object.fromEntries(
      drafts.map((d) => [
        d.id,
        {
          title: d.title,
          description: d.description ?? '',
          category: d.category,
          priority: d.priority,
        },
      ]),
    ),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateDraftEdit(
    id: string,
    field: 'title' | 'description' | 'category' | 'priority',
    value: string,
  ) {
    setDraftEdits((current) => ({
      ...current,
      [id]: {
        title: current[id]?.title ?? '',
        description: current[id]?.description ?? '',
        category: current[id]?.category ?? '',
        priority: current[id]?.priority ?? '',
        [field]: value,
      },
    }));
  }

  function decide(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
    setMessage(null);
    startTransition(async () => {
      const result = await api.post(`/api/ai/agent/action-drafts/${id}/approve`, {
        action,
        edits: action === 'approve' ? draftEdits[id] : undefined,
      });
      setBusyId(null);
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  if (drafts.length === 0) {
    return <p className="text-sm text-empire-muted">No AI drafts are pending. Ask the command bar for a next-action plan to generate approval-gated drafts.</p>;
  }

  return (
    <div className="space-y-3">
      {drafts.map((draft) => (
        <div key={draft.id} className="rounded-xl border border-border bg-surface-2/70 p-3">
          {editing === draft.id ? (
            <div className="mb-3 grid gap-2 md:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-empire-muted">
                <span>Draft title</span>
                <input
                  value={draftEdits[draft.id]?.title ?? draft.title}
                  onChange={(event) => updateDraftEdit(draft.id, 'title', event.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-gray-100 outline-none focus:border-empire-blue"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-empire-muted">
                <span>Draft category</span>
                <input
                  value={draftEdits[draft.id]?.category ?? draft.category}
                  onChange={(event) => updateDraftEdit(draft.id, 'category', event.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-gray-100 outline-none focus:border-empire-blue"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-empire-muted md:col-span-2">
                <span>Draft description</span>
                <textarea
                  value={draftEdits[draft.id]?.description ?? draft.description ?? ''}
                  onChange={(event) => updateDraftEdit(draft.id, 'description', event.target.value)}
                  className="min-h-20 w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-gray-100 outline-none focus:border-empire-blue"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-empire-muted">
                <span>Draft priority</span>
                <select
                  value={draftEdits[draft.id]?.priority ?? draft.priority}
                  onChange={(event) => updateDraftEdit(draft.id, 'priority', event.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-gray-100 outline-none focus:border-empire-blue"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
            </div>
          ) : (
            <h3 className="text-sm font-semibold text-gray-100">{draftEdits[draft.id]?.title ?? draft.title}</h3>
          )}
          <p className="mt-1 text-xs text-empire-muted">{draft.reason ?? draft.description ?? 'AI drafted this action from the compact agent runtime.'}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-3 px-2 py-1 text-[10px] font-mono uppercase text-gray-300">{draft.category}</span>
            <span className="rounded-full bg-surface-3 px-2 py-1 text-[10px] font-mono uppercase text-gray-300">{draft.priority}</span>
            <Button size="sm" onClick={() => decide(draft.id, 'approve')} loading={isPending && busyId === draft.id}>Approve</Button>
            <Button size="sm" variant="danger" onClick={() => decide(draft.id, 'reject')} loading={isPending && busyId === draft.id}>Reject</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(editing === draft.id ? null : draft.id)}>Edit</Button>
          </div>
        </div>
      ))}
      {message && <p className="text-xs font-mono text-empire-red">{message}</p>}
    </div>
  );
}
