'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { api } from '@/lib/api-client';
import { Card, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type EnrollmentStatus = {
  valid: boolean;
  expired: boolean;
  used: boolean;
  labelHint: string | null;
  expiresAt: string | null;
};

type EnrollmentOptions = PublicKeyCredentialCreationOptionsJSON & {
  labelHint?: string | null;
};

type VerifyResult = {
  verified: boolean;
  nextUrl?: string;
};

function friendlyError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'InvalidStateError') {
    return 'Windows could not save another passkey for this account. Your existing Windows passkey may already be active. Use Add another device for iPhone.';
  }
  if (name === 'NotAllowedError') return 'The passkey action was cancelled or timed out.';
  if (name === 'SecurityError') return 'Passkey setup failed because the browser or RP settings do not match.';
  if (name === 'AbortError') return 'The passkey request was interrupted. Try again.';
  return (err as Error)?.message ?? 'Passkey setup failed.';
}

export function PasskeyEnrollmentWorkbench({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<EnrollmentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await api.get<EnrollmentStatus>(`/api/auth/passkeys/enrollment/${token}/status`);
      if (!cancelled) {
        setStatus(res.ok ? res.data : null);
        setError(res.ok ? null : res.error.message);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function enroll() {
    setEnrolling(true);
    setError(null);
    try {
      const options = await api.post<EnrollmentOptions>(`/api/auth/passkeys/enrollment/${token}/register/options`, {});
      if (!options.ok) {
        setError(options.error.message);
        return;
      }
      const attestation = await startRegistration({ optionsJSON: options.data });
      const verify = await api.post<VerifyResult>(`/api/auth/passkeys/enrollment/${token}/register/verify`, {
        response: attestation,
        label: status?.labelHint ?? 'Add another device',
      });
      if (!verify.ok) {
        setError(verify.error.message);
        return;
      }
      setSuccess(true);
      router.replace('/today');
      router.refresh();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setEnrolling(false);
    }
  }

  if (loading) {
    return (
      <Card className="max-w-2xl">
        <EmptyState icon="◇" message="Loading enrollment link..." />
      </Card>
    );
  }

  if (!status?.valid) {
    return (
      <Card className="max-w-2xl">
        <div className="p-6 space-y-3">
          <p className="text-sm font-semibold text-gray-100">This link expired</p>
          <p className="text-sm text-empire-muted">
            Generate a new Add another device link from a signed-in PC.
          </p>
          <p className="text-xs text-empire-muted">
            This link expires in 10 minutes. Only open this link on a device you control.
          </p>
          {status?.used && <p className="text-xs text-empire-muted">This enrollment link was already used.</p>}
          {error && <p className="text-xs text-empire-red">{error}</p>}
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl">
      <div className="p-6 space-y-5">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-empire-blue">Add another device</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-100">Add this device to Empire OS</h1>
          <p className="mt-2 text-sm text-empire-muted">
            This adds your iPhone without removing your Windows passkey.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface-0 p-4 space-y-2">
          <p className="text-sm text-gray-100">Use Face ID / Touch ID / this device passkey.</p>
          <p className="text-xs text-empire-muted">
            {status.labelHint ? `Label hint: ${status.labelHint}. ` : ''}
            This link expires in 10 minutes. Only open this link on a device you control.
          </p>
          {status.expiresAt && <p className="text-xs text-empire-muted">Expires at {status.expiresAt}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={enroll} loading={enrolling} disabled={success}>
            Create passkey on this device
          </Button>
        </div>

        {error && <p className="text-xs text-empire-red">{error}</p>}
      </div>
    </Card>
  );
}
