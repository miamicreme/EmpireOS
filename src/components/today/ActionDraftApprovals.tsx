'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import type { AgentActionDraftRow } from '@/spine/ai/agent/agent-repository.service';

type DraftEdits = {
  title: string;
  description: string;
  category: string;
  priority: string;
};

function getDraftEdits(draft: AgentActionDraftRow): DraftEdits {
  return {
    title: draft.title,
    description: draft.description ?? '',
    category: draft.category,
    priority: draft.priority,
  };
}

export function ActionDraftApprovals({ drafts }: { drafts: AgentActionDraftRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, DraftEdits>>(() => Object.fromEntries(drafts.map((draft) => [draft.id, getDraftEdits(draft)])));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateDraftEdit(draft: AgentActionDraftRow, field: keyof DraftEdits, value: string) {
    setDraftEdits((current) => ({
      ...current,
      [draft.id]: {
        ...(current[draft.id] ?? getDraftEdits(draft)),
        [field]: value,
      },
    }));
  }

  function decide(draft: AgentActionDraftRow, action: 'approve' | 'reject') {
    setBusyId(draft.id);
    setMessage(null);
    startTransition(async () => {
      const id = draft.id;
      const edits = draftEdits[id] ?? getDraftEdits(draft);
      const result = await api.post(
        `/api/ai/agent/action-drafts/${id}/approve`,
        action === 'approve'
          ? {
              action: 'approve',
              edits: {
                title: edits.title,
                description: edits.description,
                category: edits.category,
                priority: edits.priority,
              },
            }
          : { action: 'reject' },
      );
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
      {drafts.map((draft) => {
        const edits = draftEdits[draft.id] ?? getDraftEdits(draft);

        return (
          <div key={draft.id} className="rounded-xl border border-border bg-surface-2/70 p-3">
            {editing === draft.id ? (
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <label className="sm:col-span-2 text-xs font-medium text-empire-muted">
                  Draft title
                  <input
                    value={edits.title}
                    onChange={(event) => updateDraftEdit(draft, 'title', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-gray-100 outline-none focus:border-empire-blue"
                  />
                </label>
                <label className="sm:col-span-2 text-xs font-medium text-empire-muted">
                  Draft description
                  <textarea
                    value={edits.description}
                    onChange={(event) => updateDraftEdit(draft, 'description', event.target.value)}
                    className="mt-1 min-h-20 w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-gray-100 outline-none focus:border-empire-blue"
                  />
                </label>
                <label className="text-xs font-medium text-empire-muted">
                  Draft category
                  <input
                    value={edits.category}
                    onChange={(event) => updateDraftEdit(draft, 'category', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-gray-100 outline-none focus:border-empire-blue"
                  />
                </label>
                <label className="text-xs font-medium text-empire-muted">
                  Draft priority
                  <input
                    value={edits.priority}
                    onChange={(event) => updateDraftEdit(draft, 'priority', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-gray-100 outline-none focus:border-empire-blue"
                  />
                </label>
              </div>
            ) : (
              <h3 className="text-sm font-semibold text-gray-100">{edits.title}</h3>
            )}
            <p className="mt-1 text-xs text-empire-muted">{draft.reason ?? (edits.description || 'AI drafted this action from the compact agent runtime.')}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface-3 px-2 py-1 text-[10px] font-mono uppercase text-gray-300">{edits.category}</span>
              <span className="rounded-full bg-surface-3 px-2 py-1 text-[10px] font-mono uppercase text-gray-300">{edits.priority}</span>
              <Button size="sm" onClick={() => decide(draft, 'approve')} loading={isPending && busyId === draft.id}>Approve</Button>
              <Button size="sm" variant="danger" onClick={() => decide(draft, 'reject')} loading={isPending && busyId === draft.id}>Reject</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(editing === draft.id ? null : draft.id)}>Edit</Button>
            </div>
          </div>
        );
      })}
      {message && <p className="text-xs font-mono text-empire-red">{message}</p>}
    </div>
  );
}
