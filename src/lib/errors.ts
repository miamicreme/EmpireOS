/**
 * Typed application errors with a stable code surface for API responses.
 */

export type AppErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'db_error'
  | 'redaction_blocked'
  | 'ai_provider_error'
  | 'invalid_state'
  | 'internal';

export type AppError = {
  code: AppErrorCode;
  message: string;
  details?: unknown;
};

export function appError(
  code: AppErrorCode,
  message: string,
  details?: unknown,
): AppError {
  return { code, message, details };
}

/** Maps an AppError code to an HTTP status for API routes. */
export function httpStatusForError(code: AppErrorCode): number {
  switch (code) {
    case 'unauthorized':
      return 401;
    case 'forbidden':
    case 'redaction_blocked':
      return 403;
    case 'not_found':
      return 404;
    case 'validation':
      return 422;
    case 'conflict':
      return 409;
    case 'invalid_state':
      return 409;
    case 'ai_provider_error':
    case 'db_error':
    case 'internal':
      return 500;
    default:
      return 500;
  }
}
