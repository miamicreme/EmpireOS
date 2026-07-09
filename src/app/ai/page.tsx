import Link from 'next/link';
import type { Route } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { AiChiefOfStaffWidget } from '@/components/ui/ai/AiDashboardWidgets';

export const dynamic = 'force-dynamic';

const LINKS: Array<{ href: Route; title: string; desc: string; icon: string }> = [
  { href: '/ai/org' as Route, title: 'AI Organization', desc: 'Full EmpireOS AI company chart', icon: '♜' },
  { href: '/ai/team-templates' as Route, title: 'Team Templates', desc: 'Reusable AI team blueprints', icon: '▦' },
  { href: '/ai/teams' as Route, title: 'AI Teams', desc: 'Active teams, missions, and members', icon: '☷' },
  { href: '/ai/review' as Route, title: 'Review Queue', desc: 'Mission packages before Spine updates', icon: '✓' },
  { href: '/ai/input' as Route, title: 'Universal Input', desc: 'Upload, analyze, and hand off artifacts', icon: '⌁' },
  { href: '/ai/camera' as Route, title: 'Camera', desc: 'Explicit snapshot and frame sampling flow', icon: '◩' },
  { href: '/ai/memory' as Route, title: 'Memory', desc: 'Durable memory states and controls', icon: '◌' },
  { href: '/ai/providers' as Route, title: 'Providers', desc: 'Provider readiness and live tests', icon: '⚙' },
  { href: '/settings/security' as Route, title: 'Security', desc: 'Owner posture and passkey status', icon: '⟡' },
  { href: '/ai/brief' as Route, title: 'Daily Brief', desc: 'Cash target, top actions, risks', icon: '☀' },
  { href: '/ai/recommendations' as Route, title: 'Recommendations', desc: 'Track AI recommendations over time', icon: '◈' },
  { href: '/ai/decisions' as Route, title: 'Decision Console', desc: 'Ask a decision, get actions', icon: '⚖' },
  { href: '/ai/chat' as Route, title: 'Ask Empire OS', desc: 'Free-form chat with your empire', icon: '✦' },
];

export default function AiHubPage() {
  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader
        title="AI Chief of Staff"
        subtitle="Empire OS reads your Spine + Modules, creates missions, and routes controlled work to AI Teams"
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <AiChiefOfStaffWidget />
        </div>
        <div className="flex flex-col gap-3">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              <Card hover className="p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-empire-blue/15 text-empire-blue font-mono">
                    {l.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-100">{l.title}</div>
                    <div className="text-xs text-empire-muted truncate">{l.desc}</div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
