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

type EnrollmentCreateResponse = {
  enrollmentUrl: string;
  qrPayload: string;
  labelHint: string | null;
  expiresAt: string;
  nextUrl: string;
};

type EnrollmentStatus = {
  valid: boolean;
  expired: boolean;
  used: boolean;
  labelHint: string | null;
  expiresAt: string | null;
};

function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Device';
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'iPhone / iPad';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  return 'This device';
}

function friendlyDeviceError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'InvalidStateError') {
    return 'Windows could not save another passkey for this account. Your existing Windows passkey may already be active. Use Add another device for iPhone.';
  }
  if (name === 'NotAllowedError') return 'The passkey action was cancelled or timed out.';
  if (name === 'SecurityError') return 'Passkey setup failed because the browser or RP settings do not match.';
  if (name === 'AbortError') return 'The passkey request was interrupted. Try again.';
  return (err as Error)?.message ?? 'Something went wrong.';
}

export default function PasskeysPage() {
  const { success, error } = useToast();
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingLocal, setAddingLocal] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [enrollment, setEnrollment] = useState<EnrollmentCreateResponse | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState<EnrollmentStatus | null>(null);
  const [recoverCode, setRecoverCode] = useState('');

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

  async function addPasskeyOnThisDevice() {
    setAddingLocal(true);
    try {
      const opt = await api.post<PublicKeyCredentialCreationOptionsJSON>('/api/auth/register/options', {});
      if (!opt.ok) return error(opt.error.message);
      const attResp = await startRegistration({ optionsJSON: opt.data });
      const verify = await api.post('/api/auth/register/verify', {
        response: attResp,
        label: deviceLabel(),
      });
      if (!verify.ok) return error(verify.error.message);
      success('Passkey added on this device');
      await load();
    } catch (e) {
      error(friendlyDeviceError(e));
    } finally {
      setAddingLocal(false);
    }
  }

  async function addAnotherDevice() {
    setCreatingLink(true);
    setEnrollment(null);
    setEnrollmentStatus(null);
    try {
      const res = await api.post<EnrollmentCreateResponse>('/api/auth/passkeys/enrollment', {});
      if (!res.ok) return error(res.error.message);
      setEnrollment(res.data);
      success('Enrollment link created');
      const token = new URL(res.data.enrollmentUrl).pathname.split('/').filter(Boolean).pop();
      if (token) {
        const status = await api.get<EnrollmentStatus>(`/api/auth/passkeys/enrollment/${token}/status`);
        if (status.ok) setEnrollmentStatus(status.data);
      }
    } catch (e) {
      error((e as Error)?.message ?? 'Failed to create enrollment link.');
    } finally {
      setCreatingLink(false);
    }
  }

  async function copyEnrollmentLink() {
    if (!enrollment) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(enrollment.enrollmentUrl);
      success('Enrollment link copied');
    } catch {
      error('Could not copy link');
    }
  }

  async function recover() {
    setRecovering(true);
    try {
      const res = await api.post('/api/auth/recover', { code: recoverCode.trim() });
      if (!res.ok) return error(res.error.message);
      success('Emergency recovery completed');
      setRecoverCode('');
      setShowRecovery(false);
      setEnrollment(null);
      setEnrollmentStatus(null);
      await load();
    } catch (e) {
      error((e as Error)?.message ?? 'Recovery failed.');
    } finally {
      setRecovering(false);
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
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <PageHeader
        title="Passkeys"
        subtitle="Manage the devices that can sign in to Empire OS. Keep at least two for recovery."
      />

      <div className="grid gap-4 max-w-4xl xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex flex-wrap gap-2 p-4 border-b border-border">
            <Button onClick={addAnotherDevice} loading={creatingLink}>
              Add another device
            </Button>
            <Button variant="secondary" onClick={addPasskeyOnThisDevice} loading={addingLocal}>
              Add passkey on this device
            </Button>
            <Button variant="danger" onClick={() => setShowRecovery((v) => !v)}>
              Emergency recovery
            </Button>
          </div>

          <div className="border-b border-border p-4">
            <p className="text-sm text-empire-muted">
              The normal new-phone path is Add another device. Use Add passkey on this device only when you are already signed in on the current PC or Mac.
            </p>
          </div>
          {enrollment && (
            <div className="border-b border-border p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-100">Pair another device</p>
              <p className="text-sm text-empire-muted">
                This adds your iPhone without removing your Windows passkey.
              </p>
              <div className="rounded-xl border border-border bg-surface-0 p-3 space-y-2">
                <p className="text-xs font-mono uppercase tracking-[0.25em] text-empire-blue">Enrollment link / QR payload</p>
                <p className="break-all text-sm text-gray-100">{enrollment.enrollmentUrl}</p>
                <p className="text-xs text-empire-muted">This link expires in 10 minutes. Only open it on a device you control.</p>
                {enrollment.labelHint && <p className="text-xs text-empire-muted">Label hint: {enrollment.labelHint}</p>}
                {enrollmentStatus && (
                  <p className="text-xs text-empire-muted">
                    Status: {enrollmentStatus.valid ? 'valid' : enrollmentStatus.used ? 'used' : 'expired'}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={copyEnrollmentLink}>
                  Copy link
                </Button>
                <Button variant="ghost" onClick={() => window.open(enrollment.enrollmentUrl, '_blank', 'noopener,noreferrer')}>
                  Open link
                </Button>
              </div>
            </div>
          )}

          {showRecovery && (
            <div className="border-b border-border p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-100">Emergency recovery</p>
              <p className="text-sm text-empire-muted">
                Use only if all passkeys are lost. This may remove existing passkeys.
              </p>
              <input
                type="password"
                value={recoverCode}
                onChange={(e) => setRecoverCode(e.target.value)}
                placeholder="Recovery code"
                className="w-full rounded-lg bg-surface-1 border border-border px-3 py-2 text-sm text-gray-100 placeholder:text-empire-muted/60 outline-none focus:border-empire-blue"
              />
              <div className="flex gap-2">
                <Button onClick={recover} loading={recovering} disabled={!recoverCode.trim()}>
                  Reset access
                </Button>
                <Button variant="ghost" onClick={() => setShowRecovery(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="p-4">
              <SkeletonRows rows={2} />
            </div>
          ) : keys.length === 0 ? (
            <EmptyState icon="◇" message="No passkeys registered." />
          ) : (
            <div className="divide-y divide-border">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
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

        <Card>
          <EmptyState
            icon="◇"
            message="Add passkey on this device for Windows Hello / Face ID, or create an enrollment link for iPhone."
          />
        </Card>
      </div>

      <p className="text-xs text-empire-muted max-w-4xl mt-4 leading-relaxed">
        Your biometric never leaves your device. Each passkey is a hardware-backed key unlocked by Face ID, Touch ID, or Windows Hello.
        Emergency recovery is only for total lockout. Removing your last passkey is blocked to prevent lockout.
      </p>
    </main>
  );
}
