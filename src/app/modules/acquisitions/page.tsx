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
import { api, usd } from '@/lib/api-client';
import type { AcquisitionTarget, AcquisitionStatus } from '@/spine/types';

const STATUSES: AcquisitionStatus[] = [
  'watching',
  'contacted',
  'analyzing',
  'offer',
  'closed',
  'passed',
];

function statusVariant(status: AcquisitionStatus): 'green' | 'yellow' | 'red' | 'blue' | 'muted' | 'default' {
  switch (status) {
    case 'watching':
      return 'muted';
    case 'contacted':
      return 'blue';
    case 'analyzing':
      return 'yellow';
    case 'offer':
      return 'yellow';
    case 'closed':
      return 'green';
    case 'passed':
      return 'red';
    default:
      return 'default';
  }
}

export default function AcquisitionsPage() {
  const { success, error } = useToast();
  const [targets, setTargets] = useState<AcquisitionTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<AcquisitionTarget[]>('/api/acquisitions');
    if (res.ok) setTargets(res.data);
    else error(res.error.message);
    setLoading(false);
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const watching = targets.filter((t) => t.status === 'watching').length;
    const offer = targets.filter((t) => t.status === 'offer').length;
    const closed = targets.filter((t) => t.status === 'closed').length;
    return { watching, offer, closed };
  }, [targets]);

  async function handleDelete(target: AcquisitionTarget) {
    const prev = targets;
    setTargets((cur) => cur.filter((t) => t.id !== target.id));
    const res = await api.del(`/api/acquisitions/${target.id}`);
    if (res.ok) success('Target deleted');
    else {
      setTargets(prev);
      error(res.error.message);
    }
  }

  const columns: Array<Column<AcquisitionTarget>> = [
    {
      key: 'name',
      header: 'Name',
      render: (t) => (
        <div className="min-w-0">
          <p className="text-gray-100 truncate">{t.name}</p>
          {t.location && <p className="text-xs text-empire-muted truncate mt-0.5">{t.location}</p>}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: '140px',
      render: (t) => <span className="text-gray-300">{t.target_type}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (t) => <Badge variant={statusVariant(t.status)}>{t.status}</Badge>,
    },
    {
      key: 'asking',
      header: 'Asking',
      width: '120px',
      align: 'right',
      render: (t) => (
        <span className="nums text-gray-300">{t.asking_price != null ? usd(t.asking_price) : '—'}</span>
      ),
    },
    {
      key: 'upside',
      header: 'Upside',
      width: '90px',
      align: 'right',
      render: (t) => <span className="nums text-empire-muted">{t.upside_score}/10</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      align: 'right',
      render: (t) => (
        <button
          onClick={() => handleDelete(t)}
          className="text-empire-muted hover:text-empire-red transition-colors text-xs font-mono"
          aria-label="Delete target"
        >
          ✕
        </button>
      ),
    },
  ];

  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader
        title="Acquisitions"
        subtitle="Track your deal pipeline and acquisition targets from watch to close."
        action={<Button onClick={() => setOpen(true)} icon={<span>+</span>}>Add Target</Button>}
      />

      <ModuleCopilotPanel moduleId="acquisitions" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total" value={targets.length} tone="violet" />
        <StatCard label="Watching" value={counts.watching} tone="blue" />
        <StatCard label="In Offer" value={counts.offer} tone="yellow" />
        <StatCard label="Closed" value={counts.closed} tone="green" />
      </div>

      <Card>
        {loading ? (
          <SkeletonRows rows={4} />
        ) : (
          <DataTable
            columns={columns}
            rows={targets}
            rowKey={(t) => t.id}
            empty={
              <EmptyState
                icon="◎"
                message="No acquisition targets yet."
                action={<Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Add your first target</Button>}
              />
            }
          />
        )}
      </Card>

      <AcquisitionModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(target) => {
          setTargets((cur) => [target, ...cur]);
          success('Target added');
          setOpen(false);
        }}
        onError={error}
      />
    </main>
  );
}

function AcquisitionModal({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (target: AcquisitionTarget) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [targetType, setTargetType] = useState('business');
  const [location, setLocation] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [revenue, setRevenue] = useState('');
  const [noi, setNoi] = useState('');
  const [sellerFinancing, setSellerFinancing] = useState(false);
  const [status, setStatus] = useState<AcquisitionStatus>('watching');
  const [upsideScore, setUpsideScore] = useState('5');
  const [riskScore, setRiskScore] = useState('5');
  const [nextAction, setNextAction] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setName('');
    setTargetType('business');
    setLocation('');
    setAskingPrice('');
    setRevenue('');
    setNoi('');
    setSellerFinancing(false);
    setStatus('watching');
    setUpsideScore('5');
    setRiskScore('5');
    setNextAction('');
    setNotes('');
  }

  async function submit() {
    if (!name.trim()) {
      onError('Name is required');
      return;
    }
    if (!targetType.trim()) {
      onError('Type is required');
      return;
    }
    setSaving(true);
    const res = await api.post<AcquisitionTarget>('/api/acquisitions', {
      name: name.trim(),
      target_type: targetType.trim(),
      location: location.trim() || null,
      asking_price: Number(askingPrice) || null,
      revenue: Number(revenue) || null,
      noi: Number(noi) || null,
      seller_financing_possible: sellerFinancing,
      status,
      upside_score: Number(upsideScore) || 5,
      risk_score: Number(riskScore) || 5,
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
      title="Add Acquisition Target"
      subtitle="Track a new deal in your acquisition pipeline."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Add Target</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Laundromat" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required>
            <Input value={targetType} onChange={(e) => setTargetType(e.target.value)} placeholder="business" />
          </Field>
          <Field label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Asking ($)">
            <Input type="number" min={0} value={askingPrice} onChange={(e) => setAskingPrice(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Revenue ($)">
            <Input type="number" min={0} value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="0" />
          </Field>
          <Field label="NOI ($)">
            <Input type="number" min={0} value={noi} onChange={(e) => setNoi(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as AcquisitionStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Seller Financing">
            <Select
              value={sellerFinancing ? 'yes' : 'no'}
              onChange={(e) => setSellerFinancing(e.target.value === 'yes')}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Upside (0-10)">
            <Input type="number" min={0} max={10} value={upsideScore} onChange={(e) => setUpsideScore(e.target.value)} placeholder="5" />
          </Field>
          <Field label="Risk (0-10)">
            <Input type="number" min={0} max={10} value={riskScore} onChange={(e) => setRiskScore(e.target.value)} placeholder="5" />
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
