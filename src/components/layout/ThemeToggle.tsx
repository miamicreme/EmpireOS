'use client';

import { cn } from '@/lib/cn';
import { useTheme } from './ThemeProvider';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to day theme'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-gray-300 transition-all hover:border-empire-blue/50 hover:text-empire-blue',
        className,
      )}
    >
      <span className="text-xs">{theme === 'light' ? '☾' : '☀'}</span>
      {theme === 'light' ? 'Dark' : 'Day'}
    </button>
  );
}
