'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api-client';

interface NavItem {
  href: Route;
  label: string;
  icon: string;
}

const CORE: NavItem[] = [
  { href: '/' as Route, label: 'Dashboard', icon: '⬡' },
  { href: '/actions' as Route, label: 'Actions', icon: '⚡' },
  { href: '/decisions' as Route, label: 'Decisions', icon: '◈' },
];

const MODULES: NavItem[] = [
  { href: '/modules/cash-engine' as Route, label: 'Cash Engine', icon: '$' },
  { href: '/modules/job-hunt' as Route, label: 'Job Hunt', icon: '↗' },
  { href: '/modules/followup-crm' as Route, label: 'Follow-ups', icon: '◎' },
  { href: '/modules/credit-funding' as Route, label: 'Credit', icon: '▲' },
  { href: '/modules/projects' as Route, label: 'Projects', icon: '◻' },
  { href: '/modules/acquisitions' as Route, label: 'Acquisitions', icon: '◆' },
];

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'group relative flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm transition-all duration-150',
        active ? 'bg-surface-3 text-gray-100' : 'text-gray-400 hover:text-gray-100 hover:bg-surface-2',
      )}
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-empire-blue" />}
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

function NavBody({
  pathname,
  onLogout,
  onNavigate,
}: {
  pathname: string;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <>
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="space-y-0.5">
          {CORE.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="px-5 pt-5 pb-2 text-[10px] font-mono tracking-widest text-empire-muted/70 uppercase">
          Modules
        </div>
        <div className="space-y-0.5">
          {MODULES.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="px-5 pt-5 pb-2 text-[10px] font-mono tracking-widest text-empire-muted/70 uppercase">
          Account
        </div>
        <div className="space-y-0.5">
          <NavLink
            item={{ href: '/settings/passkeys' as Route, label: 'Passkeys', icon: '◇' }}
            active={isActive('/settings/passkeys')}
            onNavigate={onNavigate}
          />
          <button
            onClick={onLogout}
            className="group flex w-[calc(100%-1rem)] items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm text-gray-400 hover:text-gray-100 hover:bg-surface-2 transition-all duration-150"
          >
            <span className="w-4 text-center font-mono text-empire-muted group-hover:text-gray-300">⏻</span>
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
    </>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-empire-blue/15 text-empire-blue font-mono text-sm">
        ⬡
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-gray-100">Empire OS</div>
        <div className="text-[10px] font-mono tracking-widest text-empire-muted uppercase">Execution OS</div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close the drawer when the viewport grows to desktop, so the scroll lock is
  // never left on in a state where the drawer (and its close control) is hidden.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  async function logout() {
    await api.post('/api/auth/logout', {});
    router.replace('/login' as Route);
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center justify-between px-4 bg-surface-1/95 backdrop-blur border-b border-border">
        <Brand />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-300 hover:bg-surface-2 transition-colors"
        >
          <span className="text-lg leading-none">☰</span>
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-surface-1 border-r border-border flex flex-col animate-slide-in">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-empire-muted hover:text-gray-100 transition-colors p-1"
              >
                ✕
              </button>
            </div>
            <NavBody pathname={pathname} onLogout={logout} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-surface-1 border-r border-border flex-col h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-border">
          <Brand />
        </div>
        <NavBody pathname={pathname} onLogout={logout} />
      </aside>
    </>
  );
}
