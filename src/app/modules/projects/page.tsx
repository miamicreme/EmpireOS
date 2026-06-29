'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ModuleCopilotPanel } from '@/components/ui/ai/ModuleCopilotPanel';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Textarea, Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/Stat';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import type { Project, ProjectStatus } from '@/spine/types';

type FocusLevel = 'low' | 'medium' | 'high';

function statusVariant(status: ProjectStatus): 'green' | 'yellow' | 'blue' | 'muted' {
  if (status === 'active') return 'green';
  if (status === 'paused') return 'yellow';
  if (status === 'complete') return 'blue';
  return 'muted';
}

function focusVariant(focus: FocusLevel): 'red' | 'yellow' | 'muted' {
  if (focus === 'high') return 'red';
  if (focus === 'medium') return 'yellow';
  return 'muted';
}

export default function ProjectsPage() {
  const { success, error } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<Project[]>('/api/projects');
    if (res.ok) setProjects(res.data);
    else error(res.error.message);
    setLoading(false);
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const active = projects.filter((p) => p.status === 'active').length;
    const paused = projects.filter((p) => p.status === 'paused').length;
    const blocked = projects.filter(
      (p) => p.status === 'active' && p.blocker != null && p.blocker.trim() !== '',
    ).length;
    return { active, paused, blocked };
  }, [projects]);

  async function handleDelete(project: Project) {
    const prev = projects;
    setProjects((cur) => cur.filter((p) => p.id !== project.id));
    const res = await api.del(`/api/projects/${project.id}`);
    if (res.ok) success('Project deleted');
    else {
      setProjects(prev);
      error(res.error.message);
    }
  }

  const columns: Array<Column<Project>> = [
    {
      key: 'name',
      header: 'Name',
      render: (p) => (
        <div className="min-w-0">
          <p className="text-gray-100 truncate">{p.name}</p>
          {p.next_action && (
            <p className="text-xs text-empire-muted truncate mt-0.5">{p.next_action}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (p) => <Badge variant={statusVariant(p.status)}>{p.status}</Badge>,
    },
    {
      key: 'focus',
      header: 'Focus',
      width: '120px',
      render: (p) => <Badge variant={focusVariant(p.focus_level)}>{p.focus_level}</Badge>,
    },
    {
      key: 'strategic_value',
      header: 'Strategic',
      width: '110px',
      align: 'right',
      render: (p) => <span className="nums text-gray-300">{p.strategic_value}/10</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      align: 'right',
      render: (p) => (
        <button
          onClick={() => handleDelete(p)}
          className="text-empire-muted hover:text-empire-red transition-colors text-xs font-mono"
          aria-label="Delete project"
        >
          ✕
        </button>
      ),
    },
  ];

  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader
        title="Projects"
        subtitle="Track strategic initiatives, focus levels, and what moves each one forward."
        action={<Button onClick={() => setOpen(true)} icon={<span>+</span>}>New Project</Button>}
      />

      <ModuleCopilotPanel moduleId="projects" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total" value={projects.length} tone="violet" />
        <StatCard label="Active" value={counts.active} tone="green" />
        <StatCard label="Paused" value={counts.paused} tone="yellow" />
        <StatCard label="Blocked" value={counts.blocked} tone="red" />
      </div>

      <Card>
        {loading ? (
          <SkeletonRows rows={4} />
        ) : (
          <DataTable
            columns={columns}
            rows={projects}
            rowKey={(p) => p.id}
            empty={
              <EmptyState
                icon="◆"
                message="No projects yet."
                action={
                  <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
                    Create your first project
                  </Button>
                }
              />
            }
          />
        )}
      </Card>

      <ProjectModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(project) => {
          setProjects((cur) => [project, ...cur]);
          success('Project created');
          setOpen(false);
        }}
        onError={error}
      />
    </main>
  );
}

function ProjectModal({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [focusLevel, setFocusLevel] = useState<FocusLevel>('medium');
  const [strategicValue, setStrategicValue] = useState('5');
  const [revenuePotential, setRevenuePotential] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setName('');
    setStatus('active');
    setFocusLevel('medium');
    setStrategicValue('5');
    setRevenuePotential('');
  }

  async function submit() {
    if (!name.trim()) {
      onError('Name is required');
      return;
    }
    setSaving(true);
    const res = await api.post<Project>('/api/projects', {
      name: name.trim(),
      status,
      focus_level: focusLevel,
      strategic_value: Number(strategicValue) || 5,
      revenue_potential: Number(revenuePotential) || null,
      next_action: null,
      blocker: null,
      notes: null,
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
      title="New Project"
      subtitle="Define a strategic initiative and how much focus it deserves."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Create Project</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Launch storefront" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="complete">Complete</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="Focus Level">
            <Select value={focusLevel} onChange={(e) => setFocusLevel(e.target.value as FocusLevel)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Strategic Value (1-10)">
            <Input
              type="number"
              min={1}
              max={10}
              value={strategicValue}
              onChange={(e) => setStrategicValue(e.target.value)}
              placeholder="5"
            />
          </Field>
          <Field label="Revenue Potential ($)">
            <Input
              type="number"
              min={0}
              value={revenuePotential}
              onChange={(e) => setRevenuePotential(e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
