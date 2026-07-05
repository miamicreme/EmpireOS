'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { ThemeToggle } from '@/components/layout/ThemeToggle';

type Phase = 'loading' | 'unconfigured' | 'setup' | 'signin';
// Visual state of the biometric orb, independent of which phase we're in.
type Status = 'idle' | 'scanning' | 'success' | 'error';

function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Device';
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'iPhone / iPad';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  return 'This device';
}

/** Names the platform authenticator so copy reads naturally per device. */
function biometricName(): string {
  if (typeof navigator === 'undefined') return 'your device';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|Macintosh/.test(ua)) return 'Face ID or Touch ID';
  if (/Windows/.test(ua)) return 'Windows Hello';
  if (/Android/.test(ua)) return 'your fingerprint';
  return 'your device';
}

export default function LoginPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  // Break-glass recovery (lost/replaced device).
  const [showRecover, setShowRecover] = useState(false);
  const [recoverCode, setRecoverCode] = useState('');
  const [recovering, setRecovering] = useState(false);

  const busy = status === 'scanning';

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

  // Brief success beat before navigating, so the win is felt, not skipped.
  const succeed = useCallback(() => {
    setStatus('success');
    setError(null);
    window.setTimeout(() => router.replace('/'), 650);
  }, [router]);

  async function handleSetup() {
    setStatus('scanning');
    setError(null);
    try {
      const opt = await api.post<PublicKeyCredentialCreationOptionsJSON>(
        '/api/auth/register/options',
        {},
      );
      if (!opt.ok) {
        setStatus('error');
        return setError(opt.error.message);
      }
      const attResp = await startRegistration({ optionsJSON: opt.data });
      const verify = await api.post('/api/auth/register/verify', {
        response: attResp,
        label: deviceLabel(),
      });
      if (!verify.ok) {
        setStatus('error');
        return setError(verify.error.message);
      }
      succeed();
    } catch (e) {
      setStatus('error');
      setError(friendly(e));
    }
  }

  async function handleSignIn() {
    setStatus('scanning');
    setError(null);
    try {
      const opt = await api.post<PublicKeyCredentialRequestOptionsJSON>(
        '/api/auth/authenticate/options',
        {},
      );
      if (!opt.ok) {
        setStatus('error');
        return setError(opt.error.message);
      }
      const assResp = await startAuthentication({ optionsJSON: opt.data });
      const verify = await api.post('/api/auth/authenticate/verify', { response: assResp });
      if (!verify.ok) {
        setStatus('error');
        return setError(verify.error.message);
      }
      succeed();
    } catch (e) {
      setStatus('error');
      setError(friendly(e));
    }
  }

  // Clear the stored passkey(s) with the owner recovery code, then drop back to
  // first-time setup so this device can register fresh (with Face ID / Hello).
  async function handleRecover() {
    setRecovering(true);
    setError(null);
    try {
      const res = await api.post('/api/auth/recover', { code: recoverCode.trim() });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setShowRecover(false);
      setRecoverCode('');
      setStatus('idle');
      await refresh(); // account is now unclaimed → flips to the setup screen
    } catch {
      setError('Recovery failed. Try again.');
    } finally {
      setRecovering(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0 p-6">
      <div className="pointer-events-none absolute inset-0 bg-grid-faint [background-size:32px_32px]" />
      <div className="pointer-events-none absolute inset-0 bg-radial-glow" />
      <ThemeToggle className="absolute right-5 top-5" />

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

          {(phase === 'setup' || phase === 'signin') && (
            <div className="flex flex-col items-center space-y-5">
              <BiometricOrb status={status} />

              {!supported ? (
                <p className="text-xs text-empire-red font-mono text-center">
                  This browser doesn&apos;t support passkeys.
                </p>
              ) : phase === 'setup' ? (
                <div className="w-full space-y-4">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-100">Set up your passkey</p>
                    <p className="text-xs text-empire-muted mt-1 leading-relaxed">
                      Use {biometricName()}. Your biometric never leaves this device — this first
                      passkey claims the account.
                    </p>
                  </div>
                  <Button onClick={handleSetup} loading={busy} className="w-full" size="lg">
                    Create passkey
                  </Button>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-100">
                      {status === 'success' ? 'Signed in' : 'Welcome back'}
                    </p>
                    <p className="text-xs text-empire-muted mt-1 leading-relaxed">
                      {statusCopy(status)}
                    </p>
                  </div>
                  {status !== 'success' && (
                    <Button onClick={handleSignIn} loading={busy} className="w-full" size="lg">
                      {status === 'error' ? 'Try again' : `Sign in with ${biometricName()}`}
                    </Button>
                  )}

                  {status !== 'success' && !showRecover && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowRecover(true);
                        setError(null);
                      }}
                      className="block w-full text-center text-xs text-empire-muted hover:text-gray-300 transition-colors"
                    >
                      New phone? Use Add another device from a signed-in device. Emergency recovery is only if all passkeys are lost.
                    </button>
                  )}

                  {showRecover && (
                    <div className="space-y-3 rounded-xl border border-border bg-surface-0 p-3">
                      <p className="text-xs text-empire-muted leading-relaxed">
                        Emergency recovery is only for total lockout. Enter the recovery code to clear stored passkeys and start over on a fresh device.
                      </p>
                      <input
                        type="password"
                        autoFocus
                        value={recoverCode}
                        onChange={(e) => setRecoverCode(e.target.value)}
                        placeholder="Recovery code"
                        className="w-full rounded-lg bg-surface-1 border border-border px-3 py-2 text-sm text-gray-100 placeholder:text-empire-muted/60 outline-none focus:border-empire-blue"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleRecover}
                          loading={recovering}
                          disabled={!recoverCode.trim()}
                          className="flex-1"
                        >
                          Emergency recovery
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setShowRecover(false);
                            setRecoverCode('');
                            setError(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p className="text-xs text-empire-red font-mono text-center leading-relaxed">{error}</p>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-empire-muted/70 font-mono mt-5">
          Passwordless · hardware-backed · phishing-resistant
        </p>
      </div>
    </div>
  );
}

/** The animated biometric indicator at the heart of the sign-in card. */
function BiometricOrb({ status }: { status: Status }) {
  const ring =
    status === 'success'
      ? 'border-empire-green/40 bg-empire-green/10 text-empire-green'
      : status === 'error'
        ? 'border-empire-red/40 bg-empire-red/10 text-empire-red'
        : 'border-empire-blue/30 bg-empire-blue/10 text-empire-blue';

  return (
    <div className={`relative flex h-20 w-20 items-center justify-center ${status === 'error' ? 'animate-shake' : ''}`}>
      {/* Radiating rings while the OS prompt is open. */}
      {status === 'scanning' && (
        <>
          <span className="absolute inset-0 rounded-full border border-empire-blue/40 animate-radiate" />
          <span
            className="absolute inset-0 rounded-full border border-empire-blue/30 animate-radiate"
            style={{ animationDelay: '0.6s' }}
          />
        </>
      )}
      <div
        className={`relative flex h-16 w-16 items-center justify-center rounded-full border ${ring} ${
          status === 'scanning' ? 'animate-breathe' : ''
        } transition-colors duration-300`}
      >
        {status === 'success' ? (
          <CheckIcon className="h-7 w-7 animate-pop-in" />
        ) : (
          <FingerprintIcon className="h-8 w-8" />
        )}
      </div>
    </div>
  );
}

function statusCopy(status: Status): string {
  switch (status) {
    case 'scanning':
      return 'Confirm with your device…';
    case 'success':
      return 'Taking you in.';
    case 'error':
      return 'That didn’t go through. Give it another try.';
    default:
      return `Tap below and confirm with ${biometricName()}.`;
  }
}

function FingerprintIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 10a2 2 0 0 0-2 2c0 1.5.5 3 1 4" />
      <path d="M12 6a6 6 0 0 0-6 6c0 2 .5 3.5 1 5" />
      <path d="M12 6a6 6 0 0 1 6 6c0 1 0 2-.2 3" />
      <path d="M8 13c0 2 .5 3.5 1.5 5.5" />
      <path d="M16 12a4 4 0 0 0-4-4" />
      <path d="M15.5 16c-.3 1-.7 1.8-1.2 2.6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function friendly(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError') return 'Cancelled or timed out. Try again.';
  if (name === 'InvalidStateError') {
    return 'Windows could not save another passkey for this account. Your existing Windows passkey may already be active. Use Add another device for iPhone.';
  }
  return (e as Error)?.message ?? 'Something went wrong.';
}
