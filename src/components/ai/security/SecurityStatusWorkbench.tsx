'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Badge } from '@/components/ui/Badge';
import { Card, EmptyState } from '@/components/ui/Card';
import { SkeletonRows } from '@/components/ui/Skeleton';

type SecurityStatus = {
  authenticated: boolean;
  passkeyCount: number;
  passkeysConfigured: boolean;
  recoveryEnabled: boolean;
  secretValuesReturned: boolean;
};

export function SecurityStatusWorkbench() {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await api.get<SecurityStatus>('/api/settings/security/status');
    if (response.ok) setStatus(response.data);
    else setError(response.error.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <SkeletonRows rows={3} />;

  if (error || !status) {
    return (
      <Card className="border-empire-red/20">
        <div className="p-5">
          <EmptyState icon="!" message={error ?? 'Security status unavailable.'} />
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.98fr_1.02fr]">
      <Card>
        <div className="space-y-4 p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Owner-only posture</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant={status.authenticated ? 'green' : 'red'}>{status.authenticated ? 'authenticated' : 'unauthenticated'}</Badge>
            <Badge variant={status.passkeysConfigured ? 'green' : 'yellow'}>
              {status.passkeyCount} passkey{status.passkeyCount === 1 ? '' : 's'}
            </Badge>
            <Badge variant={status.recoveryEnabled ? 'green' : 'yellow'}>
              {status.recoveryEnabled ? 'recovery enabled' : 'recovery not enabled'}
            </Badge>
            <Badge variant={status.secretValuesReturned ? 'red' : 'green'}>
              secrets server-only
            </Badge>
          </div>
          <p className="text-sm leading-6 text-empire-muted">
            This surface is intentionally secret-free. It reports owner authentication, passkey posture, recovery code state, and whether any secret values were returned.
          </p>
        </div>
      </Card>

      <Card>
        <div className="space-y-4 p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Security checklist</p>
          <ul className="space-y-2 text-sm text-gray-200">
            <li className="rounded-2xl border border-border bg-surface-0 px-3 py-2">Owner-only access is enforced by passkey auth and server-side checks.</li>
            <li className="rounded-2xl border border-border bg-surface-0 px-3 py-2">Provider secrets are stored server-side and not returned to the client.</li>
            <li className="rounded-2xl border border-border bg-surface-0 px-3 py-2">AI redaction gates high-risk secrets before reasoning or memory storage.</li>
            <li className="rounded-2xl border border-border bg-surface-0 px-3 py-2">Public file URLs are not part of the universal input contract.</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
