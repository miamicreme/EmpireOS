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
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import type { Contact, ContactType } from '@/spine/types';

const CONTACT_TYPES: ContactType[] = [
  'recruiter',
  'lead',
  'partner',
  'mentor',
  'broker',
  'vendor',
  'other',
];

type Status = Contact['status'];

function statusBadgeVariant(status: Status): 'green' | 'muted' {
  return status === 'active' ? 'green' : 'muted';
}

export default function FollowupCrmPage() {
  const { success, error } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<Contact[]>('/api/contacts');
    if (res.ok) setContacts(res.data);
    else error(res.error.message);
    setLoading(false);
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const today = new Date().toISOString();
    const total = contacts.length;
    const active = contacts.filter((c) => c.status === 'active').length;
    const cold = contacts.filter((c) => c.status === 'cold').length;
    const due = contacts.filter(
      (c) =>
        c.status !== 'archived' &&
        c.next_follow_up_at != null &&
        c.next_follow_up_at <= today,
    ).length;
    return { total, active, cold, due };
  }, [contacts]);

  async function handleDelete(contact: Contact) {
    const prev = contacts;
    setContacts((cur) => cur.filter((c) => c.id !== contact.id));
    const res = await api.del(`/api/contacts/${contact.id}`);
    if (res.ok) success('Contact deleted');
    else {
      setContacts(prev);
      error(res.error.message);
    }
  }

  const columns: Array<Column<Contact>> = [
    {
      key: 'name',
      header: 'Name',
      render: (c) => (
        <div className="min-w-0">
          <p className="text-gray-100 truncate">{c.name}</p>
          {c.company && <p className="text-xs text-empire-muted truncate mt-0.5">{c.company}</p>}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: '130px',
      render: (c) => <Badge variant="blue">{c.contact_type}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (c) => <Badge variant={statusBadgeVariant(c.status)}>{c.status}</Badge>,
    },
    {
      key: 'next',
      header: 'Next follow-up',
      width: '140px',
      align: 'right',
      render: (c) => (
        <span className="nums text-gray-300">{c.next_follow_up_at?.slice(0, 10) ?? '—'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      align: 'right',
      render: (c) => (
        <button
          onClick={() => handleDelete(c)}
          className="text-empire-muted hover:text-empire-red transition-colors text-xs font-mono"
          aria-label="Delete contact"
        >
          ✕
        </button>
      ),
    },
  ];

  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader
        title="Follow-ups"
        subtitle="Track relationships and stay on top of your follow-up cadence."
        action={<Button onClick={() => setOpen(true)} icon={<span>+</span>}>Add Contact</Button>}
      />

      <ModuleCopilotPanel moduleId="followup-crm" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Contacts" value={stats.total} tone="violet" />
        <StatCard label="Active" value={stats.active} tone="green" />
        <StatCard label="Cold" value={stats.cold} tone="muted" />
        <StatCard label="Due" value={stats.due} tone="yellow" />
      </div>

      <Card>
        {loading ? (
          <SkeletonRows rows={4} />
        ) : (
          <DataTable
            columns={columns}
            rows={contacts}
            rowKey={(c) => c.id}
            empty={
              <EmptyState
                icon="@"
                message="No contacts yet."
                action={<Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Add your first contact</Button>}
              />
            }
          />
        )}
      </Card>

      <ContactModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(contact) => {
          setContacts((cur) => [contact, ...cur]);
          success('Contact added');
          setOpen(false);
        }}
        onError={error}
      />
    </main>
  );
}

function ContactModal({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (contact: Contact) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [contactType, setContactType] = useState<ContactType>('lead');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('active');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setName('');
    setContactType('lead');
    setCompany('');
    setEmail('');
    setPhone('');
    setStatus('active');
    setNextFollowUp('');
    setNotes('');
  }

  async function submit() {
    if (!name.trim()) {
      onError('Name is required');
      return;
    }
    setSaving(true);
    const res = await api.post<Contact>('/api/contacts', {
      name: name.trim(),
      contact_type: contactType,
      company: company.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      status,
      next_follow_up_at: nextFollowUp ? new Date(nextFollowUp).toISOString() : null,
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
      title="Add Contact"
      subtitle="Add a relationship to track and follow up with."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Save Contact</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Doe" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required>
            <Select value={contactType} onChange={(e) => setContactType(e.target.value as ContactType)}>
              {CONTACT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <option value="active">active</option>
              <option value="cold">cold</option>
              <option value="archived">archived</option>
            </Select>
          </Field>
        </div>
        <Field label="Company">
          <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Optional" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <Field label="Next follow-up">
          <Input type="date" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </Field>
      </div>
    </Modal>
  );
}
