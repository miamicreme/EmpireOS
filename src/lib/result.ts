/**
 * Shared Result pattern used by every service function.
 */
import type { AppError } from './errors';

export type AppResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

export function ok<T>(data: T): AppResult<T> {
  return { ok: true, data };
}

export function err<T = never>(error: AppError): AppResult<T> {
  return { ok: false, error };
}

/** Narrowing helpers. */
export function isOk<T>(r: AppResult<T>): r is { ok: true; data: T } {
  return r.ok;
}

export function isErr<T>(r: AppResult<T>): r is { ok: false; error: AppError } {
  return !r.ok;
}
