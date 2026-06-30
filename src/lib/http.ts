/**
 * Tiny client-side fetch helpers for the `{ ok, data | error }` API envelope
 * (the client mirror of `@/lib/api`'s jsonResult). Throws on a non-ok envelope
 * so callers can use try/catch.
 */
async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? 'Request failed');
  return json.data as T;
}

export const postJson = <T>(url: string, body: unknown): Promise<T> => send<T>(url, 'POST', body);
export const patchJson = <T>(url: string, body: unknown): Promise<T> => send<T>(url, 'PATCH', body);
