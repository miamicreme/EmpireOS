import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import type { Decision, DecisionVote } from '@/spine/types';
import { Badge, statusVariant } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { AnalyzeButton } from '@/components/ui/AnalyzeButton';

export const dynamic = 'force-dynamic';

async function getDecision(id: string): Promise<{
  decision: Decision | null;
  votes: DecisionVote[];
}> {
  try {
    const supabase = createClient();
    const auth = await requireUserId(supabase);
    if (!auth.ok) return { decision: null, votes: [] };

    const [{ data: decision }, { data: votes }] = await Promise.all([
      supabase
        .from('decisions')
        .select('*')
        .eq('id', id)
        .eq('user_id', auth.data)
        .maybeSingle(),
      supabase
        .from('decision_votes')
        .select('*')
        .eq('decision_id', id)
        .order('created_at', { ascending: true }),
    ]);

    return {
      decision: (decision as Decision | null),
      votes: (votes ?? []) as DecisionVote[],
    };
  } catch {
    return { decision: null, votes: [] };
  }
}

const ROLE_LABELS: Record<string, string> = {
  cash_advisor: 'Cash Advisor',
  career_advisor: 'Career Advisor',
  risk_advisor: 'Risk Advisor',
  deal_advisor: 'Deal Advisor',
  execution_advisor: 'Execution Advisor',
  final_judge: 'Final Judge',
};

function VoteCard({ vote }: { vote: DecisionVote }) {
  const isFinalJudge = vote.advisor_role === 'final_judge';
  return (
    <div
      className={`bg-surface-1 border rounded-lg p-4 ${
        isFinalJudge ? 'border-empire-blue/40' : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-xs font-mono uppercase tracking-wider ${
            isFinalJudge ? 'text-empire-blue' : 'text-empire-muted'
          }`}
        >
          {ROLE_LABELS[vote.advisor_role] ?? vote.advisor_role}
        </span>
        <div className="flex items-center gap-2">
          {vote.confidence != null && (
            <span className="text-xs font-mono text-gray-400">
              {Math.round(vote.confidence * 100)}%
            </span>
          )}
          {vote.model_name && (
            <span className="text-xs font-mono text-empire-muted">{vote.model_name}</span>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-200 mb-2">{vote.recommendation}</p>
      {vote.reasoning && (
        <p className="text-xs text-gray-400 leading-relaxed">{vote.reasoning}</p>
      )}
      {vote.risks && (
        <p className="text-xs text-empire-red/80 mt-2">⚠ {vote.risks}</p>
      )}
      {Array.isArray(vote.next_actions) && (vote.next_actions as string[]).length > 0 && (
        <ul className="mt-3 space-y-1">
          {(vote.next_actions as string[]).map((action, i) => (
            <li key={i} className="text-xs text-gray-400 flex gap-2">
              <span className="text-empire-muted">→</span>
              {action}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function DecisionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { decision, votes } = await getDecision(params.id);

  if (!decision) {
    notFound();
  }

  const canAnalyze = decision.status === 'draft';
  const panelVotes = votes.filter((v) => v.advisor_role !== 'final_judge');
  const judgeVote = votes.find((v) => v.advisor_role === 'final_judge');

  return (
    <main className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="min-w-0 flex-1 mr-4">
            <div className="flex items-center gap-3 mb-1">
              <Link href="/decisions" className="text-xs text-empire-muted hover:text-gray-300 font-mono">
                ← Decisions
              </Link>
            </div>
            <h1 className="text-xl font-semibold text-gray-100">{decision.title}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={statusVariant(decision.status)}>{decision.status}</Badge>
              <span className="text-xs font-mono text-empire-muted">{decision.decision_type}</span>
              <span className="text-xs font-mono text-empire-muted">{decision.created_at.slice(0, 10)}</span>
            </div>
          </div>
          {canAnalyze && <AnalyzeButton decisionId={decision.id} />}
        </div>

        {/* Question & Context */}
        <Card className="mb-5">
          <CardHeader title="Question" />
          <div className="p-4">
            <p className="text-sm text-gray-200 leading-relaxed">{decision.question}</p>
            {decision.context && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-mono text-empire-muted uppercase tracking-wider mb-2">Context</p>
                <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">
                  {decision.context}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Final recommendation */}
        {decision.recommendation && (
          <Card className="mb-5 border-empire-blue/30">
            <CardHeader title="Recommendation" subtitle="Final Judge synthesis" />
            <div className="p-4">
              <p className="text-sm text-gray-200 leading-relaxed">{decision.recommendation}</p>
              {decision.confidence != null && (
                <p className="text-xs font-mono text-empire-muted mt-3">
                  Confidence: {Math.round(decision.confidence * 100)}%
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Analyzing state */}
        {decision.status === 'analyzing' && (
          <div className="mb-5 px-4 py-3 bg-empire-yellow/10 border border-empire-yellow/20 rounded-lg text-sm text-empire-yellow font-mono">
            Analysis in progress… refresh in a moment.
          </div>
        )}

        {/* Advisor panel */}
        {votes.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-mono text-empire-muted uppercase tracking-wider mb-3">
              Advisor Panel
            </p>
            <div className="grid grid-cols-1 gap-3">
              {judgeVote && <VoteCard vote={judgeVote} />}
              {panelVotes.map((vote) => (
                <VoteCard key={vote.id} vote={vote} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state for draft */}
        {decision.status === 'draft' && votes.length === 0 && (
          <div className="bg-surface-1 border border-border rounded-lg px-4 py-10 text-center">
            <p className="text-sm text-empire-muted">
              Run the advisor panel to get recommendations.
            </p>
            <AnalyzeButton decisionId={decision.id} className="mt-4" />
          </div>
        )}
      </div>
    </main>
  );
}
