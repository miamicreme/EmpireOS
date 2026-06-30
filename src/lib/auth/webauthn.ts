/**
 * High-level passkey (WebAuthn) orchestration. SERVER-ONLY.
 *
 * Wraps @simplewebauthn/server for the four steps of the FIDO2 ceremonies
 * (registration options/verify, authentication options/verify) and persists
 * credentials via the service-role data layer. The biometric never leaves the
 * device; we only ever handle public keys and signature counters.
 */
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getWebAuthnConfig } from '@/lib/env';
import {
  countCredentials,
  getCredentialById,
  insertCredential,
  listCredentials,
  updateCredentialCounter,
  type StoredCredential,
} from './credentials';
import { setChallenge, getChallenge, clearChallenge } from './challenge';

function transportsOf(c: StoredCredential): AuthenticatorTransportFuture[] {
  return (c.transports ?? []) as AuthenticatorTransportFuture[];
}

/** Has the owner account been claimed (at least one passkey registered)? */
export async function isAccountClaimed(admin: SupabaseClient): Promise<boolean> {
  return (await countCredentials(admin)) > 0;
}

export async function buildRegistrationOptions(
  admin: SupabaseClient,
  userId: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpID, rpName } = getWebAuthnConfig();
  const existing = await listCredentials(admin, userId);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: 'Empire OS Owner',
    userID: new TextEncoder().encode(userId),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: c.credential_id,
      transports: transportsOf(c),
    })),
    authenticatorSelection: {
      // Bind to the device's built-in authenticator (Face ID / Touch ID /
      // Windows Hello) and require user verification, so sign-in is biometric
      // by default rather than falling back to a roaming security key.
      authenticatorAttachment: 'platform',
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  setChallenge(options.challenge);
  return options;
}

export async function verifyRegistration(
  admin: SupabaseClient,
  userId: string,
  response: RegistrationResponseJSON,
  label: string | null,
): Promise<boolean> {
  const { rpID, origin } = getWebAuthnConfig();
  const expectedChallenge = getChallenge();
  if (!expectedChallenge) throw new Error('Registration challenge expired. Try again.');

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      // Enforce the biometric/PIN gesture on the server, not just in the
      // browser options — a tampered client can't downgrade to a non-UV
      // assertion.
      requireUserVerification: true,
    });
  } finally {
    clearChallenge();
  }

  const { verified, registrationInfo } = verification;
  if (!verified || !registrationInfo) return false;

  const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;
  await insertCredential(admin, {
    user_id: userId,
    credential_id: credential.id,
    public_key: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: (credential.transports ?? []) as string[],
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
    label,
  });
  return true;
}

export async function buildAuthenticationOptions(
  admin: SupabaseClient,
  ownerUserId: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { rpID } = getWebAuthnConfig();
  const creds = await listCredentials(admin, ownerUserId);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({
      id: c.credential_id,
      transports: transportsOf(c),
    })),
    // Require the biometric/PIN gesture on sign-in too (Face ID / Hello).
    userVerification: 'required',
  });

  setChallenge(options.challenge);
  return options;
}

/** Verify an authentication assertion; returns the owner user id on success. */
export async function verifyAuthentication(
  admin: SupabaseClient,
  response: AuthenticationResponseJSON,
): Promise<{ ok: true; userId: string } | { ok: false }> {
  const { rpID, origin } = getWebAuthnConfig();
  const expectedChallenge = getChallenge();
  if (!expectedChallenge) throw new Error('Login challenge expired. Try again.');

  const stored = await getCredentialById(admin, response.id);
  if (!stored) {
    clearChallenge();
    return { ok: false };
  }

  let verified = false;
  let newCounter = stored.counter;
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      // Enforce UV server-side so a tampered client can't present a non-UV
      // assertion to bypass the biometric/PIN gesture.
      requireUserVerification: true,
      credential: {
        id: stored.credential_id,
        publicKey: isoBase64URL.toBuffer(stored.public_key),
        counter: stored.counter,
        transports: transportsOf(stored),
      },
    });
    verified = result.verified;
    newCounter = result.authenticationInfo.newCounter;
  } finally {
    clearChallenge();
  }

  if (!verified) return { ok: false };

  await updateCredentialCounter(admin, stored.credential_id, newCounter);
  return { ok: true, userId: stored.user_id };
}
