/**
 * API helpers: turn AppResult into typed NextResponse JSON with correct status.
 */
import { NextResponse } from 'next/server';
import { httpStatusForError, type AppError } from './errors';
import type { AppResult } from './result';

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonError(error: AppError) {
  return NextResponse.json(
    { ok: false, error: { code: error.code, message: error.message } },
    { status: httpStatusForError(error.code) },
  );
}

export function jsonResult<T>(result: AppResult<T>, okStatus = 200) {
  return result.ok ? jsonOk(result.data, okStatus) : jsonError(result.error);
}

/** Safe JSON body parse that never throws. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
