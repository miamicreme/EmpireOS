/**
 * Tests for the pure WebAuthn config derivation. The rpID must be derived from
 * the origin hostname (no scheme/port) when not set explicitly, with safe
 * localhost fallbacks — getting this wrong silently breaks passkey binding.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getWebAuthnConfig, getOwnerEmail } from '@/lib/env';

const ENV_KEYS = ['WEBAUTHN_ORIGIN', 'WEBAUTHN_RP_ID', 'WEBAUTHN_RP_NAME', 'OWNER_EMAIL'] as const;

describe('getWebAuthnConfig', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('falls back to localhost dev defaults when nothing is set', () => {
    const c = getWebAuthnConfig();
    expect(c.origin).toBe('http://localhost:3000');
    expect(c.rpID).toBe('localhost');
    expect(c.rpName).toBe('Empire OS');
  });

  it('derives rpID from the origin hostname (no scheme or port)', () => {
    process.env.WEBAUTHN_ORIGIN = 'https://empire.example.com:8443';
    const c = getWebAuthnConfig();
    expect(c.rpID).toBe('empire.example.com');
    expect(c.origin).toBe('https://empire.example.com:8443');
  });

  it('honors an explicit rpID over the derived one', () => {
    process.env.WEBAUTHN_ORIGIN = 'https://app.empire.com';
    process.env.WEBAUTHN_RP_ID = 'empire.com';
    expect(getWebAuthnConfig().rpID).toBe('empire.com');
  });

  it('uses a safe fallback when the origin is malformed', () => {
    process.env.WEBAUTHN_ORIGIN = 'not a url';
    expect(getWebAuthnConfig().rpID).toBe('localhost');
  });

  it('owner email defaults but is overridable', () => {
    expect(getOwnerEmail()).toBe('owner@empire.local');
    process.env.OWNER_EMAIL = 'me@me.com';
    expect(getOwnerEmail()).toBe('me@me.com');
  });
});
