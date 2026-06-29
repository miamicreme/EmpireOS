import { getDashboardData } from '@/lib/dashboard-data';
import { EmpireScoreCard } from '@/components/ui/EmpireScoreCard';
import { ModuleHealthGrid } from '@/components/ui/ModuleHealthGrid';
import { ActionQueue } from '@/components/ui/ActionQueue';
import { DecisionList } from '@/components/ui/DecisionList';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { AiChiefOfStaffWidget } from '@/components/ui/ai/AiDashboardWidgets';
import { MODULE_IDS } from '@/spine/constants';
import type { ModuleHealthResult } from '@/spine/types';
import Link from 'next/link';
import type { Route } from 'next';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { empireScore, moduleHealth, actions, decisions, userId } = await getDashboardData();

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const healthMap = Object.fromEntries(
    moduleHealth.map((h: ModuleHealthResult) => [h.moduleId, h]),
  ) as Partial<Record<(typeof MODULE_IDS)[number], ModuleHealthResult>>;

  const openActions = actions.filter(
    (a) => a.status === 'open' || a.status === 'in_progress',
  );

  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      {!userId && (
        <div className="mb-6 px-4 py-3 bg-empire-yellow/10 border border-empire-yellow/20 rounded-lg text-sm text-empire-yellow font-mono">
          Not signed in — connect Supabase and configure auth to see live data.
        </div>
      )}

      <PageHeader
        title="Command Center"
        subtitle={today}
        action={
          <Link
            href={'/ai' as Route}
            className="text-xs text-empire-blue hover:underline font-mono"
          >
            AI Chief of Staff →
          </Link>
        }
      />

      <div className="mb-5 animate-fade-in">
        <AiChiefOfStaffWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in">
        {/* Left col: score + module health */}
        <div className="col-span-1 flex flex-col gap-5">
          <EmpireScoreCard result={empireScore} date={today} />

          <Card hover>
            <CardHeader title="Module Health" />
            <div className="p-3">
              <ModuleHealthGrid healthMap={healthMap} />
            </div>
          </Card>
        </div>

        {/* Right col: actions + decisions */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card hover>
            <CardHeader
              title="Action Queue"
              subtitle={`${openActions.length} open`}
              action={
                <Link
                  href="/actions/new"
                  className="text-xs text-empire-blue hover:underline font-mono"
                >
                  + New
                </Link>
              }
            />
            <ActionQueue actions={openActions} limit={8} />
          </Card>

          <Card hover>
            <CardHeader
              title="Decisions"
              subtitle={`${decisions.length} total`}
              action={
                <Link
                  href="/decisions/new"
                  className="text-xs text-empire-blue hover:underline font-mono"
                >
                  + New
                </Link>
              }
            />
            <DecisionList decisions={decisions} limit={5} />
          </Card>
        </div>
      </div>
    </main>
  );
}
