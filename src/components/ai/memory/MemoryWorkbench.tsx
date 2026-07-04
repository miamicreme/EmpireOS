'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { SkeletonRows } from '@/components/ui/Skeleton';

type MemoryItem = {
  id: string;
  memory_type: string;
  title: string | null;
  summary: string | null;
  source: string | null;
  confidence: number | null;
  status: 'active' | 'archived' | 'deleted';
  metadata: Record<string, unknown>;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

type MemoryResponse = MemoryItem[];

function fmtDate(value: string | null) {
  if (!value) return 'n/a';
  return new Date(value).toLocaleString();
}

export function MemoryWorkbench() {
  const [status, setStatus] = useState<'active' | 'archived' | 'deleted'>('active');
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    memoryType?: string;
    title?: string;
    summary?: string;
    source?: string;
    confidence?: number;
    status?: 'active' | 'archived' | 'deleted';
  }>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await api.get<MemoryResponse>(`/api/ai/agent/memory?status=${status}`);
    if (response.ok) setItems(response.data);
    else setError(response.error.message);
    setLoading(false);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      active: items.filter((item) => item.status === 'active').length,
      archived: items.filter((item) => item.status === 'archived').length,
      deleted: items.filter((item) => item.status === 'deleted').length,
    }),
    [items],
  );

  async function save(id: string) {
    const target = items.find((item) => item.id === id);
    const response = await api.patch(`/api/ai/agent/memory/${id}`, {
      memoryType: form.memoryType ?? target?.memory_type,
      title: form.title ?? target?.title ?? undefined,
      summary: form.summary ?? target?.summary ?? undefined,
      source: form.source ?? target?.source ?? undefined,
      confidence: form.confidence ?? target?.confidence ?? undefined,
      status: form.status ?? target?.status ?? undefined,
    });
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setEditingId(null);
    setForm({});
    await load();
  }

  async function deleteItem(id: string) {
    const response = await api.del(`/api/ai/agent/memory/${id}`);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    await load();
  }

  async function approveItem(id: string, action: 'approve' | 'reject') {
    const response = await api.post(`/api/ai/agent/memory/${id}/approve`, { action });
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    await load();
  }

  if (loading) return <SkeletonRows rows={4} />;

  if (error) {
    return (
      <Card className="border-empire-red/20">
        <div className="p-5">
          <EmptyState icon="!" message={error} />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="grid gap-3 p-5 md:grid-cols-4">
          {(['active', 'archived', 'deleted'] as const).map((key) => (
            <button
              key={key}
              className={`rounded-2xl border p-4 text-left transition ${
                status === key ? 'border-empire-blue bg-empire-blue/10' : 'border-border bg-surface-0'
              }`}
              onClick={() => setStatus(key)}
            >
              <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">{key}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-100">{counts[key]}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="space-y-4 p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Durable memory</p>
          {items.length === 0 ? (
            <EmptyState message={`No ${status} memory items found.`} />
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const editing = editingId === item.id;
                return (
                  <div key={item.id} className="rounded-2xl border border-border bg-surface-0 p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="blue">{item.memory_type}</Badge>
                      <Badge variant="muted">{item.status}</Badge>
                      <Badge variant="muted">{Math.round((item.confidence ?? 0) * 100)}%</Badge>
                    </div>
                    <p className="mt-2 text-sm text-gray-100">{item.title ?? 'Untitled memory'}</p>
                    {item.summary && <p className="mt-1 text-sm text-empire-muted">{item.summary}</p>}
                    <p className="mt-2 text-xs font-mono text-empire-muted">
                      Source: {item.source ?? 'n/a'} · Updated {fmtDate(item.updated_at)}
                    </p>

                    {editing ? (
                      <div className="mt-4 space-y-3 rounded-2xl border border-border bg-surface-1 p-4">
                        <label className="block">
                          <span className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Memory type</span>
                          <input
                            className="mt-1 h-9 w-full rounded-lg border border-border bg-surface-0 px-3 text-sm text-gray-100 outline-none focus:border-empire-blue"
                            value={form.memoryType ?? item.memory_type}
                            onChange={(event) => setForm((current) => ({ ...current, memoryType: event.target.value }))}
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Title</span>
                          <input
                            className="mt-1 h-9 w-full rounded-lg border border-border bg-surface-0 px-3 text-sm text-gray-100 outline-none focus:border-empire-blue"
                            value={form.title ?? item.title ?? ''}
                            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-mono uppercase tracking-widest text-empire-muted">Summary</span>
                          <textarea
                            className="mt-1 w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-gray-100 outline-none focus:border-empire-blue"
                            rows={4}
                            value={form.summary ?? item.summary ?? ''}
                            onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => void save(item.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setForm({}); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => { setEditingId(item.id); setForm({ memoryType: item.memory_type, title: item.title ?? '', summary: item.summary ?? '', source: item.source ?? '' }); }}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => void deleteItem(item.id)}>
                          Delete
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void approveItem(item.id, 'approve')}>
                          Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void approveItem(item.id, 'reject')}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
