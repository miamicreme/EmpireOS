/**
 * Minimal structured logger. Avoids logging secrets; callers must not pass
 * sensitive values. JSON lines make this easy to ship to a log sink later.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const line = {
    level,
    message,
    ...(meta ? { meta } : {}),
  };
  const serialized = JSON.stringify(line);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) =>
    emit('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) =>
    emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    emit('error', message, meta),
};
