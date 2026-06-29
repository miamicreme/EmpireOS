import Link from 'next/link';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '⬡' },
  { href: '/actions', label: 'Actions', icon: '⚡' },
  { href: '/decisions', label: 'Decisions', icon: '◈' },
  { href: '/modules/cash-engine', label: 'Cash', icon: '$' },
  { href: '/modules/job-hunt', label: 'Job Hunt', icon: '↗' },
  { href: '/modules/followup-crm', label: 'Follow-ups', icon: '◎' },
  { href: '/modules/credit-funding', label: 'Credit', icon: '▲' },
  { href: '/modules/projects', label: 'Projects', icon: '◻' },
  { href: '/modules/acquisitions', label: 'Acquisitions', icon: '◆' },
];

export function Sidebar() {
  return (
    <aside className="w-52 shrink-0 bg-surface-1 border-r border-border flex flex-col h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-border">
        <span className="text-xs font-mono tracking-widest text-empire-muted uppercase">Empire OS</span>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-400 hover:text-gray-100 hover:bg-surface-2 transition-colors"
          >
            <span className="text-empire-muted w-4 text-center font-mono">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-border">
        <span className="text-xs text-empire-muted font-mono">v0.1.0</span>
      </div>
    </aside>
  );
}
