import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Empire OS — Execution Operating System',
  description: 'Private execution operating system: cash, decisions, and momentum in one command center.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface-0 text-gray-100 min-h-screen lg:flex antialiased">
        <ToastProvider>
          <Sidebar />
          {/* pt-14 clears the fixed mobile top bar; reset on desktop where the sidebar is inline */}
          <div className="relative flex-1 flex flex-col min-w-0 pt-14 lg:pt-0">
            {/* Ambient background */}
            <div className="pointer-events-none fixed inset-0 bg-grid-faint [background-size:32px_32px]" />
            <div className="pointer-events-none fixed inset-0 bg-radial-glow" />
            <div className="relative flex-1 flex flex-col min-w-0">{children}</div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
