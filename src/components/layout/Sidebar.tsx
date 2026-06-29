'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api-client';

interface NavItem {
  href: Route;
  label: string;
  icon: string;
}

const CORE: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '⬡' },
  { href: '/actions', label: 'Actions', icon: '⚡' },
  { href: '/decisions', label: 'Decisions', icon: '◈' },
];

const MODULES: NavItem[] = [
  { href: '/modules/cash-engine', label: 'Cash Engine', icon: '$' },
  { href: '/modules/job-hunt', label: 'Job Hunt', icon: '↗' },
  { href: '/modules/followup-crm', label: 'Follow-ups', icon: '◎' },
  { href: '/modules/credit-funding', label: 'Credit', icon: '▲' },
  { href: '/modules/projects', label: 'Projects', icon: '◻' },
  { href: '/modules/acquisitions', label: 'Acquisitions', icon: '◆' },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm transition-all duration-150',
        active
          ? 'bg-surface-3 text-gray-100'
          : 'text-gray-400 hover:text-gray-100 hover:bg-surface-2',
      )}
    >
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-empire-blue" />
      )}
      <span
        className={cn(
          'w-4 text-center font-mono transition-colors',
          active ? 'text-empire-blue' : 'text-empire-muted group-hover:text-gray-300',
        )}
      >
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  async function logout() {
    await api.post('/api/auth/logout', {});
    router.replace('/login' as Route);
    router.refresh();
  }

  return (
    <aside className="w-56 shrink-0 bg-surface-1 border-r border-border flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-border flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-empire-blue/15 text-empire-blue font-mono text-sm">
          ⬡
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-gray-100">Empire OS</div>
          <div className="text-[10px] font-mono tracking-widest text-empire-muted uppercase">
            Execution OS
          </div>
        </div>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="space-y-0.5">
          {CORE.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>
        <div className="px-5 pt-5 pb-2 text-[10px] font-mono tracking-widest text-empire-muted/70 uppercase">
          Modules
        </div>
        <div className="space-y-0.5">
          {MODULES.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>
        <div className="px-5 pt-5 pb-2 text-[10px] font-mono tracking-widest text-empire-muted/70 uppercase">
          Account
        </div>
        <div className="space-y-0.5">
          <NavLink
            item={{ href: '/settings/passkeys' as Route, label: 'Passkeys', icon: '◇' }}
            active={isActive('/settings/passkeys')}
          />
          <button
            onClick={logout}
            className="group relative flex w-[calc(100%-1rem)] items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm text-gray-400 hover:text-gray-100 hover:bg-surface-2 transition-all duration-150"
          >
            <span className="w-4 text-center font-mono text-empire-muted group-hover:text-gray-300">
              ⏻
            </span>
            Sign out
          </button>
        </div>
      </nav>

      <div className="px-5 py-3 border-t border-border flex items-center justify-between">
        <span className="text-[10px] text-empire-muted font-mono">v0.1.0</span>
        <span className="flex items-center gap-1.5 text-[10px] text-empire-muted font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-empire-green animate-pulse-dot" />
          live
        </span>
      </div>
    </aside>
  );
}
