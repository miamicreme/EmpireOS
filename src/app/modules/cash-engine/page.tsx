'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { StatCard } from '@/components/ui/Stat';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api, usd } from '@/lib/api-client';
import type { CashEntry } from '@/spine/types';

const TARGET = 250;

export default function CashEnginePage() {
  const { success, error } = useToast();
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<CashEntry[]>('/api/cash-entries');
    if (res.ok) setEntries(res.data);
    else error(res.error.message);
    setLoading(false);
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const net = entries.reduce((s, e) => s + (e.net_amount ?? 0), 0);
    const gross = entries.reduce((s, e) => s + (e.gross_amount ?? 0), 0);
    const expenses = entries.reduce((s, e) => s + (e.expenses ?? 0), 0);
    return { net, gross, expenses };
  }, [entries]);

  const pct = Math.min(1, totals.net / TARGET);
  const tone = pct >= 0.75 ? 'green' : pct >= 0.4 ? 'yellow' : 'red';

  async function handleDelete(entry: CashEntry) {
    const prev = entries;
    setEntries((cur) => cur.filter((e) => e.id !== entry.id));
    const res = await api.del(`/api/cash-entries/${entry.id}`);
    if (res.ok) success('Entry deleted');
    else {
      setEntries(prev);
      error(res.error.message);
    }
  }

  const columns: Array<Column<CashEntry>> = [
    {
      key: 'source',
      header: 'Source',
      render: (e) => (
        <div className="min-w-0">
          <p className="text-gray-100 truncate">{e.source}</p>
          {e.notes && <p className="text-xs text-empire-muted truncate mt-0.5">{e.notes}</p>}
        </div>
      ),
    },
    {
      key: 'gross',
      header: 'Gross',
      width: '110px',
      align: 'right',
      render: (e) => <span className="nums text-gray-300">{usd(e.gross_amount)}</span>,
    },
    {
      key: 'expenses',
      header: 'Expenses',
      width: '110px',
      align: 'right',
      render: (e) => <span className="nums text-empire-muted">{usd(e.expenses)}</span>,
    },
    {
      key: 'net',
      header: 'Net',
      width: '110px',
      align: 'right',
      render: (e) => (
        <span className={`nums font-medium ${e.net_amount >= 0 ? 'text-empire-green' : 'text-empire-red'}`}>
          {usd(e.net_amount)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      align: 'right',
      render: (e) => (
        <button
          onClick={() => handleDelete(e)}
          className="text-empire-muted hover:text-empire-red transition-colors text-xs font-mono"
          aria-label="Delete entry"
        >
          ✕
        </button>
      ),
    },
  ];

  return (
    <main className="flex-1 p-6 overflow-y-auto">
      <PageHeader
        title="Cash Engine"
        subtitle="Today's income, expenses, and net toward your daily target."
        action={<Button onClick={() => setOpen(true)} icon={<span>+</span>}>Log Entry</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Net Today"
          value={usd(totals.net)}
          sub={`${usd(TARGET)} target · ${Math.round(pct * 100)}%`}
          tone={tone}
        />
        <StatCard label="Gross" value={usd(totals.gross)} tone="blue" />
        <StatCard label="Expenses" value={usd(totals.expenses)} tone="muted" />
        <StatCard label="Entries" value={entries.length} tone="violet" />
      </div>

      <Card>
        {loading ? (
          <SkeletonRows rows={4} />
        ) : (
          <DataTable
            columns={columns}
            rows={entries}
            rowKey={(e) => e.id}
            empty={
              <EmptyState
                icon="$"
                message="No cash logged today."
                action={<Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Log your first entry</Button>}
              />
            }
          />
        )}
      </Card>

      <CashEntryModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(entry) => {
          setEntries((cur) => [entry, ...cur]);
          success('Entry logged');
          setOpen(false);
        }}
        onError={error}
      />
    </main>
  );
}

function CashEntryModal({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (entry: CashEntry) => void;
  onError: (msg: string) => void;
}) {
  const [source, setSource] = useState('');
  const [gross, setGross] = useState('');
  const [expenses, setExpenses] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setSource('');
    setGross('');
    setExpenses('');
    setNotes('');
  }

  async function submit() {
    if (!source.trim()) {
      onError('Source is required');
      return;
    }
    setSaving(true);
    const res = await api.post<CashEntry>('/api/cash-entries', {
      source: source.trim(),
      gross_amount: Number(gross) || 0,
      expenses: Number(expenses) || 0,
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
      title="Log Cash Entry"
      subtitle="Record income and expenses for today."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Save Entry</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Source" required>
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Rideshare, gig, sale" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gross ($)">
            <Input type="number" min={0} value={gross} onChange={(e) => setGross(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Expenses ($)">
            <Input type="number" min={0} value={expenses} onChange={(e) => setExpenses(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </Field>
      </div>
    </Modal>
  );
}
