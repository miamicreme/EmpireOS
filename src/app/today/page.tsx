import Link from 'next/link';
import type { Route } from 'next';
import { Card, CardHeader } from '@/components/ui/Card';
import { TodayCommandBar } from '@/components/today/TodayCommandBar';
import { ActionDraftApprovals } from '@/components/today/ActionDraftApprovals';
import { getTodayCommandData } from '@/lib/today/today-data';
import type { PrioritizedAction } from '@/spine/ai/ai.types';

export const dynamic = 'force-dynamic';

function money(value: number | null) {
  return value == null ? '—' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function PriorityLine({ action, empty }: { action: PrioritizedAction | null; empty: string }) {
  if (!action) return <p className="text-sm text-empire-muted">{empty}</p>;
  return (
    <div>
      <p className="text-sm font-medium text-gray-100">{action.title}</p>
      <p className="mt-1 text-xs text-empire-muted">{action.priorityReasons.join(' · ') || `Spine rank ${action.rankScore ?? 0}`}</p>
    </div>
  );
}

export default async function TodayPage() {
  const data = await getTodayCommandData();
  const target = data.derived.cashTargetToday;
  const gap = data.derived.cashGapToday;
  const collected = data.derived.cashCollectedToday;
  const risk = gap && gap > 0
    ? `${money(gap)} cash gap remains today.`
    : data.derived.overdueActionCount > 0
      ? `${data.derived.overdueActionCount} overdue action(s) can erode momentum.`
      : 'No critical risk is visible from current Spine/module signals.';

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      {!data.userId && (
        <div className="mb-4 rounded-lg border border-empire-yellow/20 bg-empire-yellow/10 px-4 py-3 text-sm font-mono text-empire-yellow">
          Not signed in — showing seeded empty-state guidance until Supabase auth is connected.
        </div>
      )}

      <section className="mb-5 rounded-3xl border border-border bg-[radial-gradient(circle_at_top_left,rgba(201,166,89,0.16),transparent_34%),linear-gradient(135deg,rgb(var(--surface-1)),rgb(var(--surface-0)))] p-5 shadow-card sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.25em] text-empire-blue">Today Command Center</p>
            <h1 className="mt-2 text-2xl font-semibold text-gray-100 sm:text-3xl">What is the highest-value move today?</h1>
          </div>
          <Link href={'/dashboard' as Route} className="text-xs font-mono text-empire-muted hover:text-empire-blue">Status dashboard →</Link>
        </div>
        <TodayCommandBar defaultCommand="Brief me on today's highest-value move and draft only approval-gated actions." />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="space-y-4 xl:col-span-2">
          <Card className="border-empire-blue/30 bg-surface-1/95">
            <CardHeader title="Today's Highest-Value Move" subtitle="Spine-ranked, AI-readable priority" />
            <div className="p-4">
              <PriorityLine action={data.highestValueMove} empty="Create or sync a high-impact Spine action. Start with cash, follow-ups, or the nearest irreversible deadline." />
            </div>
          </Card>

          <Card>
            <CardHeader title="AI Daily Brief" subtitle="Latest compact agent artifact" />
            <div className="p-4 text-sm text-gray-200">
              {data.dailyBrief ? (data.dailyBrief.summary ?? 'Daily brief artifact is ready. Use Go Deeper for full analysis.') : 'No daily brief yet. Run the AI command bar to produce a brief from existing Spine, modules, and agent context.'}
            </div>
          </Card>

          <Card>
            <CardHeader title="Top 5 Actions" subtitle="No separate priority engine; this view starts from Spine-ranked actions" />
            <div className="divide-y divide-border">
              {data.topActions.length === 0 ? (
                <p className="p-4 text-sm text-empire-muted">No open actions yet. Add one Spine action or ask AI to draft approval-gated actions.</p>
              ) : data.topActions.map((action, index) => (
                <div key={action.id} className="flex gap-3 p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-empire-blue/15 text-xs font-mono text-empire-blue">{index + 1}</span>
                  <PriorityLine action={action} empty="" />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="AI Action Drafts Awaiting Approval" subtitle="Approve, reject, or edit before anything becomes a Spine action" />
            <div className="p-4"><ActionDraftApprovals drafts={data.pendingDrafts} /></div>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card><CardHeader title="Cash Target / Cash Gap" /><div className="p-4 text-sm text-gray-200">Target {money(target)} · Collected {money(collected)} · Gap <span className="text-empire-yellow">{money(gap)}</span></div></Card>
          <Card><CardHeader title="Job Hunt Priority" /><div className="p-4"><PriorityLine action={data.jobPriority} empty="No job action is currently above the fold. Add applications/follow-ups or sync the job module." /></div></Card>
          <Card><CardHeader title="Follow-Ups Due" subtitle={`${data.derived.followUpsDueCount ?? 0} due`} /><div className="p-4"><PriorityLine action={data.followUpPriority} empty="No follow-up action is due. Queue the next high-value relationship touch." /></div></Card>
          <Card><CardHeader title="Credit/Funding Move" /><div className="p-4"><PriorityLine action={data.creditPriority} empty="No credit/funding move is ranked. Add disputes, utilization work, or funding prep to the module." /></div></Card>
          <Card><CardHeader title="Project Priority" /><div className="p-4"><PriorityLine action={data.projectPriority} empty="No project action is ranked. Pick the nearest revenue or blocker-removal project move." /></div></Card>
          <Card><CardHeader title="Acquisition/Deal Priority" /><div className="p-4"><PriorityLine action={data.dealPriority} empty="No deal action is ranked. Add a target, outreach, or diligence task before pursuing new deals." /></div></Card>
          <Card className="border-empire-red/25"><CardHeader title="Risk Warning" /><div className="p-4 text-sm text-empire-red">{risk}</div></Card>
        </aside>
      </div>
    </main>
  );
}
