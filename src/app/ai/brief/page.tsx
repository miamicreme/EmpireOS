import { PageHeader } from '@/components/ui/PageHeader';
import { AiBriefPanel } from '@/components/ui/ai/AiBriefPanel';
import type { DailyBriefOutput } from '@/spine/ai/ai.types';

export const dynamic = 'force-dynamic';

async function loadBrief(): Promise<DailyBriefOutput | null> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const { requireUserId } = await import('@/lib/security');
    const { getBrief } = await import('@/spine/ai/daily-brief.service');
    const supabase = createClient();
    const auth = await requireUserId(supabase);
    if (!auth.ok) return null;
    const result = await getBrief(supabase, auth.data, { briefType: 'daily' });
    if (!result.ok || !result.data) return null;
    const b = result.data;
    return {
      summary: b.summary ?? '',
      cashTarget: b.cash_target,
      topActions: (b.top_actions as DailyBriefOutput['topActions']) ?? [],
      followUps: (b.follow_ups as string[]) ?? [],
      jobHuntPriority: b.job_hunt_priority ?? '',
      projectPriority: b.project_priority ?? '',
      risks: (b.risks as string[]) ?? [],
      opportunities: (b.opportunities as string[]) ?? [],
      recommendedFocus: b.recommended_focus ?? '',
      confidence: b.confidence ?? 0.5,
    };
  } catch {
    return null;
  }
}

export default async function AiBriefPage() {
  const initial = await loadBrief();
  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader title="Daily Brief" subtitle="Your morning operating brief" />
      <div className="max-w-3xl">
        <AiBriefPanel initial={initial} />
      </div>
    </main>
  );
}
