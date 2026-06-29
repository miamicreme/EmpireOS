'use client';

import { useCallback, useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';

interface Passkey {
  id: string;
  label: string | null;
  device_type: string | null;
  backed_up: boolean | null;
  created_at: string;
  last_used_at: string | null;
}

function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Device';
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'iPhone / iPad';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  return 'This device';
}

export default function PasskeysPage() {
  const { success, error } = useToast();
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<Passkey[]>('/api/auth/passkeys');
    if (res.ok) setKeys(res.data);
    else error(res.error.message);
    setLoading(false);
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPasskey() {
    setAdding(true);
    try {
      const opt = await api.post<PublicKeyCredentialCreationOptionsJSON>(
        '/api/auth/register/options',
        {},
      );
      if (!opt.ok) return error(opt.error.message);
      const attResp = await startRegistration({ optionsJSON: opt.data });
      const verify = await api.post('/api/auth/register/verify', {
        response: attResp,
        label: deviceLabel(),
      });
      if (!verify.ok) return error(verify.error.message);
      success('Recovery passkey added');
      await load();
    } catch (e) {
      const name = (e as { name?: string }).name;
      error(name === 'InvalidStateError' ? 'This device already has a passkey.' : 'Cancelled.');
    } finally {
      setAdding(false);
    }
  }

  async function remove(key: Passkey) {
    if (keys.length <= 1) {
      error('Register another passkey before removing your only one.');
      return;
    }
    const prev = keys;
    setKeys((cur) => cur.filter((k) => k.id !== key.id));
    const res = await api.del(`/api/auth/passkeys/${key.id}`);
    if (res.ok) success('Passkey removed');
    else {
      setKeys(prev);
      error(res.error.message);
    }
  }

  return (
    <main className="flex-1 p-6 overflow-y-auto">
      <PageHeader
        title="Passkeys"
        subtitle="Manage the devices that can sign in to Empire OS. Keep at least two for recovery."
        action={<Button onClick={addPasskey} loading={adding} icon={<span>+</span>}>Add passkey</Button>}
      />

      <Card className="max-w-2xl">
        {loading ? (
          <SkeletonRows rows={2} />
        ) : keys.length === 0 ? (
          <EmptyState icon="◇" message="No passkeys registered." />
        ) : (
          <div className="divide-y divide-border">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between px-4 py-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-100">{k.label ?? 'Passkey'}</p>
                    {k.backed_up && <Badge variant="blue">synced</Badge>}
                    {k.device_type && <Badge variant="muted">{k.device_type}</Badge>}
                  </div>
                  <p className="text-xs text-empire-muted mt-0.5 nums">
                    Added {k.created_at.slice(0, 10)}
                    {k.last_used_at ? ` · last used ${k.last_used_at.slice(0, 10)}` : ' · never used'}
                  </p>
                </div>
                <Button variant="danger" size="sm" onClick={() => remove(k)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-xs text-empire-muted max-w-2xl mt-4 leading-relaxed">
        Your biometric never leaves your device. Each passkey is a hardware-backed key unlocked by
        Face ID, Touch ID, or Windows Hello. Removing your last passkey is blocked to prevent lockout.
      </p>
    </main>
  );
}
