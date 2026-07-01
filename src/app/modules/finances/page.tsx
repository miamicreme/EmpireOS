'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/Stat';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Field';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api, usd } from '@/lib/api-client';

interface Account {
  id: string;
  name: string;
  account_type: string;
  balance: number;
  is_liability: boolean;
  institution: string | null;
}
interface Txn {
  id: string;
  description: string;
  amount: number;
  kind: 'income' | 'expense';
  category: string | null;
  recurring: boolean;
  cadence: string;
  occurred_on: string;
}
interface Insights {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  liquidAssets: number;
  monthlyRecurringExpense: number;
  monthlyRecurringIncome: number;
  monthlyNet: number;
  runwayMonths: number | null;
  topExpenseCategories: Array<{ category: string; monthly: number }>;
  accountCount: number;
}
interface Snapshot {
  accounts: Account[];
  transactions: Txn[];
  insights: Insights;
}
interface AiSummary {
  headline: string;
  state: string;
  strengths: string[];
  risks: string[];
  moves: Array<{ title: string; why: string }>;
  confidence: number;
}

const ACCOUNT_TYPES = [
  'checking', 'savings', 'cash', 'investment', 'retirement', 'credit_card', 'loan', 'mortgage', 'other',
];

export default function FinancesPage() {
  const { success, error } = useToast();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAccount, setShowAccount] = useState(false);
  const [showTxn, setShowTxn] = useState(false);
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<Snapshot>('/api/finances/summary');
    if (res.ok) setSnap(res.data);
    else error(res.error.message);
    setLoading(false);
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  async function summarize() {
    setSummarizing(true);
    const res = await api.post<{ output: AiSummary }>('/api/ai/finances/summary', {});
    setSummarizing(false);
    if (res.ok) setSummary(res.data.output);
    else error(res.error.message);
  }

  const i = snap?.insights;

  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader
        title="Finances"
        subtitle="Your full financial picture — net worth, accounts, spending, burn, and runway."
      />

      {loading ? (
        <SkeletonRows />
      ) : (
        <div className="space-y-6 max-w-5xl">
          {/* Insight stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Net Worth" value={usd(i?.netWorth ?? 0)} tone={(i?.netWorth ?? 0) >= 0 ? 'green' : 'red'} />
            <StatCard label="Liquid Assets" value={usd(i?.liquidAssets ?? 0)} />
            <StatCard label="Monthly Burn" value={usd(i?.monthlyRecurringExpense ?? 0)} />
            <StatCard
              label="Runway"
              value={i?.runwayMonths === null || i?.runwayMonths === undefined ? '∞' : `${i.runwayMonths} mo`}
              tone={i?.runwayMonths !== null && i?.runwayMonths !== undefined && i.runwayMonths < 3 ? 'red' : 'muted'}
            />
          </div>

          {/* AI summary */}
          <Card>
            <CardHeader title="AI financial summary" subtitle="A grounded read on your money + top moves" />
            <div className="p-4">
              {summary ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-100">{summary.headline}</p>
                  <p className="text-sm text-gray-300 leading-relaxed">{summary.state}</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {summary.strengths.length > 0 && (
                      <div>
                        <p className="text-[11px] font-mono uppercase tracking-widest text-empire-green mb-1">Strengths</p>
                        <ul className="text-sm text-gray-300 space-y-0.5">{summary.strengths.map((s, k) => <li key={k}>· {s}</li>)}</ul>
                      </div>
                    )}
                    {summary.risks.length > 0 && (
                      <div>
                        <p className="text-[11px] font-mono uppercase tracking-widest text-empire-red mb-1">Risks</p>
                        <ul className="text-sm text-gray-300 space-y-0.5">{summary.risks.map((s, k) => <li key={k}>· {s}</li>)}</ul>
                      </div>
                    )}
                  </div>
                  {summary.moves.length > 0 && (
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-widest text-empire-blue mb-1">Moves</p>
                      <ul className="text-sm text-gray-200 space-y-1">
                        {summary.moves.map((m, k) => (
                          <li key={k}><span className="text-empire-blue">▹</span> <span className="font-medium">{m.title}</span> — <span className="text-empire-muted">{m.why}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Button variant="ghost" onClick={summarize} loading={summarizing}>Regenerate</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-empire-muted">Get an AI read on your net worth, burn, runway, and the top money moves.</p>
                  <Button onClick={summarize} loading={summarizing}>Analyze finances</Button>
                </div>
              )}
            </div>
          </Card>

          {/* Accounts */}
          <Card>
            <CardHeader title="Accounts" subtitle={`Assets ${usd(i?.totalAssets ?? 0)} · Liabilities ${usd(i?.totalLiabilities ?? 0)}`}
              action={<Button size="sm" onClick={() => setShowAccount(true)}>+ Account</Button>} />
            <div className="p-4">
              {snap && snap.accounts.length > 0 ? (
                <div className="divide-y divide-border">
                  {snap.accounts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <span className="text-sm text-gray-100">{a.name}</span>{' '}
                        <Badge variant={a.is_liability ? 'red' : 'muted'}>{a.account_type.replace('_', ' ')}</Badge>
                        {a.institution && <span className="text-xs text-empire-muted ml-2">{a.institution}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-mono ${a.is_liability ? 'text-empire-red' : 'text-gray-100'}`}>
                          {a.is_liability ? '-' : ''}{usd(Math.abs(a.balance))}
                        </span>
                        <button className="text-empire-muted hover:text-empire-red text-xs" onClick={async () => {
                          const res = await api.del(`/api/finances/accounts/${a.id}`);
                          if (res.ok) { success('Account removed'); void load(); } else error(res.error.message);
                        }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No accounts yet — add your bank, credit card, investment, and loan accounts to see net worth." />
              )}
            </div>
          </Card>

          {/* Transactions / bills */}
          <Card>
            <CardHeader title="Income & expenses" subtitle="Recurring items drive burn & runway"
              action={<Button size="sm" onClick={() => setShowTxn(true)}>+ Entry</Button>} />
            <div className="p-4">
              {snap && snap.transactions.length > 0 ? (
                <div className="divide-y divide-border">
                  {snap.transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <span className="text-sm text-gray-100">{t.description}</span>{' '}
                        {t.recurring && <Badge variant="blue">{t.cadence}</Badge>}
                        {t.category && <span className="text-xs text-empire-muted ml-2">{t.category}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-mono ${t.kind === 'income' ? 'text-empire-green' : 'text-gray-100'}`}>
                          {t.kind === 'income' ? '+' : '-'}{usd(t.amount)}
                        </span>
                        <button className="text-empire-muted hover:text-empire-red text-xs" onClick={async () => {
                          const res = await api.del(`/api/finances/transactions/${t.id}`);
                          if (res.ok) { success('Entry removed'); void load(); } else error(res.error.message);
                        }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No entries yet — add recurring bills, subscriptions, and income to compute monthly burn and runway." />
              )}
            </div>
          </Card>
        </div>
      )}

      {showAccount && (
        <AccountModal
          onClose={() => setShowAccount(false)}
          onSaved={() => { setShowAccount(false); void load(); success('Account added'); }}
          onError={error}
          types={ACCOUNT_TYPES}
        />
      )}
      {showTxn && (
        <TxnModal
          onClose={() => setShowTxn(false)}
          onSaved={() => { setShowTxn(false); void load(); success('Entry added'); }}
          onError={error}
        />
      )}
    </main>
  );
}

function AccountModal({ onClose, onSaved, onError, types }: {
  onClose: () => void; onSaved: () => void; onError: (m: string) => void; types: string[];
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('checking');
  const [balance, setBalance] = useState('');
  const [institution, setInstitution] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return onError('Name is required');
    setSaving(true);
    const res = await api.post('/api/finances/accounts', {
      name: name.trim(), account_type: type, balance: Number(balance) || 0,
      institution: institution.trim() || null,
    });
    setSaving(false);
    if (res.ok) onSaved(); else onError(res.error.message);
  }

  return (
    <Modal open title="Add account" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chase Checking" /></Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </Select>
        </Field>
        <Field label="Balance (owed for credit/loan)"><Input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" /></Field>
        <Field label="Institution (optional)"><Input value={institution} onChange={(e) => setInstitution(e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Add</Button>
        </div>
      </div>
    </Modal>
  );
}

function TxnModal({ onClose, onSaved, onError }: {
  onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('');
  const [cadence, setCadence] = useState('monthly');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!description.trim()) return onError('Description is required');
    setSaving(true);
    const recurring = cadence !== 'once';
    const res = await api.post('/api/finances/transactions', {
      description: description.trim(), amount: Number(amount) || 0, kind,
      category: category.trim() || null, recurring, cadence,
    });
    setSaving(false);
    if (res.ok) onSaved(); else onError(res.error.message);
  }

  return (
    <Modal open title="Add income / expense" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Rent, Netflix, salary…" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as 'income' | 'expense')}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="housing, food…" /></Field>
          <Field label="Cadence">
            <Select value={cadence} onChange={(e) => setCadence(e.target.value)}>
              <option value="once">One-off</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Add</Button>
        </div>
      </div>
    </Modal>
  );
}
