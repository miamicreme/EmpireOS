'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ModuleCopilotPanel } from '@/components/ui/ai/ModuleCopilotPanel';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Textarea, Select } from '@/components/ui/Field';
import { StatCard } from '@/components/ui/Stat';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api-client';
import type { CreditItem, CreditItemStatus } from '@/spine/types';

const STATUS_VARIANT: Record<CreditItemStatus, 'blue' | 'yellow' | 'green' | 'muted'> = {
  open: 'blue',
  disputing: 'yellow',
  resolved: 'green',
  archived: 'muted',
};

export default function CreditFundingPage() {
  const { success, error } = useToast();
  const [items, setItems] = useState<CreditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<CreditItem[]>('/api/credit-items');
    if (res.ok) setItems(res.data);
    else error(res.error.message);
    setLoading(false);
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    return {
      total: items.length,
      open: items.filter((i) => i.status === 'open').length,
      disputing: items.filter((i) => i.status === 'disputing').length,
      resolved: items.filter((i) => i.status === 'resolved').length,
    };
  }, [items]);

  async function handleDelete(item: CreditItem) {
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== item.id));
    const res = await api.del(`/api/credit-items/${item.id}`);
    if (res.ok) success('Item deleted');
    else {
      setItems(prev);
      error(res.error.message);
    }
  }

  const columns: Array<Column<CreditItem>> = [
    {
      key: 'item',
      header: 'Item',
      render: (i) => (
        <div className="min-w-0">
          <p className="text-gray-100 truncate">{i.item_name}</p>
          {(i.bureau ?? i.item_type) && (
            <p className="text-xs text-empire-muted truncate mt-0.5">{i.bureau ?? i.item_type}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (i) => <Badge variant={STATUS_VARIANT[i.status]}>{i.status}</Badge>,
    },
    {
      key: 'due',
      header: 'Due',
      width: '120px',
      align: 'right',
      render: (i) => (
        <span className="nums text-empire-muted">{i.due_at?.slice(0, 10) ?? '—'}</span>
      ),
    },
    {
      key: 'next_action',
      header: 'Next action',
      render: (i) => (
        <span className="text-gray-300 truncate block">{i.next_action ?? '—'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      align: 'right',
      render: (i) => (
        <button
          onClick={() => handleDelete(i)}
          className="text-empire-muted hover:text-empire-red transition-colors text-xs font-mono"
          aria-label="Delete item"
        >
          ✕
        </button>
      ),
    },
  ];

  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader
        title="Credit & Funding"
        subtitle="Track credit repair disputes and build toward funding readiness."
        action={<Button onClick={() => setOpen(true)} icon={<span>+</span>}>Add Item</Button>}
      />

      <ModuleCopilotPanel moduleId="credit-funding" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total" value={counts.total} tone="violet" />
        <StatCard label="Open" value={counts.open} tone="blue" />
        <StatCard label="Disputing" value={counts.disputing} tone="yellow" />
        <StatCard label="Resolved" value={counts.resolved} tone="green" />
      </div>

      <Card>
        {loading ? (
          <SkeletonRows rows={4} />
        ) : (
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(i) => i.id}
            empty={
              <EmptyState
                icon="✦"
                message="No credit items yet."
                action={<Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Add your first item</Button>}
              />
            }
          />
        )}
      </Card>

      <CreditItemModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(item) => {
          setItems((cur) => [item, ...cur]);
          success('Item added');
          setOpen(false);
        }}
        onError={error}
      />
    </main>
  );
}

function CreditItemModal({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (item: CreditItem) => void;
  onError: (msg: string) => void;
}) {
  const [itemName, setItemName] = useState('');
  const [bureau, setBureau] = useState('');
  const [itemType, setItemType] = useState('');
  const [status, setStatus] = useState<CreditItemStatus>('open');
  const [dueAt, setDueAt] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setItemName('');
    setBureau('');
    setItemType('');
    setStatus('open');
    setDueAt('');
    setNextAction('');
    setNotes('');
  }

  async function submit() {
    if (!itemName.trim()) {
      onError('Item name is required');
      return;
    }
    setSaving(true);
    const res = await api.post<CreditItem>('/api/credit-items', {
      item_name: itemName.trim(),
      bureau: bureau.trim() || null,
      item_type: itemType.trim() || null,
      status,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      next_action: nextAction.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (res.ok) {
      reset();
      onCreated(res.data);
    } else {
      onError(res.error.message);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Credit Item"
      subtitle="Track a dispute, account, or funding task."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Save Item</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Item Name" required>
          <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Collection account, late payment" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bureau">
            <Input value={bureau} onChange={(e) => setBureau(e.target.value)} placeholder="e.g. Experian" />
          </Field>
          <Field label="Type">
            <Input value={itemType} onChange={(e) => setItemType(e.target.value)} placeholder="e.g. Collection" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as CreditItemStatus)}>
              <option value="open">Open</option>
              <option value="disputing">Disputing</option>
              <option value="resolved">Resolved</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="Due">
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Next Action">
          <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </Field>
      </div>
    </Modal>
  );
}
