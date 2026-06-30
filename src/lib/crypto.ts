/**
 * Server-only symmetric encryption for secrets at rest (AI provider API keys).
 *
 * AES-256-GCM. The key comes from AI_PROVIDER_ENCRYPTION_KEY (base64, 32 bytes)
 * when set; otherwise it is derived from the Supabase service-role key via
 * scrypt so the feature works with zero extra configuration in a deployed env.
 *
 * NEVER import this from client code — it depends on node:crypto and a
 * server-only secret. Ciphertext format: v1:<iv>:<tag>:<data> (all base64url).
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { getServiceRoleKey } from './env';

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

let cachedKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const explicit = process.env.AI_PROVIDER_ENCRYPTION_KEY;
  if (explicit) {
    const buf = Buffer.from(explicit, 'base64');
    if (buf.length !== 32) {
      throw new Error('AI_PROVIDER_ENCRYPTION_KEY must be 32 bytes (base64).');
    }
    cachedKey = buf;
    return buf;
  }
  // Derive deterministically from the server-only service-role key.
  cachedKey = scryptSync(getServiceRoleKey(), 'empire-os:ai-providers', 32);
  return cachedKey;
}

/** Encrypt a UTF-8 plaintext secret. Returns a self-describing token string. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    data.toString('base64url'),
  ].join(':');
}

/** Decrypt a token produced by encryptSecret. Throws on tamper/format error. */
export function decryptSecret(token: string): string {
  const parts = token.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Malformed encrypted secret.');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64!, 'base64url');
  const tag = Buffer.from(tagB64!, 'base64url');
  const data = Buffer.from(dataB64!, 'base64url');
  const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Last 4 visible characters of a secret, for non-reversible display hints. */
export function secretHint(plaintext: string): string {
  const tail = plaintext.slice(-4);
  return tail.length === 4 ? `••••${tail}` : '••••';
}
