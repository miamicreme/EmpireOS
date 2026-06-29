import { PageHeader } from '@/components/ui/PageHeader';
import {
  AiRecommendationsPanel,
  type RecommendationRow,
} from '@/components/ui/ai/AiRecommendationsPanel';

export const dynamic = 'force-dynamic';

async function loadRecommendations(): Promise<RecommendationRow[]> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const { requireUserId } = await import('@/lib/security');
    const { getRecommendations } = await import('@/spine/ai/recommendation.service');
    const supabase = createClient();
    const auth = await requireUserId(supabase);
    if (!auth.ok) return [];
    const result = await getRecommendations(supabase, auth.data);
    if (!result.ok) return [];
    return result.data.map((r) => ({
      id: r.id,
      recommendation: r.recommendation,
      reasoning: r.reasoning,
      confidence: r.confidence,
      risk_level: r.risk_level,
      upside_level: r.upside_level,
      source_type: r.source_type,
      accepted_at: r.accepted_at,
      dismissed_at: r.dismissed_at,
    }));
  } catch {
    return [];
  }
}

export default async function AiRecommendationsPage() {
  const initial = await loadRecommendations();
  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader
        title="AI Recommendations"
        subtitle="What the AI has recommended — accept or dismiss to teach it"
      />
      <div className="max-w-3xl">
        <AiRecommendationsPanel initial={initial} />
      </div>
    </main>
  );
}
