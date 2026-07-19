'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api-client';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

interface NavItem {
  href: Route;
  label: string;
  icon: string;
}

const CORE: NavItem[] = [
  { href: '/today' as Route, label: 'Today', icon: '⬡' },
  { href: '/empire' as Route, label: 'Empire', icon: '◉' },
  { href: '/ai/input' as Route, label: 'Inputs', icon: '⇥' },
  { href: '/recorder' as Route, label: 'Recorder', icon: '●' },
  { href: '/actions' as Route, label: 'Actions', icon: '⚡' },
  { href: '/decisions' as Route, label: 'Decisions', icon: '◈' },
  { href: '/modules' as Route, label: 'Modules', icon: '▤' },
  { href: '/dashboard' as Route, label: 'Dashboard', icon: '▣' },
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
        'group relative flex items-center gap-3 px-3.5 py-2.5 mx-3 rounded-lg text-[13.5px] transition-all duration-150',
        active
          ? 'bg-empire-blue/12 text-gray-100 border border-empire-blue/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]'
          : 'text-gray-400 border border-transparent hover:text-gray-100 hover:bg-surface-2/70 hover:border-border',
      )}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-empire-blue shadow-[0_0_10px_rgba(201,166,89,0.7)]" />}
      <span
        className={cn(
          'w-4 text-center font-mono transition-colors',
          active ? 'text-empire-blue' : 'text-empire-muted group-hover:text-empire-blue',
        )}
      >
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
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
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <>
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-5 pb-2 text-[10px] font-mono tracking-[0.24em] text-empire-muted/70 uppercase">
          Spine
        </div>
        <div className="space-y-1">
          {CORE.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="px-5 pt-6 pb-2 text-[10px] font-mono tracking-[0.24em] text-empire-muted/70 uppercase">
          Control
        </div>
        <div className="space-y-1">
          <NavLink
            item={{ href: '/settings/passkeys' as Route, label: 'Passkeys', icon: '◇' }}
            active={isActive('/settings/passkeys')}
            onNavigate={onNavigate}
          />
          <NavLink
            item={{ href: '/settings/ai' as Route, label: 'AI Providers', icon: '⚙' }}
            active={isActive('/settings/ai')}
            onNavigate={onNavigate}
          />
          <NavLink
            item={{ href: '/settings/empire-doctor' as Route, label: 'Empire Doctor', icon: '✚' }}
            active={isActive('/settings/empire-doctor')}
            onNavigate={onNavigate}
          />
          <button
            onClick={onLogout}
            className="group flex w-[calc(100%-1.5rem)] items-center gap-3 px-3.5 py-2.5 mx-3 rounded-lg text-[13.5px] text-gray-400 border border-transparent hover:text-gray-100 hover:bg-surface-2/70 hover:border-border transition-all duration-150"
          >
            <span className="w-4 text-center font-mono text-empire-muted group-hover:text-empire-blue">⏻</span>
            Sign out
          </button>
        </div>
      </nav>
      <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-surface-1/40">
        <ThemeToggle />
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
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-empire-blue/15 text-empire-blue font-mono text-base border border-empire-blue/25 shadow-glow">
        ⬡
      </span>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold text-gray-100 tracking-[-0.01em]">Empire OS</div>
        <div className="text-[9px] font-mono tracking-[0.28em] text-empire-blue uppercase mt-0.5">Execution OS</div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center justify-between px-4 bg-surface-1/88 backdrop-blur-xl border-b border-border shadow-card">
        <Brand />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-300 hover:bg-surface-2 transition-colors border border-border"
        >
          <span className="text-lg leading-none font-mono">☰</span>
        </button>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-surface-1 border-r border-border flex flex-col animate-slide-in shadow-card-hover">
            <div className="px-5 py-5 border-b border-border flex items-center justify-between bg-surface-1/60">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-empire-muted hover:text-gray-100 transition-colors p-1 font-mono"
              >
                ✕
              </button>
            </div>
            <NavBody pathname={pathname} onLogout={logout} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <aside className="hidden lg:flex w-[248px] shrink-0 bg-surface-1/95 border-r border-border flex-col h-screen sticky top-0 shadow-card">
        <div className="px-5 py-6 border-b border-border bg-surface-1/60 relative">
          <Brand />
          <div className="absolute left-5 right-5 bottom-0 h-px bg-hairline" />
        </div>
        <NavBody pathname={pathname} onLogout={logout} />
      </aside>
    </>
  );
}
