'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeApi {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeApi | null>(null);

const STORAGE_KEY = 'empireos-theme';

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

/** Day between 7:00 and 18:59 local time, dark otherwise. */
function timeTheme(): Theme {
  const h = new Date().getHours();
  return h >= 7 && h < 19 ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
}

/**
 * A stored value means the user chose manually — that wins. Otherwise the app
 * follows local time of day and keeps it in sync while open. A blocking
 * inline script (see layout.tsx) applies the same logic before first paint to
 * avoid a flash of the wrong theme; this provider just keeps React state (and
 * later toggles) in sync with that.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [manual, setManual] = useState<Theme | null>(null);
  const [auto, setAuto] = useState<Theme>('dark');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable (private mode, etc.) — fall back to auto.
    }
    if (stored === 'light' || stored === 'dark') setManual(stored);
    setAuto(timeTheme());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (manual) return;
    const id = setInterval(() => setAuto(timeTheme()), 60_000);
    return () => clearInterval(id);
  }, [manual]);

  const theme = manual ?? auto;

  useEffect(() => {
    if (hydrated) applyTheme(theme);
  }, [theme, hydrated]);

  function toggleTheme() {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setManual(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort persistence only.
    }
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

/** Inline, render-blocking script that sets `.light` on <html> before paint. */
export function ThemeInitScript() {
  const code = `(function(){try{var s=localStorage.getItem('${STORAGE_KEY}');var h=new Date().getHours();var auto=(h>=7&&h<19)?'light':'dark';var t=(s==='light'||s==='dark')?s:auto;if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();`;
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
