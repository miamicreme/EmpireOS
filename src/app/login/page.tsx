'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';

type Phase = 'loading' | 'unconfigured' | 'setup' | 'signin';

function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Device';
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'iPhone / iPad';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  return 'This device';
}

export default function LoginPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  // Whether we've already fired the one automatic sign-in attempt on load.
  const autoTried = useRef(false);

  const refresh = useCallback(async () => {
    const res = await api.get<{ configured: boolean; claimed: boolean; authenticated: boolean }>(
      '/api/auth/status',
    );
    if (res.ok && res.data.authenticated) {
      router.replace('/');
      return;
    }
    if (!res.ok || !res.data.configured) {
      setPhase('unconfigured');
      return;
    }
    setPhase(res.data.claimed ? 'signin' : 'setup');
  }, [router]);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
    void refresh();
  }, [refresh]);

  async function handleSetup() {
    setBusy(true);
    setError(null);
    try {
      const opt = await api.post<PublicKeyCredentialCreationOptionsJSON>(
        '/api/auth/register/options',
        {},
      );
      if (!opt.ok) return setError(opt.error.message);
      const attResp = await startRegistration({ optionsJSON: opt.data });
      const verify = await api.post('/api/auth/register/verify', {
        response: attResp,
        label: deviceLabel(),
      });
      if (!verify.ok) return setError(verify.error.message);
      router.replace('/');
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  // `auto` is the silent attempt fired on page load: if the browser needs a
  // user gesture (Safari) or the prompt is dismissed, we quietly fall back to
  // the button instead of flashing a scary error the user didn't cause.
  const handleSignIn = useCallback(
    async (auto = false) => {
      setBusy(true);
      setError(null);
      try {
        const opt = await api.post<PublicKeyCredentialRequestOptionsJSON>(
          '/api/auth/authenticate/options',
          {},
        );
        if (!opt.ok) {
          if (!auto) setError(opt.error.message);
          return;
        }
        const assResp = await startAuthentication({ optionsJSON: opt.data });
        const verify = await api.post('/api/auth/authenticate/verify', { response: assResp });
        if (!verify.ok) {
          if (!auto) setError(verify.error.message);
          return;
        }
        router.replace('/');
      } catch (e) {
        if (!auto) setError(friendly(e));
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  // Frictionless sign-in: the moment the screen is ready, surface the passkey
  // prompt automatically so returning owners just glance at their device. The
  // visible button remains as a fallback for browsers that block the prompt
  // until a user gesture.
  useEffect(() => {
    if (phase === 'signin' && supported && !autoTried.current) {
      autoTried.current = true;
      void handleSignIn(true);
    }
  }, [phase, supported, handleSignIn]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0 p-6">
      <div className="pointer-events-none absolute inset-0 bg-grid-faint [background-size:32px_32px]" />
      <div className="pointer-events-none absolute inset-0 bg-radial-glow" />

      <div className="relative w-full max-w-sm animate-scale-in">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-empire-blue/15 text-empire-blue text-2xl font-mono mb-4 shadow-glow">
            ⬡
          </div>
          <h1 className="text-xl font-semibold text-gray-100 tracking-tight">Empire OS</h1>
          <p className="text-sm text-empire-muted mt-1">Private execution operating system</p>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl shadow-card p-6">
          {phase === 'loading' && (
            <div className="flex justify-center py-6">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-empire-muted border-t-transparent" />
            </div>
          )}

          {phase === 'unconfigured' && (
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-200 font-medium">Auth not configured</p>
              <p className="text-xs text-empire-muted leading-relaxed">
                Set <code className="text-empire-blue">SUPABASE_SERVICE_ROLE_KEY</code>,{' '}
                <code className="text-empire-blue">WEBAUTHN_ORIGIN</code>, and{' '}
                <code className="text-empire-blue">OWNER_EMAIL</code> on the server, then reload.
              </p>
            </div>
          )}

          {!supported && phase !== 'unconfigured' && phase !== 'loading' && (
            <p className="text-xs text-empire-red font-mono mb-4 text-center">
              This browser doesn&apos;t support passkeys.
            </p>
          )}

          {phase === 'setup' && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-100">Set up your passkey</p>
                <p className="text-xs text-empire-muted mt-1 leading-relaxed">
                  Use Face ID, Touch ID, or Windows Hello. Your biometric never leaves this device —
                  this first passkey claims the account.
                </p>
              </div>
              <Button onClick={handleSetup} loading={busy} disabled={!supported} className="w-full" size="lg">
                Create passkey
              </Button>
            </div>
          )}

          {phase === 'signin' && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-100">Welcome back</p>
                <p className="text-xs text-empire-muted mt-1">
                  {busy ? 'Confirm with your device…' : 'Glance at your device to sign in.'}
                </p>
              </div>
              <Button
                onClick={() => handleSignIn(false)}
                loading={busy}
                disabled={!supported}
                className="w-full"
                size="lg"
              >
                {error ? 'Try again' : 'Sign in with passkey'}
              </Button>
            </div>
          )}

          {error && (
            <p className="mt-4 text-xs text-empire-red font-mono text-center leading-relaxed">{error}</p>
          )}
        </div>

        <p className="text-center text-[11px] text-empire-muted/70 font-mono mt-5">
          Passwordless · hardware-backed · phishing-resistant
        </p>
      </div>
    </div>
  );
}

function friendly(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError') return 'Cancelled or timed out. Try again.';
  if (name === 'InvalidStateError') return 'This device already has a passkey for Empire OS.';
  return (e as Error)?.message ?? 'Something went wrong.';
}
