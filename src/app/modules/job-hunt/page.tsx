'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Textarea, Select } from '@/components/ui/Field';
import { StatCard } from '@/components/ui/Stat';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api, usd } from '@/lib/api-client';
import type { JobApplication, JobStatus } from '@/spine/types';

type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'muted' | 'default';

const STATUS_TONE: Record<JobStatus, BadgeVariant> = {
  saved: 'muted',
  applied: 'blue',
  interviewing: 'yellow',
  offer: 'green',
  accepted: 'green',
  rejected: 'red',
};

const STATUS_OPTIONS: JobStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'accepted',
];

const ACTIVE_STATUSES: JobStatus[] = ['applied', 'interviewing', 'offer'];

export default function JobHuntPage() {
  const { success, error } = useToast();
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<JobApplication[]>('/api/jobs');
    if (res.ok) setApps(res.data);
    else error(res.error.message);
    setLoading(false);
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const total = apps.length;
    const active = apps.filter((a) => ACTIVE_STATUSES.includes(a.status)).length;
    const interviewing = apps.filter((a) => a.status === 'interviewing').length;
    const offers = apps.filter((a) => a.status === 'offer').length;
    return { total, active, interviewing, offers };
  }, [apps]);

  async function handleDelete(app: JobApplication) {
    const prev = apps;
    setApps((cur) => cur.filter((a) => a.id !== app.id));
    const res = await api.del(`/api/jobs/${app.id}`);
    if (res.ok) success('Application deleted');
    else {
      setApps(prev);
      error(res.error.message);
    }
  }

  const columns: Array<Column<JobApplication>> = [
    {
      key: 'company',
      header: 'Company',
      render: (a) => (
        <div className="min-w-0">
          <p className="text-gray-100 truncate">{a.company}</p>
          <p className="text-xs text-empire-muted truncate mt-0.5">{a.role}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (a) => <Badge variant={STATUS_TONE[a.status]}>{a.status}</Badge>,
    },
    {
      key: 'priority',
      header: 'Priority',
      width: '100px',
      align: 'right',
      render: (a) => <span className="nums text-gray-300">{a.priority_score}/10</span>,
    },
    {
      key: 'salary',
      header: 'Salary',
      width: '170px',
      align: 'right',
      render: (a) =>
        a.salary_min != null || a.salary_max != null ? (
          <span className="nums text-gray-300">
            {usd(a.salary_min ?? 0)}–{usd(a.salary_max ?? 0)}
          </span>
        ) : (
          <span className="text-empire-muted">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      align: 'right',
      render: (a) => (
        <button
          onClick={() => handleDelete(a)}
          className="text-empire-muted hover:text-empire-red transition-colors text-xs font-mono"
          aria-label="Delete application"
        >
          ✕
        </button>
      ),
    },
  ];

  return (
    <main className="flex-1 p-6 overflow-y-auto">
      <PageHeader
        title="Job Hunt"
        subtitle="Your pipeline of high-income roles, from saved leads to signed offers."
        action={<Button onClick={() => setOpen(true)} icon={<span>+</span>}>Add Application</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Apps" value={totals.total} tone="violet" />
        <StatCard label="Active" value={totals.active} tone="blue" />
        <StatCard label="Interviewing" value={totals.interviewing} tone="yellow" />
        <StatCard label="Offers" value={totals.offers} tone="green" />
      </div>

      <Card>
        {loading ? (
          <SkeletonRows rows={4} />
        ) : (
          <DataTable
            columns={columns}
            rows={apps}
            rowKey={(a) => a.id}
            empty={
              <EmptyState
                icon="💼"
                message="No applications yet."
                action={<Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Add your first application</Button>}
              />
            }
          />
        )}
      </Card>

      <JobApplicationModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(app) => {
          setApps((cur) => [app, ...cur]);
          success('Application added');
          setOpen(false);
        }}
        onError={error}
      />
    </main>
  );
}

function JobApplicationModal({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (app: JobApplication) => void;
  onError: (msg: string) => void;
}) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [status, setStatus] = useState<JobStatus>('saved');
  const [priority, setPriority] = useState('5');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setCompany('');
    setRole('');
    setSalaryMin('');
    setSalaryMax('');
    setStatus('saved');
    setPriority('5');
    setNotes('');
  }

  async function submit() {
    if (!company.trim()) {
      onError('Company is required');
      return;
    }
    if (!role.trim()) {
      onError('Role is required');
      return;
    }
    setSaving(true);
    const res = await api.post<JobApplication>('/api/jobs', {
      company: company.trim(),
      role: role.trim(),
      salary_min: Number(salaryMin) || null,
      salary_max: Number(salaryMax) || null,
      status,
      priority_score: Number(priority) || null,
      recruiter_name: null,
      job_url: null,
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
      title="Add Application"
      subtitle="Track a new role in your job-hunt pipeline."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Save Application</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Company" required>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Stripe" />
        </Field>
        <Field label="Role" required>
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Engineer" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Salary Min ($)">
            <Input type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Salary Max ($)">
            <Input type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority (1-10)">
            <Input type="number" min={1} max={10} value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="5" />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </Field>
      </div>
    </Modal>
  );
}
